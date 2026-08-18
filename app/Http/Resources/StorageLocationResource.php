<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\StorageLocation */
class StorageLocationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $items = $this->inventoryItems;
        $quantity = (int) $items->sum('quantity');
        $maxCapacity = (int) $this->max_capacity;
        $item = $items->first();

        return [
            'id' => $this->id,
            'rack' => $this->rack,
            'shelf' => $this->shelf,
            'bin' => $this->bin,
            'category' => $this->category,
            'label' => $this->label(),
            'itemCode' => $item?->item_code ?? '',
            'itemName' => $item?->description ?? '',
            'quantity' => $quantity,
            'maxCapacity' => $maxCapacity,
            'itemCount' => $items->count(),
            'items' => $items->map(fn ($stored) => [
                'id' => $stored->code,
                'itemCode' => $stored->item_code,
                'itemName' => $stored->description,
                'quantity' => $stored->quantity,
                'unit' => $stored->unit,
                'category' => $stored->category,
                'status' => $stored->status,
            ])->values(),
        ];
    }
}
