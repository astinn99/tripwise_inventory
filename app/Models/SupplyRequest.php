<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'request_number', 'requesting_department', 'inventory_item_id', 'item_code',
    'item_name', 'category', 'quantity_requested', 'required_date', 'priority',
    'stock_availability', 'status', 'requested_by', 'purpose', 'date_received',
])]
class SupplyRequest extends Model
{
    public function getRouteKeyName(): string
    {
        return 'request_number';
    }

    protected function casts(): array
    {
        return [
            'required_date' => 'date',
            'date_received' => 'date',
            'quantity_requested' => 'integer',
        ];
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function catalogItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'item_code', 'item_code');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(SupplyRequestLog::class);
    }

    public function procurementRequests(): HasMany
    {
        return $this->hasMany(ProcurementRequest::class);
    }

    public function releases(): HasMany
    {
        return $this->hasMany(Release::class);
    }
}
