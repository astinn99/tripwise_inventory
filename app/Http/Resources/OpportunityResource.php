<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SupplierOpportunity */
class OpportunityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $pr = $this->procurementRequest;

        return [
            'id' => $this->opportunity_number,
            'prNumber' => $this->pr_number,
            'title' => $this->title,
            'itemName' => $pr?->item_name ?? $this->title,
            'itemCode' => $pr?->item_code ?? '',
            'category' => $this->category,
            'quantity' => $this->quantity,
            'priority' => $pr?->priority,
            'deadline' => optional($this->deadline)?->format('Y-m-d'),
            'budgetRange' => $this->budget_range,
            'status' => $this->status,
            'requirements' => $this->requirements,
        ];
    }
}
