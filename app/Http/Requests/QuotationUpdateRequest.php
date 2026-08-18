<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class QuotationUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'unitPrice' => ['required', 'numeric', 'min:0'],
            'warranty' => ['nullable', 'string', 'max:255'],
            'warrantyMonths' => ['nullable', 'integer', 'min:1', 'max:120'],
            'warrantyFile' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'deliveryTimeDays' => ['nullable', 'integer', 'min:0'],
            'paymentTerms' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
