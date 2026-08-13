<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\StorageLocation */
class StorageLocationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $item = $this->inventoryItems->first();

        return [
            'rack' => $this->rack,
            'shelf' => $this->shelf,
            'bin' => $this->bin,
            'category' => $this->category,
            'itemCode' => $item?->item_code ?? '',
            'itemName' => $item?->description ?? '',
            'quantity' => $item?->quantity ?? 0,
            'maxCapacity' => $this->max_capacity,
        ];
    }
}
