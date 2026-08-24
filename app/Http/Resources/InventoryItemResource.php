<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\InventoryItem */
class InventoryItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->code,
            'itemCode' => $this->item_code,
            'itemName' => $this->description,
            'description' => $this->description,
            'category' => $this->category,
            'quantity' => $this->quantity,
            'damagedQuantity' => (int) $this->damaged_quantity,
            'minStockLevel' => $this->min_stock_level,
            'unit' => $this->unit,
            'supplier' => $this->relationLoaded('supplier') ? ($this->supplier?->company_name ?? '') : '',
            'cost' => (float) $this->cost,
            'storageLocationId' => $this->storage_location_id,
            'location' => $this->relationLoaded('storageLocation') ? $this->locationLabel() : 'Unassigned',
            'serialNumber' => $this->serial_number ?: 'N/A',
            'warranty' => $this->warranty ?: 'N/A',
            'warrantyExpiresOn' => optional($this->warranty_expires_on)?->format('Y-m-d'),
            'condition' => $this->condition ?: 'N/A',
            'imageUrl' => $this->imageUrl(),
            'status' => $this->status,
            'updatedAt' => optional($this->updated_at)?->toISOString(),
        ];
    }
}
