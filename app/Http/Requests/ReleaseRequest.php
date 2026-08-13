<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReleaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canOperateWarehouse() === true;
    }

    public function rules(): array
    {
        return [
            'releasedTo' => ['nullable', 'string', 'max:255'],
        ];
    }
}
