<?php

namespace App\Http\Requests;

use App\Services\ForecastService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ForecastRefreshRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isInternal() === true;
    }

    public function rules(): array
    {
        return [
            'itemCode' => ['required', 'string', 'max:64', Rule::exists('inventory_items', 'item_code')],
            'horizon' => ['nullable', 'integer', 'min:7', 'max:90'],
        ];
    }

    public function horizon(): int
    {
        return (int) ($this->validated('horizon') ?? ForecastService::DEFAULT_HORIZON);
    }
}
