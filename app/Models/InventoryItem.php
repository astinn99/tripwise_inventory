<?php

namespace App\Models;

use App\Support\StockStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'code', 'item_code', 'description', 'category', 'quantity', 'min_stock_level',
    'unit', 'supplier_id', 'cost', 'storage_location_id', 'serial_number',
    'warranty', 'condition', 'status',
])]
class InventoryItem extends Model
{
    use SoftDeletes;

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    protected function casts(): array
    {
        return [
            'cost' => 'float',
            'quantity' => 'integer',
            'min_stock_level' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (InventoryItem $item): void {
            $item->status = StockStatus::fromQuantity($item->quantity ?? 0, $item->min_stock_level ?? 0);
        });
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function storageLocation(): BelongsTo
    {
        return $this->belongsTo(StorageLocation::class);
    }

    public function supplyRequests(): HasMany
    {
        return $this->hasMany(SupplyRequest::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function locationLabel(): string
    {
        return $this->storageLocation?->label() ?? 'Unassigned';
    }
}
