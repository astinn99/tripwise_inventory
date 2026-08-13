<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DocumentStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isInternal() === true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'max:64'],
            'referenceNumber' => ['nullable', 'string', 'max:128'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'issueDate' => ['nullable', 'date'],
            'expirationDate' => ['nullable', 'date'],
            'category' => ['nullable', 'string', 'max:128'],
            'status' => ['nullable', 'string', 'max:32'],
            'fileSize' => ['nullable', 'string', 'max:32'],
        ];
    }
}
