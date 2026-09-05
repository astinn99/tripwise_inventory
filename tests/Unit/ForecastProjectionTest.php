<?php

namespace Tests\Unit;

use App\Services\ForecastService;
use PHPUnit\Framework\TestCase;

class ForecastProjectionTest extends TestCase
{
    public function test_reconstructs_end_of_day_on_hand_by_reversing_net_movements(): void
    {
        // Current on-hand after 2026-09-05 is 10.
        // 2026-09-03 releasing 3 (net -3), 2026-09-04 receiving 5 (net +5), 2026-09-05 releasing 2 (net -2).
        // end[09-05] = 10
        // end[09-04] = 10 - (-2) = 12
        // end[09-03] = 12 - 5 = 7
        $onHand = (new ForecastService)->reconstructOnHand(10, [
            '2026-09-03' => -3,
            '2026-09-04' => 5,
            '2026-09-05' => -2,
        ], '2026-09-03', '2026-09-05');

        $this->assertSame([
            '2026-09-03' => 7,
            '2026-09-04' => 12,
            '2026-09-05' => 10,
        ], $onHand);
    }

    public function test_projects_on_hand_as_current_plus_inbound_minus_forecasted_demand(): void
    {
        // 10 − 2 = 8; 8 + 5 − 2 = 11; 11 − 2 = 9
        $projected = (new ForecastService)->projectOnHand(10, [
            '2026-09-06' => 2,
            '2026-09-07' => 2,
            '2026-09-08' => 2,
        ], [
            '2026-09-07' => 5,
        ]);

        $this->assertSame([
            '2026-09-06' => 8,
            '2026-09-07' => 11,
            '2026-09-08' => 9,
        ], $projected);
    }

    public function test_stockout_date_is_the_first_day_projected_on_hand_is_below_zero(): void
    {
        // 4 − 3 = 1; 1 − 3 = -2
        $projected = (new ForecastService)->projectOnHand(4, [
            '2026-09-06' => 3,
            '2026-09-07' => 3,
            '2026-09-08' => 3,
        ], []);

        $this->assertSame('2026-09-07', (new ForecastService)->stockoutDate($projected));
    }

    public function test_reorder_qty_covers_min_stock_plus_forecast_minus_on_hand_and_inbound(): void
    {
        // lead 2 + safety 7 = 9 coverage days
        // demand 2/day × 9 = 18
        // need = min 8 + 18 = 26
        // have = current 10 + inbound 5 = 15
        // reorder = 11
        $demand = [];
        for ($day = 6; $day <= 14; $day++) {
            $demand[sprintf('2026-09-%02d', $day)] = 2;
        }

        $qty = (new ForecastService)->reorderQuantity(10, 8, $demand, [
            '2026-09-07' => 5,
        ], 2);

        $this->assertSame(11, $qty);
    }
}
