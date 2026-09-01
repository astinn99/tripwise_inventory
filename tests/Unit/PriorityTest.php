<?php

namespace Tests\Unit;

use App\Support\Priority;
use PHPUnit\Framework\TestCase;

class PriorityTest extends TestCase
{
    public function test_normalizes_legacy_and_blank_values(): void
    {
        $this->assertSame('URGENT', Priority::normalize('urgent'));
        $this->assertSame('HIGH', Priority::normalize('HIGH'));
        $this->assertSame('NORMAL', Priority::normalize('MEDIUM'));
        $this->assertSame('NORMAL', Priority::normalize('LOW'));
        $this->assertSame('NORMAL', Priority::normalize(null));
        $this->assertSame('NORMAL', Priority::normalize(''));
    }

    public function test_quote_and_confirm_windows_follow_priority(): void
    {
        $this->assertSame(2, Priority::quoteDays('URGENT'));
        $this->assertSame(5, Priority::quoteDays('HIGH'));
        $this->assertSame(10, Priority::quoteDays('MEDIUM'));
        $this->assertSame(1, Priority::confirmDays('URGENT'));
        $this->assertSame(2, Priority::confirmDays('HIGH'));
        $this->assertSame(3, Priority::confirmDays('NORMAL'));
        $this->assertSame(3, Priority::neededInDays('URGENT'));
        $this->assertSame(7, Priority::neededInDays('HIGH'));
        $this->assertSame(14, Priority::neededInDays('NORMAL'));
        $this->assertSame(3, Priority::neededInDays('URGENT', 3));
        $this->assertSame(4, Priority::neededInDays('URGENT', 4));
        $this->assertSame('09/03/2026', Priority::displayDate('2026-09-03'));
    }

    public function test_urgent_quotes_rank_fastest_delivery_ahead_of_cheapest_price(): void
    {
        $ranked = Priority::rankQuotes([
            ['id' => 'cheap-slow', 'totalPrice' => 8000, 'deliveryTimeDays' => 21, 'warrantyMonths' => 12],
            ['id' => 'fast', 'totalPrice' => 12000, 'deliveryTimeDays' => 2, 'warrantyMonths' => 6],
        ], 'URGENT');

        $this->assertSame(['fast', 'cheap-slow'], array_column($ranked, 'id'));
    }

    public function test_normal_quotes_still_rank_lowest_price_first(): void
    {
        $ranked = Priority::rankQuotes([
            ['id' => 'fast', 'totalPrice' => 12000, 'deliveryTimeDays' => 2],
            ['id' => 'cheap', 'totalPrice' => 8000, 'deliveryTimeDays' => 21],
        ], 'NORMAL');

        $this->assertSame(['cheap', 'fast'], array_column($ranked, 'id'));
    }
}
