<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Document */
class DocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->document_number,
            'title' => $this->title,
            'type' => $this->type,
            'referenceNumber' => $this->reference_number,
            'supplier' => $this->relationLoaded('supplierAccount')
                ? ($this->supplierAccount?->company_name ?? $this->supplier)
                : $this->supplier,
            'supplierId' => $this->supplier_id,
            'issueDate' => optional($this->issue_date)?->format('Y-m-d'),
            'expirationDate' => optional($this->expiration_date)?->format('Y-m-d'),
            'status' => $this->resolveStatus(),
            'daysRemaining' => $this->daysRemaining(),
            'category' => $this->category,
            'fileSize' => $this->file_size,
            'fileUrl' => $this->fileUrl(),
            'originalFilename' => $this->original_filename,
            'source' => $this->source,
            'warrantyMonths' => $this->warranty_months,
            'itemCode' => $this->relationLoaded('inventoryItem') ? $this->inventoryItem?->item_code : null,
            'purchaseOrderNumber' => $this->relationLoaded('purchaseOrder') ? $this->purchaseOrder?->po_number : null,
        ];
    }
}
