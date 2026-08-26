<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DocumentStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isInternal() === true;
    }

    public function rules(): array
    {
        $requiresExpiry = in_array($this->input('type'), ['Warranty', 'Insurance', 'Contract', 'Business Permit'], true);

        return [
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', Rule::in([
                'Warranty', 'Insurance', 'Contract', 'Purchase Order', 'Invoice', 'Inspection Report',
                'Business Permit', 'SEC/DTI Registration',
            ])],
            'referenceNumber' => ['nullable', 'string', 'max:128'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'supplierId' => ['nullable', 'string', 'max:64'],
            'issueDate' => ['nullable', 'date'],
            'expirationDate' => [$requiresExpiry ? 'required' : 'nullable', 'date'],
            'category' => ['nullable', 'string', 'max:128'],
            'itemCode' => ['nullable', 'string', 'exists:inventory_items,item_code'],
            'purchaseOrderNumber' => ['nullable', 'string', 'exists:purchase_orders,po_number'],
            'warrantyMonths' => ['nullable', 'integer', 'min:1', 'max:120'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
        ];
    }
}
