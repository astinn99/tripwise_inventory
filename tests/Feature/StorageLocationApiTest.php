<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\StorageLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StorageLocationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_storage_locations_include_assigned_items(): void
    {
        $user = User::factory()->create();
        $location = StorageLocation::query()->create([
            'rack' => 'Rack A',
            'shelf' => 'Shelf 01',
            'bin' => 'Bin 01',
            'category' => 'Office Supplies',
            'max_capacity' => 50,
        ]);
        InventoryItem::query()->create([
            'code' => 'INV-300',
            'item_code' => 'OFF-300',
            'description' => 'Copy Paper',
            'category' => 'Office Supplies',
            'quantity' => 12,
            'min_stock_level' => 4,
            'unit' => 'Boxes',
            'cost' => 100,
            'storage_location_id' => $location->id,
        ]);

        $this->actingAs($user)
            ->getJson('/api/storage-locations')
            ->assertOk()
            ->assertJsonPath('data.0.id', $location->id)
            ->assertJsonPath('data.0.label', 'Rack A → Shelf 01 → Bin 01')
            ->assertJsonPath('data.0.quantity', 12)
            ->assertJsonPath('data.0.items.0.itemCode', 'OFF-300');
    }

    public function test_can_create_a_storage_bin(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/storage-locations', [
                'rack' => 'Rack A',
                'shelf' => 'Shelf 02',
                'bin' => 'Bin 05',
                'category' => 'Office Supplies',
                'maxCapacity' => 40,
            ])
            ->assertCreated()
            ->assertJsonPath('data.rack', 'Rack A')
            ->assertJsonPath('data.bin', 'Bin 05')
            ->assertJsonPath('data.maxCapacity', 40);

        $this->assertDatabaseHas('storage_locations', [
            'rack' => 'Rack A',
            'shelf' => 'Shelf 02',
            'bin' => 'Bin 05',
        ]);
    }

    public function test_empty_warehouse_is_mapped_and_items_are_placed(): void
    {
        $user = User::factory()->create();
        InventoryItem::query()->create([
            'code' => 'INV-302',
            'item_code' => 'COM-302',
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 14,
            'min_stock_level' => 2,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        $this->actingAs($user)
            ->getJson('/api/storage-locations')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseCount('storage_locations', 48);
        $this->assertNotNull(
            InventoryItem::query()->where('item_code', 'COM-302')->value('storage_location_id')
        );
        $this->assertDatabaseHas('storage_locations', [
            'id' => InventoryItem::query()->where('item_code', 'COM-302')->value('storage_location_id'),
            'rack' => 'Rack B',
            'category' => 'Communication Devices',
        ]);
    }

    public function test_can_bootstrap_default_warehouse_layout(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/storage-locations/bootstrap')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseCount('storage_locations', 48);
        $this->assertDatabaseHas('storage_locations', [
            'rack' => 'Rack D',
            'shelf' => 'Shelf 03',
            'bin' => 'Bin 04',
            'category' => 'Fleet Consumables',
        ]);
    }

    public function test_can_move_item_between_bins(): void
    {
        $user = User::factory()->create(['name' => 'J. Perez']);
        $from = StorageLocation::query()->create([
            'rack' => 'Rack A',
            'shelf' => 'Shelf 01',
            'bin' => 'Bin 01',
            'category' => 'Office Supplies',
            'max_capacity' => 50,
        ]);
        $to = StorageLocation::query()->create([
            'rack' => 'Rack B',
            'shelf' => 'Shelf 02',
            'bin' => 'Bin 03',
            'category' => 'Communication Devices',
            'max_capacity' => 50,
        ]);
        InventoryItem::query()->create([
            'code' => 'INV-301',
            'item_code' => 'COM-301',
            'description' => 'Handheld Radio',
            'category' => 'Communication Devices',
            'quantity' => 8,
            'min_stock_level' => 2,
            'unit' => 'Units',
            'cost' => 1500,
            'storage_location_id' => $from->id,
        ]);

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-301/move', [
                'storageLocationId' => $to->id,
            ])
            ->assertOk()
            ->assertJsonPath('data.storageLocationId', $to->id)
            ->assertJsonPath('data.location', 'Rack B → Shelf 02 → Bin 03');

        $this->assertDatabaseHas('inventory_items', [
            'item_code' => 'COM-301',
            'storage_location_id' => $to->id,
        ]);
        $this->assertSame('Transfer', InventoryMovement::query()->value('movement_type'));
        $this->assertSame('J. Perez', InventoryMovement::query()->value('recorded_by'));
    }

    public function test_saving_an_item_assigns_a_storage_location(): void
    {
        $user = User::factory()->create();
        $location = StorageLocation::query()->create([
            'rack' => 'Rack C',
            'shelf' => 'Shelf 01',
            'bin' => 'Bin 02',
            'category' => 'Maintenance Tools',
            'max_capacity' => 30,
        ]);

        $this->actingAs($user)
            ->postJson('/api/inventory-items', [
                'itemName' => 'Torque Wrench',
                'description' => 'Torque Wrench',
                'category' => 'Maintenance Tools',
                'quantity' => 6,
                'minStockLevel' => 2,
                'unit' => 'Units',
                'cost' => 2200,
                'storageLocationId' => $location->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.storageLocationId', $location->id)
            ->assertJsonPath('data.location', 'Rack C → Shelf 01 → Bin 02');
    }
}
