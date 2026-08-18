<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorageLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canOperateWarehouse() === true;
    }

    public function rules(): array
    {
        return [
            'rack' => ['required', 'string', 'max:64'],
            'shelf' => ['required', 'string', 'max:64'],
            'bin' => [
                'required',
                'string',
                'max:64',
                Rule::unique('storage_locations', 'bin')->where(fn ($query) => $query
                    ->where('rack', $this->input('rack'))
                    ->where('shelf', $this->input('shelf'))),
            ],
            'category' => ['nullable', 'string', 'max:128'],
            'maxCapacity' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
