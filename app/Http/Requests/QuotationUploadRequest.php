<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class QuotationUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Query-string fallbacks stay so older chunked GET clients and
     * `php artisan serve` still work if a POST body is dropped.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'step' => $this->query('step', $this->input('step', $this->input('action'))),
            'kind' => $this->query('kind', $this->input('kind')),
            'fileName' => $this->query('fileName', $this->input('fileName')),
            'uploadId' => $this->query('uploadId', $this->input('uploadId')),
            'chunkBase64' => $this->query('chunk') ?: $this->input('chunkBase64') ?: $this->input('chunk'),
        ]);
    }

    public function rules(): array
    {
        $step = $this->input('step');

        return match ($step) {
            'start' => [
                'step' => ['required', 'string', Rule::in(['start'])],
                'kind' => ['required', 'string', Rule::in(['photo', 'warranty'])],
                'fileName' => ['required', 'string', 'max:255'],
            ],
            'chunk' => [
                'step' => ['required', 'string', Rule::in(['chunk'])],
                'uploadId' => ['required', 'string', 'size:32'],
                'chunkBase64' => ['required', 'string'],
            ],
            'finish' => [
                'step' => ['required', 'string', Rule::in(['finish'])],
                'uploadId' => ['required', 'string', 'size:32'],
            ],
            'complete' => [
                'step' => ['required', 'string', Rule::in(['complete'])],
                'kind' => ['required', 'string', Rule::in(['photo', 'warranty'])],
                'fileName' => ['required', 'string', 'max:255'],
                'file' => ['nullable', 'file', 'max:10240'],
                'chunkBase64' => ['nullable', 'string'],
            ],
            default => [
                'step' => ['required', 'string', Rule::in(['start', 'chunk', 'finish', 'complete'])],
            ],
        };
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if ($this->input('step') !== 'complete') {
                return;
            }

            if ($this->file('file') || $this->filled('chunkBase64')) {
                return;
            }

            $validator->errors()->add('file', 'Attach a file to upload.');
        });
    }
}
