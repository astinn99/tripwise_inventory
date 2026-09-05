<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VendorProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $categories = $this->input('categories', []);

        if (is_string($categories)) {
            $categories = array_map('trim', explode(',', $categories));
        }

        $this->merge([
            'categories' => array_values(array_filter((array) $categories)),
        ]);
    }

    public function rules(): array
    {
        return [
            'companyName' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:2000'],
            'categories' => ['required', 'array', 'min:1'],
            'categories.*' => ['required', 'string', Rule::in(VendorRegisterRequest::CATEGORIES)],
            'contactPerson' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:64'],
            'taxId' => ['required', 'string', 'max:64'],
            'secRegistration' => ['required', 'string', 'max:128'],
            'bankName' => ['required', 'string', 'max:255'],
            'accountName' => ['required', 'string', 'max:255'],
            'accountNumber' => ['required', 'string', 'max:64'],
        ];
    }

    public function messages(): array
    {
        return [
            'categories.required' => 'Select at least one supply category you can serve.',
        ];
    }
}
