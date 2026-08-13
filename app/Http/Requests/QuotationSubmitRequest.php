<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class QuotationSubmitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'procurementId' => ['required', 'string', 'exists:procurement_requests,pr_number'],
            'supplierId' => ['nullable', 'string'],
            'supplierName' => ['nullable', 'string'],
            'item' => ['required', 'string'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unitPrice' => ['required', 'numeric', 'min:0'],
            'totalPrice' => ['required', 'numeric', 'min:0'],
            'warranty' => ['nullable', 'string'],
            'deliveryTimeDays' => ['nullable', 'integer', 'min:0'],
            'qualityRating' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'paymentTerms' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
