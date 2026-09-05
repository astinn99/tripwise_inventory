<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'item_code', 'item_name', 'horizon_days', 'model', 'lead_time_days',
    'reorder_qty', 'stockout_on', 'procurement_pr_number', 'current_qty',
    'min_stock_level', 'generated_at', 'status', 'error',
])]
class ForecastRun extends Model
{
    protected function casts(): array
    {
        return [
            'horizon_days' => 'integer',
            'lead_time_days' => 'integer',
            'reorder_qty' => 'integer',
            'stockout_on' => 'date',
            'current_qty' => 'integer',
            'min_stock_level' => 'integer',
            'generated_at' => 'datetime',
        ];
    }

    public function points(): HasMany
    {
        return $this->hasMany(ForecastPoint::class)->orderBy('ds');
    }
}
