<?php

namespace App\Http\Resources;

use App\Support\Priority;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Delivery */
class DeliveryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->delivery_number,
            'poNumber' => $this->po_number,
            'supplier' => $this->supplier,
            'priority' => Priority::normalize($this->relationLoaded('purchaseOrder') ? $this->purchaseOrder?->priority : null),
            'deliveryDate' => $this->delivery_date,
            'itemsCount' => $this->items_count,
            'status' => $this->status,
            'carrier' => $this->carrier,
            'trackingNumber' => $this->tracking_number,
            'inspectionResult' => $this->inspection_result,
            'inspectionNotes' => $this->inspection_notes,
            'itemsDelivered' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'itemCode' => $item->item_code,
                'description' => $item->description,
                'poQuantity' => $item->po_quantity,
                'deliveredQuantity' => $item->delivered_quantity,
                'condition' => $item->condition,
                'result' => $item->result,
                'remarks' => $item->remarks,
            ])->values(), []),
        ];
    }
}
