<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'delivery_number', 'purchase_order_id', 'po_number', 'supplier',
    'delivery_date', 'items_count', 'status', 'carrier', 'tracking_number',
    'inspection_result', 'inspection_notes',
])]
class Delivery extends Model
{
    public function getRouteKeyName(): string
    {
        return 'delivery_number';
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(DeliveryItem::class);
    }
}
