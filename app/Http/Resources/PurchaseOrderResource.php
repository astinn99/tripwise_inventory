<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\PurchaseOrder */
class PurchaseOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'poNumber' => $this->po_number,
            'procurementId' => $this->procurementRequest?->pr_number,
            'supplierId' => $this->supplierAccount?->code,
            'supplier' => $this->supplier,
            'contactPerson' => $this->contact_person,
            'items' => $this->when($this->relationLoaded('items'), fn () => $this->items->map(fn ($item) => [
                'itemCode' => $item->item_code,
                'description' => $item->description,
                'quantity' => $item->quantity,
                'unitPrice' => (float) $item->unit_price,
                'total' => (float) $item->total,
                'deliveredQty' => $item->delivered_qty,
            ])->values()),
            'totalCost' => (float) $this->total_cost,
            'budgetReference' => $this->budget_reference,
            'paymentTerms' => $this->payment_terms,
            'procurementReason' => $this->procurement_reason,
            'deliveryDate' => $this->delivery_date,
            'warranty' => $this->warranty,
            'warrantyMonths' => $this->warranty_months,
            'warrantyLabel' => \App\Support\WarrantyDuration::label($this->warranty_months, $this->warranty),
            'warrantyFileUrl' => $this->warranty_file_path ? '/storage/'.$this->warranty_file_path : null,
            'financeApprovalStatus' => $this->finance_approval_status,
            'poStatus' => $this->po_status,
            'createdDate' => optional($this->created_date)?->format('Y-m-d'),
            'approver' => $this->approver,
            'financeRemarks' => $this->finance_remarks,
            'timeline' => $this->when($this->relationLoaded('timeline'), fn () => $this->timeline->map(fn ($step) => [
                'step' => $step->step,
                'date' => $step->step_date,
                'status' => $step->status,
            ])->values()),
        ];
    }
}
