<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VendorRegisterRequest extends FormRequest
{
    public const CATEGORIES = [
        'Office Supplies',
        'Communication Devices',
        'Maintenance Tools',
        'Fleet Consumables',
    ];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $categories = $this->input('categories', []);

        if (is_string($categories)) {
            $categories = array_map('trim', explode(',', $categories));
        }

        $this->merge([
            'categories' => array_values(array_filter((array) $categories)),
            'email' => strtolower(trim((string) $this->input('email', ''))),
        ]);
    }

    public function rules(): array
    {
        return [
            'companyName' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:2000'],
            'categories' => ['required', 'array', 'min:1'],
            'categories.*' => ['required', 'string', Rule::in(self::CATEGORIES)],
            'contactPerson' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:64'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'taxId' => ['required', 'string', 'max:64'],
            'secRegistration' => ['required', 'string', 'max:128'],
            'bankName' => ['required', 'string', 'max:255'],
            'accountName' => ['required', 'string', 'max:255'],
            'accountNumber' => ['required', 'string', 'max:64'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'businessPermitFile' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'businessPermitExpiresOn' => ['required', 'date', 'after:today'],
            'secCertificateFile' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.unique' => 'An account with this email already exists.',
            'categories.required' => 'Select at least one supply category you can serve.',
            'businessPermitFile.required' => 'Upload a scanned business permit.',
            'secCertificateFile.required' => 'Upload a scanned SEC or DTI certificate.',
            'businessPermitExpiresOn.after' => 'The business permit must still be valid.',
        ];
    }
}
