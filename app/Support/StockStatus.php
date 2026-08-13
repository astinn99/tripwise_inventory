<?php

namespace App\Support;

class StockStatus
{
    public static function fromQuantity(int|float $quantity, int|float $minStockLevel): string
    {
        if ((float) $quantity <= 0) {
            return 'OUT OF STOCK';
        }

        if ((float) $quantity <= (float) $minStockLevel) {
            return 'LOW STOCK';
        }

        return 'NORMAL';
    }
}
