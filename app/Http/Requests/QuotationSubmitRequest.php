<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\HydratesQuotationUploads;
use Illuminate\Foundation\Http\FormRequest;

class QuotationSubmitRequest extends FormRequest
{
    use HydratesQuotationUploads;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        foreach ([
            'procurementId', 'item', 'quantity', 'unitPrice', 'totalPrice',
            'warranty', 'warrantyMonths', 'warrantyToken', 'warrantyFileName',
            'deliveryTimeDays', 'qualityRating', 'paymentTerms', 'notes',
            'supplierId', 'supplierName',
        ] as $field) {
            if (! $this->filled($field) && $this->query->has($field)) {
                $this->merge([$field => $this->query($field)]);
            }
        }

        if (! $this->filled('itemPhotoTokens') && $this->query->has('itemPhotoTokens')) {
            $this->merge(['itemPhotoTokens' => array_values((array) $this->query('itemPhotoTokens'))]);
        }

        $this->hydrateQuotationUploads();
    }

    public function rules(): array
    {
        return [
            'procurementId' => ['required', 'string', 'exists:procurement_requests,pr_number'],
            'supplierId' => ['nullable', 'string'],
            'supplierName' => ['nullable', 'string'],
            'item' => ['required', 'string'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unitPrice' => ['required', 'numeric', 'min:0'],
            'totalPrice' => ['required', 'numeric', 'min:0'],
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
            'itemPhotos' => ['required', 'array', 'min:1', 'max:3'],
            'itemPhotos.*' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
            'deliveryTimeDays' => ['nullable', 'integer', 'min:0'],
            'qualityRating' => ['nullable', 'numeric', 'min:0', 'max:5'],
            'paymentTerms' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'itemPhotos.required' => 'Attach 1 to 3 photos of the actual item you are offering.',
            'itemPhotos.min' => 'Attach at least 1 photo of the actual item you are offering.',
            'itemPhotos.max' => 'You can attach a maximum of 3 item photos.',
            'itemPhotos.*.image' => 'Item photos must be image files (JPG, PNG or WEBP).',
            'itemPhotos.*.mimes' => 'Item photos must be JPG, PNG or WEBP files.',
            'itemPhotos.*.max' => 'Each item photo may not be larger than 5 MB.',
            'itemPhotos.*.uploaded' => 'A photo exceeded the server upload limit and was rejected. Please choose a smaller image.',
            'warrantyFile.uploaded' => 'The warranty certificate exceeded the server upload limit. Please attach a smaller file.',
        ];
    }
}
