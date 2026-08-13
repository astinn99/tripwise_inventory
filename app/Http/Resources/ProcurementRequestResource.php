<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ProcurementRequest */
class ProcurementRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->pr_number,
            'sourceRequest' => $this->source_request,
            'department' => $this->department,
            'itemCode' => $this->item_code,
            'itemName' => $this->item_name,
            'quantity' => $this->quantity,
            'reason' => $this->reason,
            'priority' => $this->priority,
            'status' => $this->status,
            'dateCreated' => optional($this->date_created)?->format('Y-m-d'),
            'estimatedCost' => (float) $this->estimated_cost,
            'selectedSupplier' => $this->selected_supplier,
            'poNumber' => $this->po_number,
            'vendorInviteCount' => $this->opportunities_count ?? $this->opportunities()->count(),
        ];
    }
}
