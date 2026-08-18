<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\PurchaseOrder;
use App\Models\StorageLocation;
use App\Models\Supplier;
use App\Models\SupplierOpportunity;
use App\Models\SupplyRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SupplyChainApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_index_returns_items(): void
    {
        $user = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-100',
            'company_name' => 'Test Supplier',
            'contact_person' => 'Pat Lee',
            'status' => 'Active',
            'categories' => ['Office Supplies'],
        ]);
        $location = StorageLocation::query()->create([
            'rack' => 'Rack A',
            'shelf' => 'Shelf 01',
            'bin' => 'Bin 01',
            'category' => 'Office Supplies',
            'max_capacity' => 50,
        ]);
        InventoryItem::query()->create([
            'code' => 'INV-100',
            'item_code' => 'OFF-100',
            'description' => 'Copy Paper',
            'category' => 'Office Supplies',
            'quantity' => 20,
            'min_stock_level' => 5,
            'unit' => 'Boxes',
            'supplier_id' => $supplier->id,
            'cost' => 100,
            'storage_location_id' => $location->id,
        ]);

        $this->actingAs($user)
            ->getJson('/api/inventory-items')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.itemCode', 'OFF-100')
            ->assertJsonPath('data.0.imageUrl', null);
    }

    public function test_check_stock_marks_request_ready_when_stock_is_available(): void
    {
        $user = User::factory()->create();
        $item = InventoryItem::query()->create([
            'code' => 'INV-200',
            'item_code' => 'COM-200',
            'description' => 'Radio',
            'category' => 'Communication Devices',
            'quantity' => 10,
            'min_stock_level' => 2,
            'unit' => 'Units',
            'cost' => 1000,
        ]);
        $request = SupplyRequest::query()->create([
            'request_number' => 'REQ-2026-200',
            'requesting_department' => 'Dispatch',
            'inventory_item_id' => $item->id,
            'item_code' => $item->item_code,
            'item_name' => $item->description,
            'category' => $item->category,
            'quantity_requested' => 4,
            'priority' => 'MEDIUM',
            'status' => 'Pending',
            'requested_by' => 'Elena Rostova',
        ]);

        $this->actingAs($user)
            ->postJson("/api/supply-requests/{$request->request_number}/check-stock")
            ->assertOk()
            ->assertJsonPath('data.status', 'Ready for Release');
    }

    public function test_supply_request_index_handles_pending_manual_rows(): void
    {
        $user = User::factory()->create();
        SupplyRequest::query()->create([
            'request_number' => 'REQ-2026-201',
            'requesting_department' => 'Fleet Operations',
            'item_code' => 'COM-201',
            'item_name' => 'Dashcam',
            'quantity_requested' => 2,
            'stock_availability' => null,
            'status' => 'Pending',
        ]);

        $this->actingAs($user)
            ->getJson('/api/supply-requests')
            ->assertOk()
            ->assertJsonPath('data.0.id', 'REQ-2026-201')
            ->assertJsonPath('data.0.stockAvailability', 'Pending')
            ->assertJsonPath('data.0.status', 'Pending');
    }

    public function test_item_create_validates_required_fields(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/inventory-items', [])
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_inventory_item_can_store_replace_and_remove_photo(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $fields = [
            'description' => 'Handheld Radio',
            'category' => 'Communication Devices',
            'quantity' => 8,
            'minStockLevel' => 3,
            'unit' => 'Units',
            'cost' => 500,
        ];

        $created = $this->actingAs($user)
            ->post('/api/inventory-items', [
                ...$fields,
                'image' => UploadedFile::fake()->image('radio.jpg', 80, 80),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('success', true);

        $itemId = $created->json('data.id');
        $imageUrl = $created->json('data.imageUrl');
        $this->assertIsString($imageUrl);
        $this->assertStringContainsString('/storage/inventory-items/', $imageUrl);

        $item = InventoryItem::query()->where('code', $itemId)->first();
        $this->assertNotNull($item?->image_path);
        Storage::disk('public')->assertExists($item->image_path);
        $originalPath = $item->image_path;

        $this->actingAs($user)
            ->post("/api/inventory-items/{$itemId}", [
                ...$fields,
                'image' => UploadedFile::fake()->image('radio.png', 80, 80),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('success', true);

        $replaced = $item->fresh();
        $this->assertNotSame($originalPath, $replaced->image_path);
        Storage::disk('public')->assertMissing($originalPath);
        Storage::disk('public')->assertExists($replaced->image_path);

        $this->actingAs($user)
            ->post("/api/inventory-items/{$itemId}", [
                ...$fields,
                'removeImage' => '1',
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.imageUrl', null);

        Storage::disk('public')->assertMissing($replaced->image_path);
        $this->assertNull($item->fresh()->image_path);
    }

    public function test_inventory_item_rejects_non_image_uploads(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post('/api/inventory-items', [
                'description' => 'Handheld Radio',
                'category' => 'Communication Devices',
                'quantity' => 8,
                'minStockLevel' => 3,
                'unit' => 'Units',
                'cost' => 500,
                'image' => UploadedFile::fake()->create('notes.pdf', 20, 'application/pdf'),
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_supplier_cannot_access_internal_inventory(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_SUPPLIER]);

        $this->actingAs($user)
            ->getJson('/api/inventory-items')
            ->assertForbidden();
    }

    public function test_supplier_only_sees_own_opportunities(): void
    {
        $ours = Supplier::query()->create([
            'code' => 'SUP-200',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Fleet Consumables'],
        ]);
        $theirs = Supplier::query()->create([
            'code' => 'SUP-201',
            'company_name' => 'NaviTrack Philippines',
            'contact_person' => 'Marco Villanueva',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);

        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $ours->id,
        ]);

        SupplierOpportunity::query()->create([
            'opportunity_number' => 'OPP-2026-200',
            'pr_number' => 'PR-2026-200',
            'supplier_id' => $ours->id,
            'title' => 'Our RFQ',
            'category' => 'Fleet Consumables',
            'quantity' => 10,
            'status' => 'Open for Quotation',
        ]);
        SupplierOpportunity::query()->create([
            'opportunity_number' => 'OPP-2026-201',
            'pr_number' => 'PR-2026-201',
            'supplier_id' => $theirs->id,
            'title' => 'Other vendor RFQ',
            'category' => 'Communication Devices',
            'quantity' => 20,
            'status' => 'Open for Quotation',
        ]);

        $this->actingAs($vendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'OPP-2026-200');
    }

    public function test_manual_procurement_is_sent_to_every_active_vendor(): void
    {
        $staff = User::factory()->create();
        $officeSupplier = Supplier::query()->create([
            'code' => 'SUP-210',
            'company_name' => 'PaperCorp Philippines',
            'contact_person' => 'James Ocampo',
            'status' => 'Active',
            'categories' => ['Office Supplies'],
        ]);
        $commsSupplier = Supplier::query()->create([
            'code' => 'SUP-211',
            'company_name' => 'TechComms Global Inc.',
            'contact_person' => 'Lina Mendoza',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        $officeVendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $officeSupplier->id,
        ]);
        $commsVendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $commsSupplier->id,
        ]);

        InventoryItem::query()->create([
            'code' => 'INV-210',
            'item_code' => 'COM-210',
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 2,
            'min_stock_level' => 5,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-210',
                'quantity' => 10,
                'reason' => 'Restock handheld radios',
                'priority' => 'HIGH',
            ])
            ->assertCreated()
            ->assertJsonPath('data.itemCode', 'COM-210')
            ->assertJsonPath('data.vendorInviteCount', 0)
            ->assertJsonPath('data.status', 'For Procurement')
            ->assertJsonPath('data.canEdit', true)
            ->json('data.id');

        $this->actingAs($officeVendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk()
            ->assertJsonPath('data.vendorInviteCount', 2)
            ->assertJsonPath('data.canEdit', false);

        $this->actingAs($officeVendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.itemCode', 'COM-210')
            ->assertJsonPath('data.0.itemName', 'toktok');

        $this->actingAs($commsVendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.itemName', 'toktok');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk()
            ->assertJsonPath('data.vendorInviteCount', 2);
    }

    public function test_manual_restock_is_allowed_when_stock_is_normal(): void
    {
        $staff = User::factory()->create();
        InventoryItem::query()->create([
            'code' => 'INV-240',
            'item_code' => 'OFF-240',
            'description' => 'Copy Paper',
            'category' => 'Office Supplies',
            'quantity' => 40,
            'min_stock_level' => 5,
            'unit' => 'Boxes',
            'cost' => 100,
        ]);

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'OFF-240',
                'quantity' => 20,
                'reason' => 'Proactive restock while stock is still above minimum.',
                'priority' => 'NORMAL',
            ])
            ->assertCreated()
            ->assertJsonPath('data.itemCode', 'OFF-240')
            ->assertJsonPath('data.quantity', 20)
            ->assertJsonPath('data.sourceRequest', 'MANUAL')
            ->assertJsonPath('data.vendorInviteCount', 0);
    }

    public function test_procurement_request_can_be_edited_until_sent_to_vendors(): void
    {
        $staff = User::factory()->create();
        InventoryItem::query()->create([
            'code' => 'INV-241',
            'item_code' => 'OFF-241',
            'description' => 'Copy Paper',
            'category' => 'Office Supplies',
            'quantity' => 40,
            'min_stock_level' => 5,
            'unit' => 'Boxes',
            'cost' => 100,
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'OFF-241',
                'quantity' => 8,
                'reason' => 'Initial restock plan',
                'priority' => 'NORMAL',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($staff)
            ->putJson('/api/procurement-requests/'.$prNumber, [
                'quantity' => 12,
                'reason' => 'Updated restock quantity',
                'priority' => 'HIGH',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 12)
            ->assertJsonPath('data.priority', 'HIGH')
            ->assertJsonPath('data.reason', 'Updated restock quantity')
            ->assertJsonPath('data.canEdit', true);

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk()
            ->assertJsonPath('data.canEdit', false);

        $this->actingAs($staff)
            ->putJson('/api/procurement-requests/'.$prNumber, [
                'quantity' => 20,
                'reason' => 'Too late to edit',
                'priority' => 'URGENT',
            ])
            ->assertStatus(422);
    }

    public function test_vendor_quote_leaves_opportunities_and_can_be_edited_until_selected(): void
    {
        $staff = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-220',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Fleet Consumables'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);

        InventoryItem::query()->create([
            'code' => 'INV-220',
            'item_code' => 'COM-220',
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 2,
            'min_stock_level' => 5,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-220',
                'quantity' => 10,
                'reason' => 'low stock',
                'priority' => 'HIGH',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk();

        $quoteNumber = $this->actingAs($vendor)
            ->postJson('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'warranty' => '1 year',
                'deliveryTimeDays' => 2,
            ])
            ->assertCreated()
            ->assertJsonPath('data.canEdit', true)
            ->json('data.id');

        $this->actingAs($vendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($vendor)
            ->putJson('/api/quotations/'.$quoteNumber, [
                'unitPrice' => 1200,
                'warranty' => '2 years',
                'deliveryTimeDays' => 3,
            ])
            ->assertOk()
            ->assertJsonPath('data.unitPrice', 1200)
            ->assertJsonPath('data.totalPrice', 12000)
            ->assertJsonPath('data.canEdit', true);
    }

    public function test_vendor_confirm_creates_inbound_delivery(): void
    {
        $staff = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-230',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);

        $po = PurchaseOrder::query()->create([
            'po_number' => 'PO-2026-300',
            'supplier_id' => $supplier->id,
            'supplier' => $supplier->company_name,
            'contact_person' => 'Ana Reyes',
            'total_cost' => 10000,
            'budget_reference' => 'BUD-2026-INV-64',
            'payment_terms' => '30 Days Net',
            'delivery_date' => '2026-08-15',
            'finance_approval_status' => 'Finance Approved',
            'po_status' => 'Sent to Supplier',
            'created_date' => now()->toDateString(),
        ]);
        $po->items()->create([
            'item_code' => 'COM-001',
            'description' => 'toktok',
            'quantity' => 10,
            'unit_price' => 1000,
            'total' => 10000,
            'delivered_qty' => 0,
        ]);

        $this->actingAs($vendor)
            ->postJson('/api/purchase-orders/PO-2026-300/confirm')
            ->assertOk()
            ->assertJsonPath('data.poStatus', 'Confirmed');

        $this->actingAs($staff)
            ->getJson('/api/deliveries')
            ->assertOk()
            ->assertJsonPath('data.0.poNumber', 'PO-2026-300')
            ->assertJsonPath('data.0.supplier', 'Metro Parts Trading')
            ->assertJsonPath('data.0.status', 'In Transit')
            ->assertJsonPath('data.0.itemsDelivered.0.description', 'toktok');
    }
}
