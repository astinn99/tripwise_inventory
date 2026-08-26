<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Supplier */
class SupplierResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->code,
            'companyName' => $this->company_name,
            'contactPerson' => $this->contact_person,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'status' => $this->status,
            'rating' => (float) $this->rating,
            'qualityScore' => $this->quality_score,
            'responsivenessScore' => $this->responsiveness_score,
            'deliveryPerformance' => $this->delivery_performance,
            'pricingScore' => $this->pricing_score,
            'overallScore' => (float) $this->overall_score,
            'categories' => $this->categories ?? [],
            'taxId' => $this->tax_id,
            'secRegistration' => $this->sec_registration,
            'bankDetails' => $this->bank_details,
            'activeOrders' => $this->active_orders,
            'credentials' => $this->credentialsPayload(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function credentialsPayload(): array
    {
        $documents = $this->relationLoaded('documents')
            ? $this->documents
            : $this->documents()->orderByDesc('id')->get();

        return $documents->map(fn ($doc) => [
            'id' => $doc->document_number,
            'title' => $doc->title,
            'type' => $doc->type,
            'referenceNumber' => $doc->reference_number,
            'expirationDate' => optional($doc->expiration_date)?->format('Y-m-d'),
            'status' => $doc->resolveStatus(),
            'fileUrl' => $doc->fileUrl(),
            'downloadUrl' => '/api/documents/'.$doc->document_number.'/download',
            'originalFilename' => $doc->original_filename,
            'fileSize' => $doc->file_size,
        ])->values()->all();
    }
}
