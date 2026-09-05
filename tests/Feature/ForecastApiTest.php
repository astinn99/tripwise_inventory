<?php

namespace Tests\Feature;

use App\Services\ForecastService;
use App\Models\ForecastRun;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\ProcurementRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Process;
use Tests\TestCase;

class ForecastApiTest extends TestCase
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

    public function test_unauthenticated_forecast_routes_are_rejected(): void
    {
        $this->getJson('/api/forecasts')->assertUnauthorized();
        $this->getJson('/api/forecasts/COM-400')->assertUnauthorized();
        $this->postJson('/api/forecasts/refresh', ['itemCode' => 'COM-400'])->assertUnauthorized();
    }

    public function test_vendor_cannot_read_or_refresh_forecasts(): void
    {
        $vendor = User::factory()->create(['role' => User::ROLE_SUPPLIER]);
        $this->createItem();

        $this->actingAs($vendor)->getJson('/api/forecasts')->assertForbidden();
        $this->actingAs($vendor)
            ->postJson('/api/forecasts/refresh', ['itemCode' => 'COM-400'])
            ->assertForbidden();
    }

    public function test_staff_lists_empty_forecasts_before_a_run(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson('/api/forecasts')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data', []);
    }

    public function test_staff_can_refresh_one_sku_and_read_the_cached_run(): void
    {
        $this->createItem(quantity: 2, min: 10);
        $this->seedReleases('COM-400', 1, 2);

        $this->actingAs(User::factory()->create())
            ->postJson('/api/forecasts/refresh', ['itemCode' => 'COM-400', 'horizon' => 30])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.run.itemCode', 'COM-400')
            ->assertJsonPath('data.run.model', 'mean')
            ->assertJsonPath('data.run.horizonDays', 30)
            ->assertJsonPath('data.run.generatedAt', '2026-09-05 12:00');

        $this->assertGreaterThan(0, (int) $this->actingAs(User::factory()->create())
            ->getJson('/api/forecasts/COM-400')
            ->assertOk()
            ->json('data.run.reorderQty'));

        $this->actingAs(User::factory()->create())
            ->getJson('/api/forecasts')
            ->assertOk()
            ->assertJsonPath('data.0.itemCode', 'COM-400')
            ->assertJsonPath('data.0.model', 'mean');
    }

    public function test_reorder_without_stockout_is_not_flagged_as_at_risk(): void
    {
        $this->createItem(quantity: 20, min: 5);
        ForecastRun::query()->create([
            'item_code' => 'COM-400',
            'item_name' => 'Handheld Radio',
            'horizon_days' => 14,
            'model' => 'prophet',
            'lead_time_days' => 2,
            'reorder_qty' => 3,
            'stockout_on' => null,
            'current_qty' => 20,
            'min_stock_level' => 5,
            'generated_at' => now(),
            'status' => 'ready',
        ]);

        $this->actingAs(User::factory()->create())
            ->getJson('/api/forecasts?horizon=14')
            ->assertOk()
            ->assertJsonPath('data.0.reorderQty', 3)
            ->assertJsonPath('data.0.stockoutOn', null)
            ->assertJsonPath('data.0.forecastBadge', 'Covered');
    }

    public function test_stockout_in_the_look_ahead_is_flagged_as_at_risk(): void
    {
        $this->createItem(quantity: 8, min: 5);
        ForecastRun::query()->create([
            'item_code' => 'COM-400',
            'item_name' => 'Handheld Radio',
            'horizon_days' => 14,
            'model' => 'prophet',
            'lead_time_days' => 2,
            'reorder_qty' => 0,
            'stockout_on' => '2026-09-19',
            'current_qty' => 8,
            'min_stock_level' => 5,
            'generated_at' => now(),
            'status' => 'ready',
        ]);

        $this->actingAs(User::factory()->create())
            ->getJson('/api/forecasts?horizon=14')
            ->assertOk()
            ->assertJsonPath('data.0.stockoutOn', '2026-09-19')
            ->assertJsonPath('data.0.forecastBadge', 'At risk');
    }

    public function test_staff_restock_from_forecast_qty_marks_the_run_as_pr_open(): void
    {
        $this->createItem(quantity: 20, min: 5);
        ForecastRun::query()->create([
            'item_code' => 'COM-400',
            'item_name' => 'Handheld Radio',
            'horizon_days' => 14,
            'model' => 'prophet',
            'lead_time_days' => 2,
            'reorder_qty' => 3,
            'stockout_on' => null,
            'current_qty' => 20,
            'min_stock_level' => 5,
            'generated_at' => now(),
            'status' => 'ready',
        ]);

        $this->actingAs(User::factory()->create())
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-400',
                'quantity' => 3,
                'reason' => 'Staff restock from AI Forecasting. Suggested qty 3.',
                'priority' => 'NORMAL',
                'neededInDays' => 2,
            ])
            ->assertCreated();

        $pr = ProcurementRequest::query()->where('item_code', 'COM-400')->first();
        $this->assertNotNull($pr);
        $this->assertSame(3, $pr->quantity);

        $this->actingAs(User::factory()->create())
            ->getJson('/api/forecasts?horizon=14')
            ->assertOk()
            ->assertJsonPath('data.0.procurementPrNumber', $pr->pr_number)
            ->assertJsonPath('data.0.forecastBadge', 'Covered');
    }

    public function test_http_refresh_does_not_create_a_procurement_request(): void
    {
        $this->createItem(quantity: 2, min: 10);
        $this->seedReleases('COM-400', 5, 2);
        Process::fake([
            '*' => Process::result(file_get_contents(base_path('tests/fixtures/prophet-forecast.json'))),
        ]);

        $this->actingAs(User::factory()->create())
            ->postJson('/api/forecasts/refresh', ['itemCode' => 'COM-400'])
            ->assertOk();

        $this->assertDatabaseMissing('procurement_requests', [
            'item_code' => 'COM-400',
            'source_request' => 'FORECAST',
        ]);
    }

    public function test_three_release_days_uses_prophet_when_python_returns_a_fit(): void
    {
        $this->createItem(quantity: 20, min: 5);
        $this->seedReleases('COM-400', 3, 2);

        $fixture = file_get_contents(base_path('tests/fixtures/prophet-forecast.json'));
        $this->assertNotFalse($fixture);
        Process::fake([
            '*' => Process::result($fixture),
        ]);

        $this->actingAs(User::factory()->create())
            ->postJson('/api/forecasts/refresh', ['itemCode' => 'COM-400', 'horizon' => 7])
            ->assertOk()
            ->assertJsonPath('data.run.model', 'prophet')
            ->assertJsonPath('data.run.status', 'ready');
    }

    public function test_prophet_refresh_uses_process_stdout_fixture(): void
    {
        $this->createItem(quantity: 20, min: 5);
        $this->seedReleases('COM-400', 14, 2);

        $fixture = file_get_contents(base_path('tests/fixtures/prophet-forecast.json'));
        $this->assertNotFalse($fixture);
        Process::fake([
            '*' => Process::result($fixture),
        ]);

        $this->actingAs(User::factory()->create())
            ->postJson('/api/forecasts/refresh', ['itemCode' => 'COM-400', 'horizon' => 7])
            ->assertOk()
            ->assertJsonPath('data.run.model', 'prophet')
            ->assertJsonPath('data.run.status', 'ready');

        Process::assertRan(function ($process): bool {
            $command = $process->command;

            return collect(is_array($command) ? $command : [$command])
                ->contains(fn ($part) => str_contains((string) $part, 'forecast.py'));
        });
    }

    public function test_movement_refresh_uses_mean_and_does_not_run_prophet(): void
    {
        $this->createItem(quantity: 10, min: 2);
        $this->seedReleases('COM-400', 5, 2);
        Process::fake();

        app(ForecastService::class)->refreshAfterMovement('COM-400');

        Process::assertNothingRan();
        $this->assertSame('mean', ForecastRun::query()->where('item_code', 'COM-400')->value('model'));
    }

    public function test_stock_out_movement_refreshes_the_cached_forecast_without_creating_a_pr(): void
    {
        $this->createItem(quantity: 10, min: 2);
        $this->seedReleases('COM-400', 5, 2);
        $user = User::factory()->create(['name' => 'A. Cruz']);
        $fixture = file_get_contents(base_path('tests/fixtures/prophet-forecast.json'));
        $this->assertNotFalse($fixture);
        Process::fake([
            '*' => Process::result($fixture),
        ]);

        $this->actingAs($user)
            ->postJson('/api/forecasts/refresh', ['itemCode' => 'COM-400'])
            ->assertOk()
            ->assertJsonPath('data.run.currentQty', 10)
            ->assertJsonPath('data.run.generatedAt', '2026-09-05 12:00');

        Carbon::setTestNow(Carbon::parse('2026-09-05 12:05:00'));

        $this->actingAs($user)
            ->postJson('/api/inventory-items/INV-400/adjust', [
                'type' => 'ManualRelease',
                'quantity' => 4,
                'reason' => 'Emergency issue for tonight dispatch.',
                'releasedTo' => 'Elena Rostova',
                'department' => 'Dispatch',
            ])
            ->assertOk();

        $this->actingAs($user)
            ->getJson('/api/forecasts/COM-400')
            ->assertOk()
            ->assertJsonPath('data.run.currentQty', 6)
            ->assertJsonPath('data.run.generatedAt', '2026-09-05 12:05');

        $this->assertDatabaseMissing('procurement_requests', [
            'item_code' => 'COM-400',
            'source_request' => 'FORECAST',
        ]);
    }

    private function createItem(int $quantity = 10, int $min = 2): InventoryItem
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

    private function seedReleases(string $itemCode, int $days, int $qty): void
    {
        for ($offset = $days; $offset >= 1; $offset--) {
            $date = Carbon::parse('2026-09-05')->subDays($offset);
            InventoryMovement::query()->create([
                'movement_number' => 'MOV-REL-'.$offset,
                'item_code' => $itemCode,
                'item_name' => 'Handheld Radio',
                'movement_type' => 'Releasing',
                'quantity' => $qty,
                'moved_at' => $date->format('Y-m-d H:i'),
            ]);
        }
    }
}
