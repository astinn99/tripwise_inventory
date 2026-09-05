<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\SupplierOpportunity;
use App\Models\SupplyRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LowStockAutoProcurementTest extends TestCase
{
    use RefreshDatabase;

    public function test_release_that_hits_low_stock_creates_a_draft_procurement_request(): void
    {
        $user = User::factory()->create(['name' => 'A. Cruz']);
        $this->createItem(quantity: 10, min: 5);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'ManualRelease',
                'quantity' => 6,
                'reason' => 'Dispatch drawdown.',
                'releasedTo' => 'Elena Rostova',
                'department' => 'Dispatch',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 4)
            ->assertJsonPath('data.status', 'LOW STOCK');

        $pr = ProcurementRequest::query()->where('item_code', 'COM-400')->first();
        $this->assertNotNull($pr);
        $this->assertSame('LOW_STOCK', $pr->source_request);
        $this->assertSame('For Procurement', $pr->status);
        $this->assertSame('HIGH', $pr->priority);
        $this->assertSame(1, $pr->quantity);
        $this->assertNull($pr->po_number);
        $this->assertSame(0, SupplierOpportunity::query()->where('pr_number', $pr->pr_number)->count());
        $this->assertDatabaseHas('supply_notifications', [
            'type' => 'procurement',
            'title' => 'Low stock restock created',
        ]);
    }

    public function test_release_that_hits_zero_creates_an_urgent_restock(): void
    {
        $user = User::factory()->create();
        $this->createItem(quantity: 10, min: 5);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Lost',
                'quantity' => 10,
                'reason' => 'Cycle count write-off.',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 0)
            ->assertJsonPath('data.status', 'OUT OF STOCK');

        $pr = ProcurementRequest::query()->where('item_code', 'COM-400')->first();
        $this->assertNotNull($pr);
        $this->assertSame('URGENT', $pr->priority);
        $this->assertSame(5, $pr->quantity);
    }

    public function test_release_that_stays_normal_does_not_create_a_procurement_request(): void
    {
        $user = User::factory()->create();
        $this->createItem(quantity: 10, min: 5);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Lost',
                'quantity' => 2,
                'reason' => 'Two units missing.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'NORMAL');

        $this->assertDatabaseMissing('procurement_requests', [
            'item_code' => 'COM-400',
        ]);
    }

    public function test_second_drop_while_already_low_does_not_create_another_request(): void
    {
        $user = User::factory()->create();
        $this->createItem(quantity: 10, min: 5);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Lost',
                'quantity' => 6,
                'reason' => 'First drop to low.',
            ])
            ->assertOk();

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Lost',
                'quantity' => 1,
                'reason' => 'Already low, drop again.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'LOW STOCK');

        $this->assertSame(1, ProcurementRequest::query()->where('item_code', 'COM-400')->count());
    }

    public function test_skips_when_a_for_procurement_request_already_exists(): void
    {
        $user = User::factory()->create();
        $this->createItem(quantity: 10, min: 5);
        ProcurementRequest::query()->create([
            'pr_number' => 'PR-EXISTING',
            'source_request' => 'MANUAL',
            'department' => 'Inventory Management',
            'item_code' => 'COM-400',
            'item_name' => 'Handheld Radio',
            'quantity' => 8,
            'reason' => 'Already open.',
            'priority' => 'HIGH',
            'status' => 'For Procurement',
            'date_created' => now()->toDateString(),
        ]);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Lost',
                'quantity' => 6,
                'reason' => 'Hits low with an open PR.',
            ])
            ->assertOk();

        $this->assertSame(1, ProcurementRequest::query()->where('item_code', 'COM-400')->count());
        $this->assertDatabaseHas('procurement_requests', [
            'pr_number' => 'PR-EXISTING',
        ]);
    }

    public function test_skips_when_an_undelivered_purchase_order_exists(): void
    {
        $user = User::factory()->create();
        $this->createItem(quantity: 10, min: 5);
        $po = PurchaseOrder::query()->create([
            'po_number' => 'PO-OPEN-1',
            'supplier' => 'Metro Parts Trading',
            'total_cost' => 2000,
            'finance_approval_status' => 'Finance Approved',
            'po_status' => 'Confirmed',
            'created_date' => now()->toDateString(),
            'delivery_date' => now()->addDays(10)->toDateString(),
        ]);
        PurchaseOrderItem::query()->create([
            'purchase_order_id' => $po->id,
            'item_code' => 'COM-400',
            'description' => 'Handheld Radio',
            'quantity' => 12,
            'unit_price' => 1500,
            'total' => 18000,
            'delivered_qty' => 0,
        ]);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Lost',
                'quantity' => 6,
                'reason' => 'Hits low with inbound PO.',
            ])
            ->assertOk();

        $this->assertDatabaseMissing('procurement_requests', [
            'item_code' => 'COM-400',
            'source_request' => 'LOW_STOCK',
        ]);
    }

    public function test_supply_request_release_that_hits_low_stock_creates_a_request(): void
    {
        $user = User::factory()->create(['name' => 'J. Perez']);
        $item = $this->createItem(quantity: 10, min: 5);
        $request = SupplyRequest::query()->create([
            'request_number' => 'REQ-2026-LOW',
            'requesting_department' => 'Dispatch',
            'inventory_item_id' => $item->id,
            'item_code' => $item->item_code,
            'item_name' => $item->description,
            'category' => $item->category,
            'quantity_requested' => 6,
            'priority' => 'MEDIUM',
            'status' => 'Ready for Release',
            'requested_by' => 'Elena Rostova',
        ]);

        $this->actingAs($user)
            ->postJson("/api/supply-requests/{$request->request_number}/release", [
                'releasedTo' => 'Elena Rostova',
            ])
            ->assertOk()
            ->assertJsonPath('data.updatedInventory.0.quantity', 4)
            ->assertJsonPath('data.updatedInventory.0.status', 'LOW STOCK');

        $pr = ProcurementRequest::query()->where('item_code', 'COM-400')->first();
        $this->assertNotNull($pr);
        $this->assertSame('LOW_STOCK', $pr->source_request);
        $this->assertSame(1, $pr->quantity);
    }

    public function test_raising_minimum_so_current_qty_is_low_creates_a_request(): void
    {
        $user = User::factory()->create();
        $this->createItem(quantity: 10, min: 5);

        $this->actingAs($user)
            ->putJson('/api/inventory-items/INV-400', [
                'description' => 'Handheld Radio',
                'category' => 'Communication Devices',
                'quantity' => 10,
                'minStockLevel' => 12,
                'unit' => 'Units',
                'cost' => 1500,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'LOW STOCK');

        $pr = ProcurementRequest::query()->where('item_code', 'COM-400')->first();
        $this->assertNotNull($pr);
        $this->assertSame('LOW_STOCK', $pr->source_request);
        $this->assertSame(2, $pr->quantity);
    }

    public function test_creating_an_item_already_low_does_not_create_a_request(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/inventory-items', [
                'description' => 'Spare Antenna',
                'category' => 'Communication Devices',
                'quantity' => 2,
                'minStockLevel' => 10,
                'unit' => 'Units',
                'cost' => 400,
            ])
            ->assertCreated();

        $this->assertDatabaseMissing('procurement_requests', [
            'source_request' => 'LOW_STOCK',
        ]);
    }

    public function test_physical_count_that_hits_low_stock_creates_a_request(): void
    {
        $user = User::factory()->create();
        $this->createItem(quantity: 10, min: 5);

        $started = $this->actingAs($user)
            ->postJson('/api/stock-counts', [
                'title' => 'Low stock count',
                'location' => 'Main Warehouse',
            ])
            ->assertCreated();

        $countNumber = $started->json('data.id');

        $this->actingAs($user)
            ->postJson("/api/stock-counts/{$countNumber}/submit", [
                'items' => [[
                    'itemCode' => 'COM-400',
                    'itemName' => 'Handheld Radio',
                    'systemQty' => 10,
                    'actualQty' => 4,
                    'notes' => 'Shelf short.',
                ]],
            ])
            ->assertOk();

        $pr = ProcurementRequest::query()->where('item_code', 'COM-400')->first();
        $this->assertNotNull($pr);
        $this->assertSame('LOW_STOCK', $pr->source_request);
        $this->assertSame(1, $pr->quantity);
    }

    private function createItem(int $quantity, int $min): InventoryItem
    {
        return InventoryItem::query()->create([
            'code' => 'INV-400',
            'item_code' => 'COM-400',
            'description' => 'Handheld Radio',
            'category' => 'Communication Devices',
            'quantity' => $quantity,
            'min_stock_level' => $min,
            'unit' => 'Units',
            'cost' => 1500,
        ]);
    }
}
