<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Quotation */
class QuotationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->quote_number,
            'procurementId' => $this->procurementRequest?->pr_number,
            'supplierId' => $this->supplier?->code,
            'supplierName' => $this->supplier_name,
            'item' => $this->item,
            'itemCode' => $this->procurementRequest?->item_code,
            'imageUrl' => $this->procurementRequest?->catalogItem?->imageUrl(),
            'quantity' => $this->quantity,
            'unitPrice' => (float) $this->unit_price,
            'totalPrice' => (float) $this->total_price,
            'warranty' => $this->warranty,
            'warrantyMonths' => $this->warranty_months,
            'warrantyLabel' => \App\Support\WarrantyDuration::label($this->warranty_months, $this->warranty),
            'warrantyFileUrl' => $this->warranty_file_path ? asset('storage/'.$this->warranty_file_path) : null,
            'deliveryTimeDays' => $this->delivery_time_days,
            'qualityRating' => (float) $this->quality_rating,
            'paymentTerms' => $this->payment_terms,
            'status' => $this->status,
            'notes' => $this->notes,
            'canEdit' => $this->canEdit(),
        ];
    }
}
