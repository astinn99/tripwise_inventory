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
            'minStockLevel' => $this->min_stock_level,
            'unit' => $this->unit,
            'supplier' => $this->supplier?->company_name ?? '',
            'cost' => (float) $this->cost,
            'location' => $this->locationLabel(),
            'serialNumber' => $this->serial_number ?: 'N/A',
            'warranty' => $this->warranty ?: 'N/A',
            'condition' => $this->condition ?: 'N/A',
            'status' => $this->status,
        ];
    }
}
