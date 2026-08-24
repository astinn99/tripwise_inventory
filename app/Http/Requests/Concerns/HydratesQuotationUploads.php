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

        if (! $this->file('warrantyFile') && is_string($this->input('warrantyToken')) && $this->input('warrantyToken') !== '') {
            $this->files->set(
                'warrantyFile',
                $uploads->toUploadedFile($this->input('warrantyToken'), $user, 'warrantyFile')
            );
        }

        if (! $this->file('warrantyFile')) {
            $warranty = Base64Upload::file(
                $this->input('warrantyFileBase64'),
                $this->input('warrantyFileName'),
                'warrantyFile',
                10 * 1024 * 1024,
                ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
                'pdf',
                'warranty_'
            );
            if ($warranty) {
                $this->files->set('warrantyFile', $warranty);
            }
        }
    }
}
