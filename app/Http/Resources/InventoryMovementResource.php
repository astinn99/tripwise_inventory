<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\InventoryMovement */
class InventoryMovementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->movement_number,
            'itemCode' => $this->item_code,
            'itemName' => $this->item_name,
            'movementType' => $this->movement_type,
            'quantity' => $this->quantity,
            'date' => $this->moved_at,
            'location' => $this->location,
            'reference' => $this->reference,
            'remarks' => $this->remarks,
            'recordedBy' => $this->recorded_by,
        ];
    }
}
