<?php

namespace App\Http\Requests;

use App\Support\Priority;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProcurementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isInternal() === true;
    }

    public function rules(): array
    {
        return [
            'quantity' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:2000'],
            'priority' => Priority::rule(required: true),
            'neededInDays' => ['nullable', 'integer', 'min:1', 'max:90'],
        ];
    }
}
