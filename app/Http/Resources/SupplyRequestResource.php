<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SupplyRequest */
class SupplyRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->request_number ?: (string) $this->id,
            'requestingDepartment' => $this->requesting_department ?: '',
            'itemCode' => $this->item_code ?: '',
            'itemName' => $this->item_name ?: '',
            'imageUrl' => $this->catalogItem?->imageUrl() ?? $this->inventoryItem?->imageUrl(),
            'category' => $this->category,
            'quantityRequested' => $this->quantity_requested,
            'requiredDate' => optional($this->required_date)?->format('Y-m-d'),
            'priority' => $this->priority ?: 'MEDIUM',
            'stockAvailability' => $this->stock_availability ?: 'Pending',
            'status' => $this->status === 'Received' ? 'Pending' : ($this->status ?: 'Pending'),
            'requestedBy' => $this->requested_by,
            'purpose' => $this->purpose,
            'dateReceived' => optional($this->date_received)?->format('Y-m-d'),
            'actionLogs' => $this->logs->map(fn ($log) => [
                'date' => $log->logged_at,
                'note' => $log->note,
            ])->values(),
        ];
    }
}
