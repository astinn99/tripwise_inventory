<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InspectDeliveryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canOperateWarehouse() === true;
    }

    public function rules(): array
    {
        return [
            'inspectionResult' => ['required', Rule::in(['Passed', 'Partial', 'Failed'])],
            'remarks' => ['nullable', 'string', 'max:2000'],
            'itemsDelivered' => ['required', 'array', 'min:1'],
            'itemsDelivered.*.itemCode' => ['required', 'string'],
            'itemsDelivered.*.description' => ['nullable', 'string'],
            'itemsDelivered.*.deliveredQuantity' => ['required', 'integer', 'min:0'],
            'itemsDelivered.*.condition' => ['nullable', 'string'],
            'itemsDelivered.*.result' => ['nullable', 'string'],
            'itemsDelivered.*.remarks' => ['nullable', 'string'],
        ];
    }
}
