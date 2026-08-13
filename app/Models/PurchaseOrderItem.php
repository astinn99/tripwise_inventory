<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'purchase_order_id', 'item_code', 'description', 'quantity',
    'unit_price', 'total', 'delivered_qty',
])]
class PurchaseOrderItem extends Model
{
    protected function casts(): array
    {
        return [
            'unit_price' => 'float',
            'total' => 'float',
            'quantity' => 'integer',
            'delivered_qty' => 'integer',
        ];
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }
}
