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
        ];
    }
}
