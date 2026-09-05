<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VendorCredentialReplaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'expirationDate' => ['nullable', 'date', 'after:today'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Choose a replacement file.',
            'file.mimes' => 'Upload a PDF, JPG, PNG, or WebP file.',
            'expirationDate.after' => 'The business permit must still be valid.',
        ];
    }
}
