<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\ProcurementRequest;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Process;
use Tests\TestCase;

class ForecastAutoProcurementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-09-05 12:00:00'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_artisan_does_not_create_a_procurement_request(): void
    {
        $this->createItem(quantity: 2, min: 10);
        $this->seedReleases(5, 2);
        Process::fake([
            '*' => Process::result('{"model":"prophet","points":[]}'),
        ]);

        $this->artisan('forecasts:run')->assertSuccessful();

        $this->assertDatabaseMissing('procurement_requests', [
            'item_code' => 'COM-400',
        ]);
        $this->assertDatabaseHas('forecast_runs', [
            'item_code' => 'COM-400',
            'procurement_pr_number' => null,
        ]);
        $this->assertSame(0, ProcurementRequest::query()->count());
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

    private function seedReleases(int $days, int $qty): void
    {
        for ($offset = $days; $offset >= 1; $offset--) {
            $date = Carbon::parse('2026-09-05')->subDays($offset);
            InventoryMovement::query()->create([
                'movement_number' => 'MOV-REL-'.$offset,
                'item_code' => 'COM-400',
                'item_name' => 'Handheld Radio',
                'movement_type' => 'Releasing',
                'quantity' => $qty,
                'moved_at' => $date->format('Y-m-d H:i'),
            ]);
        }
    }
}
