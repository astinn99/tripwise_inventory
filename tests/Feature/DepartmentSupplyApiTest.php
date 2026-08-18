<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\SupplyRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DepartmentSupplyApiTest extends TestCase
{
    use RefreshDatabase;

    private function departmentHeaders(): array
    {
        return [
            'Authorization' => 'Bearer testing-department-key',
            'Accept' => 'application/json',
        ];
    }

    public function test_catalog_requires_department_credentials(): void
    {
        $this->getJson('/api/department/items')->assertUnauthorized();
    }

    public function test_catalog_returns_requestable_stock(): void
    {
        InventoryItem::query()->create([
            'code' => 'INV-300',
            'item_code' => 'OFF-300',
            'description' => 'A4 Copy Paper',
            'category' => 'Office Supplies',
            'quantity' => 12,
            'min_stock_level' => 5,
            'unit' => 'Boxes',
            'cost' => 1250,
        ]);
        InventoryItem::query()->create([
            'code' => 'INV-301',
            'item_code' => 'COM-300',
            'description' => 'Handheld Radio',
            'category' => 'Communication Devices',
            'quantity' => 0,
            'min_stock_level' => 4,
            'unit' => 'Units',
            'cost' => 4500,
        ]);

        $this->withHeaders($this->departmentHeaders())
            ->getJson('/api/department/items?availableOnly=1')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.itemCode', 'OFF-300')
            ->assertJsonPath('data.0.quantityAvailable', 12)
            ->assertJsonPath('data.0.status', 'NORMAL')
            ->assertJsonPath('data.0.canRequest', true)
            ->assertJsonMissingPath('data.0.cost');
    }

    public function test_department_can_submit_supply_request(): void
    {
        InventoryItem::query()->create([
            'code' => 'INV-310',
            'item_code' => 'FLT-310',
            'description' => 'Engine Oil 5W-30',
            'category' => 'Fleet Consumables',
            'quantity' => 3,
            'min_stock_level' => 6,
            'unit' => 'Canisters',
            'cost' => 2100,
        ]);

        $this->withHeaders($this->departmentHeaders())
            ->postJson('/api/department/supply-requests', [
                'itemCode' => 'FLT-310',
                'quantity' => 8,
                'requestingDepartment' => 'Fleet Operations',
                'requestedBy' => 'Capt. Mark Santos',
                'requiredDate' => '2026-08-20',
                'priority' => 'HIGH',
                'purpose' => 'PMS for active TNVS sedans.',
            ])
            ->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.requestingDepartment', 'Fleet Operations')
            ->assertJsonPath('data.itemCode', 'FLT-310')
            ->assertJsonPath('data.status', 'Pending')
            ->assertJsonPath('data.stockAvailability', 'Insufficient Stock');

        $this->assertDatabaseHas('supply_requests', [
            'item_code' => 'FLT-310',
            'status' => 'Pending',
            'requesting_department' => 'Fleet Operations',
        ]);
        $this->assertSame(1, SupplyRequest::query()->count());
    }

    public function test_unknown_item_cannot_be_requested(): void
    {
        $this->withHeaders($this->departmentHeaders())
            ->postJson('/api/department/supply-requests', [
                'itemCode' => 'MISSING-1',
                'quantity' => 1,
                'requestingDepartment' => 'Administration',
                'requestedBy' => 'Sarah Jenkins',
            ])
            ->assertStatus(422);
    }
}
