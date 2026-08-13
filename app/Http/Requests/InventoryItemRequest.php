<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InventoryItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isInternal() === true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('itemName') && ! $this->filled('description')) {
            $this->merge(['description' => $this->input('itemName')]);
        }

        if (! $this->filled('itemCode')) {
            $this->merge(['itemCode' => null]);
        }
    }

    public function rules(): array
    {
        $item = $this->route('inventoryItem');

        return [
            'itemName' => ['nullable', 'string', 'max:255'],
            'itemCode' => ['nullable', 'string', 'max:64', Rule::unique('inventory_items', 'item_code')->ignore($item?->id)],
            'description' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:128'],
            'quantity' => ['required', 'integer', 'min:0'],
            'minStockLevel' => ['required', 'integer', 'min:0'],
            'unit' => ['nullable', 'string', 'max:64'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'cost' => ['required', 'numeric', 'min:0'],
            'location' => ['nullable', 'string', 'max:255'],
            'serialNumber' => ['nullable', 'string', 'max:128'],
            'warranty' => ['nullable', 'string', 'max:255'],
            'condition' => ['nullable', 'string', 'max:64'],
        ];
    }
}
