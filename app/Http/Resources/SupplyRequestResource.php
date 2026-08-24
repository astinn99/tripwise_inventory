<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\SupplyRequest */
class SupplyRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $imageUrl = ($this->relationLoaded('catalogItem') ? $this->catalogItem?->imageUrl() : null)
            ?? ($this->relationLoaded('inventoryItem') ? $this->inventoryItem?->imageUrl() : null);

        return [
            'id' => $this->request_number ?: (string) $this->id,
            'requestingDepartment' => $this->requesting_department ?: '',
            'itemCode' => $this->item_code ?: '',
            'itemName' => $this->item_name ?: '',
            'imageUrl' => $imageUrl,
            'category' => $this->category,
            'quantityRequested' => $this->quantity_requested,
            'requiredDate' => optional($this->required_date)?->format('Y-m-d'),
            'priority' => $this->priority ?: 'MEDIUM',
            'stockAvailability' => $this->stock_availability ?: 'Pending',
            'status' => $this->status === 'Received' ? 'Pending' : ($this->status ?: 'Pending'),
            'requestedBy' => $this->requested_by,
            'purpose' => $this->purpose,
            'dateReceived' => optional($this->date_received)?->format('Y-m-d'),
            'actionLogs' => $this->whenLoaded('logs', fn () => $this->logs->map(fn ($log) => [
                'date' => $log->logged_at,
                'note' => $log->note,
            ])->values(), []),
            'createdProcurement' => $this->when(
                $this->relationLoaded('procurementRequests') && $this->procurementRequests->isNotEmpty(),
                function () use ($imageUrl) {
                    $pr = $this->procurementRequests->sortByDesc('id')->first();

                    return [
                        'id' => $pr->pr_number,
                        'sourceRequest' => $pr->source_request,
                        'department' => $pr->department,
                        'itemCode' => $pr->item_code,
                        'itemName' => $pr->item_name,
                        'imageUrl' => $imageUrl,
                        'quantity' => $pr->quantity,
                        'reason' => $pr->reason,
                        'priority' => $pr->priority,
                        'status' => $pr->status,
                        'dateCreated' => optional($pr->date_created)?->format('Y-m-d'),
                        'estimatedCost' => (float) $pr->estimated_cost,
                        'selectedSupplier' => $pr->selected_supplier,
                        'poNumber' => $pr->po_number,
                        'vendorInviteCount' => 0,
                        'canEdit' => true,
                        'sentToVendors' => false,
                    ];
                }
            ),
        ];
    }
}
