<?php

namespace App\Http\Resources;

use App\Support\Priority;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ProcurementRequest */
class ProcurementRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $quoteDeadline = $this->opportunities_min_deadline
            ?? ($this->relationLoaded('opportunities')
                ? optional($this->opportunities->min('deadline'))?->format('Y-m-d')
                : null);
        if ($quoteDeadline instanceof \DateTimeInterface) {
            $quoteDeadline = $quoteDeadline->format('Y-m-d');
        } elseif (is_string($quoteDeadline) && $quoteDeadline !== '') {
            $quoteDeadline = substr($quoteDeadline, 0, 10);
        } else {
            $quoteDeadline = $quoteDeadline ?: null;
        }

        $rfqOverdue = $quoteDeadline
            && $quoteDeadline < now()->toDateString()
            && (int) ($this->quotations_count ?? 0) === 0
            && ! filled($this->po_number)
            && ! filled($this->selected_supplier);

        return [
            'id' => $this->pr_number,
            'sourceRequest' => $this->source_request,
            'department' => $this->department,
            'itemCode' => $this->item_code,
            'itemName' => $this->item_name,
            'imageUrl' => $this->relationLoaded('catalogItem') ? $this->catalogItem?->imageUrl() : null,
            'quantity' => $this->quantity,
            'reason' => $this->reason,
            'priority' => Priority::normalize($this->priority),
            'neededInDays' => Priority::neededInDays($this->priority, $this->needed_in_days),
            'quoteWindowDays' => Priority::quoteDays($this->priority),
            'status' => $this->status,
            'dateCreated' => optional($this->date_created)?->format('Y-m-d'),
            'estimatedCost' => (float) $this->estimated_cost,
            'selectedSupplier' => $this->selected_supplier,
            'poNumber' => $this->po_number,
            'vendorInviteCount' => (int) ($this->opportunities_count ?? 0),
            'quoteCount' => (int) ($this->quotations_count ?? 0),
            'quoteDeadline' => $quoteDeadline,
            'rfqOverdue' => $rfqOverdue,
            'canEdit' => $this->status === 'For Procurement' && ! $this->po_number,
            'sentToVendors' => $this->status !== 'For Procurement' || ((int) ($this->opportunities_count ?? 0) > 0),
        ];
    }
}
