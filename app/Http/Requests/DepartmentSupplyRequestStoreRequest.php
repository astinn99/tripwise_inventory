<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DepartmentSupplyRequestStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'itemCode' => ['required', 'string', 'max:64', Rule::exists('inventory_items', 'item_code')->whereNull('deleted_at')],
            'quantity' => ['required', 'integer', 'min:1'],
            'requestingDepartment' => ['required', 'string', 'max:255'],
            'requestedBy' => ['required', 'string', 'max:255'],
            'requiredDate' => ['nullable', 'date'],
            'priority' => ['nullable', 'string', Rule::in(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])],
            'purpose' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
