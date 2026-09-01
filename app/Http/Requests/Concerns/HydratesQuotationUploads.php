<?php

namespace App\Http\Requests\Concerns;

use App\Services\QuotationUploadService;
use App\Support\Base64Upload;

trait HydratesQuotationUploads
{
    protected function hydrateQuotationUploads(): void
    {
        $uploads = app(QuotationUploadService::class);
        $user = $this->user();

        if (! $user) {
            return;
        }

        $photos = $uploads->photosFromTokens($this->input('itemPhotoTokens'), $user);
        if ($photos === []) {
            $photos = Base64Upload::photos($this->input('itemPhotosBase64'), $this->input('itemPhotoNames'));
        }

        if ($photos !== []) {
            $this->files->set('itemPhotos', $photos);
        }

        $this->hydrateNamedDocument(
            $uploads,
            $user,
            'warrantyFile',
            'warrantyToken',
            'warrantyFileBase64',
            'warrantyFileName',
            'warranty_'
        );
        $this->hydrateNamedDocument(
            $uploads,
            $user,
            'manualFile',
            'manualToken',
            'manualFileBase64',
            'manualFileName',
            'manual_'
        );
    }

    private function hydrateNamedDocument(
        QuotationUploadService $uploads,
        $user,
        string $fileKey,
        string $tokenKey,
        string $base64Key,
        string $nameKey,
        string $prefix
    ): void {
        if (! $this->file($fileKey) && is_string($this->input($tokenKey)) && $this->input($tokenKey) !== '') {
            $this->files->set(
                $fileKey,
                $uploads->toUploadedFile($this->input($tokenKey), $user, $fileKey)
            );
        }

        if (! $this->file($fileKey)) {
            $file = Base64Upload::file(
                $this->input($base64Key),
                $this->input($nameKey),
                $fileKey,
                10 * 1024 * 1024,
                ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
                'pdf',
                $prefix
            );
            if ($file) {
                $this->files->set($fileKey, $file);
            }
        }
    }
}
