<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'movement_number', 'inventory_item_id', 'item_code', 'item_name',
    'movement_type', 'quantity', 'moved_at', 'location', 'reference',
    'remarks', 'recorded_by',
])]
class InventoryMovement extends Model
{
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
        ];
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
