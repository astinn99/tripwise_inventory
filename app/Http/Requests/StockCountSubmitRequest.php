<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StockCountSubmitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canOperateWarehouse() === true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.itemCode' => ['required', 'string'],
            'items.*.itemName' => ['nullable', 'string'],
            'items.*.systemQty' => ['required', 'integer', 'min:0'],
            'items.*.actualQty' => ['required', 'integer', 'min:0'],
            'items.*.notes' => ['nullable', 'string'],
        ];
    }
}
