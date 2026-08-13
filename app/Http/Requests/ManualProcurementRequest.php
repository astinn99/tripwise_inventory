<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ManualProcurementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isInternal() === true;
    }

    public function rules(): array
    {
        return [
            'itemCode' => ['required', 'string', 'exists:inventory_items,item_code'],
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:2000'],
            'priority' => ['required', 'string', 'max:32'],
        ];
    }
}
