<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Release;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryAdjustmentApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_damaged_units_move_from_available_to_quarantine(): void
    {
        $user = User::factory()->create(['name' => 'J. Perez']);
        $this->createItem();

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Damaged',
                'quantity' => 3,
                'reason' => 'Cracked housing found during inspection.',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 7)
            ->assertJsonPath('data.damagedQuantity', 3)
            ->assertJsonPath('data.status', 'NORMAL')
            ->assertJsonPath('data.createdMovements.0.movementType', 'Damaged')
            ->assertJsonPath('data.createdMovements.0.quantity', 3);

        $this->assertSame('Damaged', InventoryMovement::query()->value('movement_type'));
        $this->assertSame(3, InventoryMovement::query()->value('quantity'));
        $this->assertSame('Quarantine', InventoryMovement::query()->value('location'));
        $this->assertSame('J. Perez', InventoryMovement::query()->value('recorded_by'));
        $this->assertDatabaseCount('releases', 0);
    }

    public function test_dispose_from_quarantine_does_not_reduce_available_stock(): void
    {
        $user = User::factory()->create();
        $this->createItem(damagedQuantity: 4);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Disposed',
                'source' => 'damaged',
                'quantity' => 2,
                'reason' => 'Beyond repair. Scrap approved.',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 10)
            ->assertJsonPath('data.damagedQuantity', 2);

        $this->assertSame('Disposed', InventoryMovement::query()->value('movement_type'));
    }

    public function test_return_to_vendor_clears_quarantine(): void
    {
        $user = User::factory()->create();
        $this->createItem(quantity: 19, damagedQuantity: 1);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Return',
                'source' => 'damaged',
                'quantity' => 1,
                'reason' => 'Defective ream returned to supplier under warranty.',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 19)
            ->assertJsonPath('data.damagedQuantity', 0);

        $this->assertSame('Return', InventoryMovement::query()->value('movement_type'));
    }

    public function test_lost_and_direct_dispose_reduce_available_stock(): void
    {
        $user = User::factory()->create();
        $this->createItem();

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Lost',
                'quantity' => 1,
                'reason' => 'Missing after cycle count.',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 9);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Disposed',
                'source' => 'available',
                'quantity' => 2,
                'reason' => 'Obsolete model, write-off.',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 7)
            ->assertJsonPath('data.damagedQuantity', 0);

        $this->assertSame(['Lost', 'Disposed'], InventoryMovement::query()->orderBy('id')->pluck('movement_type')->all());
    }

    public function test_manual_release_deducts_stock_and_creates_release(): void
    {
        $user = User::factory()->create(['name' => 'A. Cruz']);
        $this->createItem();

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'ManualRelease',
                'quantity' => 4,
                'reason' => 'Emergency issue for tonight dispatch.',
                'releasedTo' => 'Elena Rostova',
                'department' => 'Dispatch',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 6)
            ->assertJsonPath('data.createdRelease.requestId', 'MANUAL')
            ->assertJsonPath('data.createdRelease.releasedTo', 'Elena Rostova')
            ->assertJsonPath('data.createdRelease.requestingDepartment', 'Dispatch')
            ->assertJsonPath('data.createdRelease.quantityReleased', 4);

        $this->assertDatabaseHas('releases', [
            'request_id' => 'MANUAL',
            'requesting_department' => 'Dispatch',
            'item_code' => 'COM-400',
            'quantity_released' => 4,
            'released_to' => 'Elena Rostova',
            'dispatched_by' => 'A. Cruz',
            'approval_status' => 'Manual warehouse issue',
        ]);
        $this->assertSame('Releasing', InventoryMovement::query()->value('movement_type'));
        $this->assertStringContainsString('MANUAL', (string) InventoryMovement::query()->value('reference'));
        $this->assertNull(Release::query()->value('supply_request_id'));
    }

    public function test_cannot_adjust_more_than_available_pool(): void
    {
        $user = User::factory()->create();
        $this->createItem(quantity: 2, damagedQuantity: 1);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Damaged',
                'quantity' => 5,
                'reason' => 'Too many units.',
            ])
            ->assertStatus(422);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Disposed',
                'source' => 'damaged',
                'quantity' => 2,
                'reason' => 'Not enough quarantined units.',
            ])
            ->assertStatus(422);

        $this->assertSame(2, InventoryItem::query()->value('quantity'));
        $this->assertSame(1, InventoryItem::query()->value('damaged_quantity'));
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_manual_release_requires_recipient_and_department(): void
    {
        $user = User::factory()->create();
        $this->createItem();

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'ManualRelease',
                'quantity' => 1,
                'reason' => 'Walk-in issue.',
            ])
            ->assertStatus(422);
    }

    public function test_supplier_cannot_adjust_inventory(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_SUPPLIER]);
        $this->createItem();

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'Damaged',
                'quantity' => 1,
                'reason' => 'Should be blocked.',
            ])
            ->assertForbidden();
    }

    private function createItem(int $quantity = 10, int $damagedQuantity = 0): InventoryItem
    {
        return InventoryItem::query()->create([
            'code' => 'INV-400',
            'item_code' => 'COM-400',
            'description' => 'Handheld Radio',
            'category' => 'Communication Devices',
            'quantity' => $quantity,
            'damaged_quantity' => $damagedQuantity,
            'min_stock_level' => 2,
            'unit' => 'Units',
            'cost' => 1500,
        ]);
    }
}
