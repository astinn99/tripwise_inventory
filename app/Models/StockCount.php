<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'count_number', 'title', 'count_date', 'location', 'status',
    'total_items_audited', 'discrepancy_count',
])]
class StockCount extends Model
{
    protected function casts(): array
    {
        return [
            'count_date' => 'date',
            'total_items_audited' => 'integer',
            'discrepancy_count' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'count_number';
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockCountItem::class);
    }
}
