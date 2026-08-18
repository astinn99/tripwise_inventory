<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MoveInventoryItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canOperateWarehouse() === true;
    }

    public function rules(): array
    {
        return [
            'storageLocationId' => ['nullable', 'integer', 'exists:storage_locations,id'],
        ];
    }
}
