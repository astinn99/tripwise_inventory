<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'pr_number', 'source_request', 'supply_request_id', 'department', 'item_code',
    'item_name', 'quantity', 'reason', 'priority', 'status', 'date_created',
    'estimated_cost', 'selected_supplier', 'po_number',
])]
class ProcurementRequest extends Model
{
    public function getRouteKeyName(): string
    {
        return 'pr_number';
    }

    protected function casts(): array
    {
        return [
            'date_created' => 'date',
            'estimated_cost' => 'float',
            'quantity' => 'integer',
        ];
    }

    public function catalogItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'item_code', 'item_code');
    }

    public function supplyRequest(): BelongsTo
    {
        return $this->belongsTo(SupplyRequest::class);
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }

    public function purchaseOrder(): HasOne
    {
        return $this->hasOne(PurchaseOrder::class);
    }

    public function opportunities(): HasMany
    {
        return $this->hasMany(SupplierOpportunity::class);
    }
}
