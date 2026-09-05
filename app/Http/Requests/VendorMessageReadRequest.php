<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VendorMessageReadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        if ($this->user()?->isInternal()) {
            return [
                'supplier' => ['required', 'string', 'exists:suppliers,code'],
            ];
        }

        return [];
    }
}
