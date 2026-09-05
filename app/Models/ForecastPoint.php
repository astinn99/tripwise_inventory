<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'forecast_run_id', 'ds', 'actual_demand', 'yhat', 'yhat_lower',
    'yhat_upper', 'on_hand_actual', 'on_hand_projected', 'inbound',
])]
class ForecastPoint extends Model
{
    protected function casts(): array
    {
        return [
            'ds' => 'date',
            'actual_demand' => 'integer',
            'yhat' => 'float',
            'yhat_lower' => 'float',
            'yhat_upper' => 'float',
            'on_hand_actual' => 'integer',
            'on_hand_projected' => 'integer',
            'inbound' => 'integer',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(ForecastRun::class, 'forecast_run_id');
    }
}
