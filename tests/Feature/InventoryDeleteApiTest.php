<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryDeleteApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_remove_an_item_with_stock_from_the_catalog(): void
    {
        $staff = User::factory()->create();
        InventoryItem::query()->create([
            'code' => 'INV-DEL',
            'item_code' => 'FLT-DEL',
            'description' => 'Brake Fluid',
            'category' => 'Fleet Consumables',
            'quantity' => 12,
            'min_stock_level' => 2,
            'unit' => 'Bottles',
            'cost' => 250,
        ]);

        $this->actingAs($staff)
            ->deleteJson('/api/inventory-items/INV-DEL')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('inventory_items', [
            'code' => 'INV-DEL',
            'item_code' => 'FLT-DEL',
        ]);

        $this->actingAs($staff)
            ->getJson('/api/inventory-items')
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_vendor_cannot_remove_an_inventory_item(): void
    {
        $vendor = User::factory()->create(['role' => User::ROLE_SUPPLIER]);
        InventoryItem::query()->create([
            'code' => 'INV-DEL',
            'item_code' => 'FLT-DEL',
            'description' => 'Brake Fluid',
            'category' => 'Fleet Consumables',
            'quantity' => 1,
            'min_stock_level' => 0,
            'unit' => 'Bottles',
            'cost' => 250,
        ]);

        $this->actingAs($vendor)
            ->deleteJson('/api/inventory-items/INV-DEL')
            ->assertForbidden();

        $this->assertDatabaseHas('inventory_items', [
            'code' => 'INV-DEL',
            'deleted_at' => null,
        ]);
    }

    public function test_unauthenticated_item_delete_is_rejected(): void
    {
        $this->deleteJson('/api/inventory-items/INV-DEL')->assertUnauthorized();
    }
}
