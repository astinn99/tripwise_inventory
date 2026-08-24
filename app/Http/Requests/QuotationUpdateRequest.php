<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\HydratesQuotationUploads;
use Illuminate\Foundation\Http\FormRequest;

class QuotationUpdateRequest extends FormRequest
{
    use HydratesQuotationUploads;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $keep = $this->input('keepItemPhotos');

        if (is_string($keep)) {
            $decoded = json_decode($keep, true);
            $this->merge(['keepItemPhotos' => is_array($decoded) ? $decoded : []]);
        }

        $this->hydrateQuotationUploads();
    }

    public function rules(): array
    {
        return [
            'unitPrice' => ['required', 'numeric', 'min:0'],
            'warranty' => ['nullable', 'string', 'max:255'],
            'warrantyMonths' => ['nullable', 'integer', 'min:1', 'max:120'],
            'warrantyFile' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
            'warrantyFileBase64' => ['nullable', 'string'],
            'warrantyFileName' => ['nullable', 'string', 'max:255'],
            'warrantyToken' => ['nullable', 'string', 'size:32'],
            'itemPhotoTokens' => ['nullable', 'array', 'max:3'],
            'itemPhotoTokens.*' => ['required', 'string', 'size:32'],
            'itemPhotosBase64' => ['nullable', 'array', 'max:3'],
            'itemPhotosBase64.*' => ['required', 'string'],
            'itemPhotoNames' => ['nullable', 'array', 'max:3'],
            'itemPhotoNames.*' => ['nullable', 'string', 'max:255'],
            'itemPhotos' => ['nullable', 'array', 'max:3'],
            'itemPhotos.*' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
            'keepItemPhotos' => ['nullable', 'array', 'max:3'],
            'keepItemPhotos.*' => ['required', 'string', 'max:255'],
            'deliveryTimeDays' => ['nullable', 'integer', 'min:0'],
            'paymentTerms' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'itemPhotos.max' => 'You can attach a maximum of 3 item photos.',
            'itemPhotos.*.image' => 'Item photos must be image files (JPG, PNG or WEBP).',
            'itemPhotos.*.mimes' => 'Item photos must be JPG, PNG or WEBP files.',
            'itemPhotos.*.max' => 'Each item photo may not be larger than 5 MB.',
            'itemPhotos.*.uploaded' => 'A photo exceeded the server upload limit and was rejected. Please choose a smaller image.',
            'warrantyFile.uploaded' => 'The warranty certificate exceeded the server upload limit. Please attach a smaller file.',
        ];
    }
}
