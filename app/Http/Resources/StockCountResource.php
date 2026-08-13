<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\StockCount */
class StockCountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->count_number,
            'title' => $this->title,
            'date' => optional($this->count_date)?->format('Y-m-d'),
            'location' => $this->location,
            'status' => $this->status,
            'totalItemsAudited' => $this->total_items_audited,
            'discrepancyCount' => $this->discrepancy_count,
            'items' => $this->items->map(fn ($item) => [
                'itemCode' => $item->item_code,
                'itemName' => $item->item_name,
                'systemQty' => $item->system_qty,
                'actualQty' => $item->actual_qty,
                'variance' => $item->variance,
                'notes' => $item->notes,
            ])->values(),
        ];
    }
}
