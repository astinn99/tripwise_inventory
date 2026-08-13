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
            'supplier' => $this->supplier,
            'issueDate' => optional($this->issue_date)?->format('Y-m-d'),
            'expirationDate' => optional($this->expiration_date)?->format('Y-m-d'),
            'status' => $this->resolveStatus(),
            'category' => $this->category,
            'fileSize' => $this->file_size,
        ];
    }
}
