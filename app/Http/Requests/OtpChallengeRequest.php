<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OtpChallengeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'challengeId' => ['required', 'uuid'],
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ];
    }
}
