<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VendorMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $rules = [
            'body' => ['required', 'string', 'max:2000'],
        ];

        if ($this->user()?->isInternal()) {
            $rules['supplier'] = ['required', 'string', 'exists:suppliers,code'];
        }

        return $rules;
    }
}
