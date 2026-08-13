<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'delivery_id', 'item_code', 'description', 'po_quantity',
    'delivered_quantity', 'condition', 'result', 'remarks',
])]
class DeliveryItem extends Model
{
    protected function casts(): array
    {
        return [
            'po_quantity' => 'integer',
            'delivered_quantity' => 'integer',
        ];
    }

    public function delivery(): BelongsTo
    {
        return $this->belongsTo(Delivery::class);
    }
}
