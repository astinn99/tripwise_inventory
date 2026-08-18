<?php

namespace Tests\Unit;

use App\Support\WarrantyDuration;
use PHPUnit\Framework\TestCase;

class WarrantyDurationTest extends TestCase
{
    public function test_numeric_months_win_over_text(): void
    {
        $this->assertSame(24, WarrantyDuration::months(24, '1 year'));
    }

    public function test_parses_year_and_month_phrases(): void
    {
        $this->assertSame(12, WarrantyDuration::months(null, '1 year'));
        $this->assertSame(24, WarrantyDuration::months(null, '2 years parts'));
        $this->assertSame(6, WarrantyDuration::months(null, '6 months'));
    }

    public function test_label_combines_months_and_terms(): void
    {
        $this->assertSame('12 months · parts and labor', WarrantyDuration::label(12, 'parts and labor'));
        $this->assertSame('12 months', WarrantyDuration::label(12, '12 months'));
        $this->assertSame('1 year', WarrantyDuration::label(null, '1 year'));
    }
}
