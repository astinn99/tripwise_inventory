<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Document;
use App\Models\InventoryItem;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_archive_a_document_with_a_file(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('warranty.pdf', 80, 'application/pdf');

        $this->actingAs($user)
            ->post('/api/documents', [
                'title' => 'Radio warranty certificate',
                'type' => 'Warranty',
                'expirationDate' => now()->addDays(10)->toDateString(),
                'warrantyMonths' => 12,
                'file' => $file,
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Radio warranty certificate')
            ->assertJsonPath('data.status', 'Expiring Soon')
            ->assertJsonPath('data.daysRemaining', 10);

        $doc = Document::query()->first();
        $this->assertNotNull($doc?->file_path);
        Storage::disk('public')->assertExists($doc->file_path);
    }

    public function test_document_status_is_computed_from_expiration_date(): void
    {
        $user = User::factory()->create();

        Document::query()->create([
            'document_number' => 'DOC-2026-001',
            'title' => 'Active policy',
            'type' => 'Insurance',
            'expiration_date' => now()->addDays(60)->toDateString(),
            'status' => 'Active',
        ]);
        Document::query()->create([
            'document_number' => 'DOC-2026-002',
            'title' => 'Expired contract',
            'type' => 'Contract',
            'expiration_date' => now()->subDay()->toDateString(),
            'status' => 'Active',
        ]);

        $this->actingAs($user)
            ->getJson('/api/documents')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'Expired')
            ->assertJsonPath('data.1.status', 'Active');
    }

    public function test_linked_item_and_po_appear_on_documents_bootstrap_and_reports(): void
    {
        $user = User::factory()->create();
        $item = InventoryItem::query()->create([
            'code' => 'INV-LINK',
            'item_code' => 'COM-LINK',
            'description' => 'Linked radio',
            'category' => 'Communication Devices',
            'quantity' => 2,
            'min_stock_level' => 1,
            'unit' => 'Units',
            'cost' => 500,
        ]);
        $po = PurchaseOrder::query()->create([
            'po_number' => 'PO-2026-LINK',
            'supplier' => 'Metro Parts Trading',
            'total_cost' => 2000,
            'finance_approval_status' => 'Finance Approved',
            'po_status' => 'Confirmed',
            'created_date' => now()->toDateString(),
        ]);
        Document::query()->create([
            'document_number' => 'DOC-2026-LINK',
            'title' => 'Linked warranty',
            'type' => 'Warranty',
            'reference_number' => $po->po_number,
            'supplier' => $po->supplier,
            'issue_date' => now()->toDateString(),
            'expiration_date' => now()->addYear()->toDateString(),
            'status' => 'Active',
            'category' => $item->category,
            'inventory_item_id' => $item->id,
            'purchase_order_id' => $po->id,
        ]);

        $this->actingAs($user)
            ->getJson('/api/documents')
            ->assertOk()
            ->assertJsonPath('data.0.itemCode', 'COM-LINK')
            ->assertJsonPath('data.0.purchaseOrderNumber', 'PO-2026-LINK');

        $this->actingAs($user)
            ->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.documents.0.itemCode', 'COM-LINK')
            ->assertJsonPath('data.documents.0.purchaseOrderNumber', 'PO-2026-LINK');

        $this->actingAs($user)
            ->getJson('/api/bootstrap?phase=more')
            ->assertOk()
            ->assertJsonPath('data.documents.0.itemCode', 'COM-LINK')
            ->assertJsonPath('data.documents.0.purchaseOrderNumber', 'PO-2026-LINK');

        $this->actingAs($user)
            ->getJson('/api/reports')
            ->assertOk()
            ->assertJsonPath('data.documents.0.itemCode', 'COM-LINK')
            ->assertJsonPath('data.documents.0.purchaseOrderNumber', 'PO-2026-LINK');
    }

    public function test_expiry_command_notifies_once_per_window(): void
    {
        Document::query()->create([
            'document_number' => 'DOC-2026-010',
            'title' => 'Fleet insurance',
            'type' => 'Insurance',
            'expiration_date' => now()->addDays(12)->toDateString(),
            'status' => 'Active',
        ]);

        $this->artisan('documents:check-expiry')->assertSuccessful();
        $this->assertDatabaseCount('supply_notifications', 1);
        $this->assertSame('30', Document::query()->first()->last_alert_window);

        $this->artisan('documents:check-expiry')->assertSuccessful();
        $this->assertDatabaseCount('supply_notifications', 1);
    }

    public function test_passed_inspection_stamps_item_warranty_and_archives_dtrs_document(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $item = InventoryItem::query()->create([
            'code' => 'INV-901',
            'item_code' => 'COM-901',
            'description' => 'Handheld radio',
            'category' => 'Communication Devices',
            'quantity' => 1,
            'min_stock_level' => 1,
            'unit' => 'Units',
            'cost' => 800,
        ]);

        Storage::disk('public')->put('quotation-warranties/QT-2026-001.pdf', 'certificate');

        $po = PurchaseOrder::query()->create([
            'po_number' => 'PO-2026-901',
            'supplier' => 'Metro Parts Trading',
            'total_cost' => 8000,
            'warranty' => 'parts and labor',
            'warranty_months' => 24,
            'warranty_file_path' => 'quotation-warranties/QT-2026-001.pdf',
            'finance_approval_status' => 'Finance Approved',
            'po_status' => 'Confirmed',
            'created_date' => now()->toDateString(),
        ]);
        $po->items()->create([
            'item_code' => $item->item_code,
            'description' => $item->description,
            'quantity' => 4,
            'unit_price' => 2000,
            'total' => 8000,
            'delivered_qty' => 0,
        ]);

        $delivery = Delivery::query()->create([
            'delivery_number' => 'DEL-2026-901',
            'purchase_order_id' => $po->id,
            'po_number' => $po->po_number,
            'supplier' => $po->supplier,
            'delivery_date' => now()->toDateString(),
            'items_count' => 1,
            'status' => 'In Transit',
        ]);
        $delivery->items()->create([
            'item_code' => $item->item_code,
            'description' => $item->description,
            'po_quantity' => 4,
            'delivered_quantity' => 0,
        ]);

        $this->actingAs($user)
            ->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.deliveries.0.id', 'DEL-2026-901')
            ->assertJsonPath('data.deliveries.0.itemsDelivered.0.itemCode', $item->item_code)
            ->assertJsonPath('data.deliveries.0.itemsDelivered.0.poQuantity', 4);

        $this->actingAs($user)
            ->postJson('/api/deliveries/DEL-2026-901/inspect', [
                'inspectionResult' => 'Passed',
                'remarks' => 'Accepted',
                'itemsDelivered' => [[
                    'itemCode' => $item->item_code,
                    'description' => $item->description,
                    'deliveredQuantity' => 4,
                    'condition' => 'Good',
                    'result' => 'Passed',
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.updatedInventory.0.quantity', 5)
            ->assertJsonPath('data.createdMovements.0.movementType', 'Receiving')
            ->assertJsonPath('data.createdMovements.0.quantity', 4);

        $item->refresh();
        $this->assertSame(now()->addMonths(24)->toDateString(), optional($item->warranty_expires_on)?->toDateString());
        $this->assertSame('parts and labor', $item->warranty);

        $doc = Document::query()->where('type', 'Warranty')->first();
        $this->assertNotNull($doc);
        $this->assertSame($item->id, $doc->inventory_item_id);
        $this->assertSame($po->id, $doc->purchase_order_id);
        $this->assertNotNull($doc->file_path);
        Storage::disk('public')->assertExists($doc->file_path);
    }
}
