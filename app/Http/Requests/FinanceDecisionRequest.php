<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FinanceDecisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->canApproveFinance() === true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['Finance Approved', 'Finance Rejected', 'Returned for Revision'])],
            'remarks' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
