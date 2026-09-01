<?php

namespace App\Http\Resources;

use App\Support\Priority;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SupplierOpportunity */
class OpportunityResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $pr = $this->relationLoaded('procurementRequest') ? $this->procurementRequest : null;
        $catalog = $pr?->relationLoaded('catalogItem') ? $pr->catalogItem : null;
        $priority = Priority::normalize($pr?->priority);
        $deadline = optional($this->deadline)?->format('Y-m-d');
        $neededInDays = Priority::neededInDays($priority, $pr?->needed_in_days);
        $neededBy = $this->created_at
            ? $this->created_at->copy()->startOfDay()->addDays($neededInDays)->format('Y-m-d')
            : $deadline;

        return [
            'id' => $this->opportunity_number,
            'prNumber' => $this->pr_number,
            'title' => $this->title,
            'itemName' => $pr?->item_name ?? $this->title,
            'itemCode' => $pr?->item_code ?? '',
            'imageUrl' => $catalog?->imageUrl(),
            'category' => $this->category,
            'quantity' => $this->quantity,
            'priority' => $priority,
            'deadline' => $deadline,
            'neededBy' => $neededBy,
            'neededInDays' => $neededInDays,
            'quoteWindowDays' => Priority::quoteDays($priority),
            'preferredMaxDeliveryDays' => $neededInDays,
            'isOverdue' => $deadline !== null && $deadline < now()->toDateString(),
            'budgetRange' => $this->budget_range,
            'status' => $this->status,
            'requirements' => $this->requirements,
        ];
    }
}
