<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

class Base64Upload
{
    /**
     * @param  list<string>  $allowedExtensions
     */
    public static function file(
        mixed $base64,
        mixed $filename,
        string $errorKey,
        int $maxBytes,
        array $allowedExtensions,
        string $fallbackExtension,
        string $tempPrefix = 'upload_'
    ): ?UploadedFile {
        if (! is_string($base64) || trim($base64) === '') {
            return null;
        }

        if (str_contains($base64, ',')) {
            $base64 = substr($base64, strrpos($base64, ',') + 1);
        }

        $contents = base64_decode($base64, true);
        if ($contents === false || $contents === '') {
            throw ValidationException::withMessages([
                $errorKey => ['The file could not be processed.'],
            ]);
        }

        if (strlen($contents) > $maxBytes) {
            throw ValidationException::withMessages([
                $errorKey => ['The file may not be greater than '.round($maxBytes / 1048576).' MB.'],
            ]);
        }

        $name = is_string($filename) && $filename !== ''
            ? basename($filename)
            : 'upload.'.$fallbackExtension;
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION) ?: $fallbackExtension);
        if (! in_array($extension, $allowedExtensions, true)) {
            $extension = $fallbackExtension;
            $name = pathinfo($name, PATHINFO_FILENAME).'.'.$fallbackExtension;
        }

        $directory = storage_path('app/tmp');
        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        $path = $directory.DIRECTORY_SEPARATOR.uniqid($tempPrefix, true).'.'.$extension;
        file_put_contents($path, $contents);

        return new UploadedFile($path, $name, null, null, true);
    }

    /**
     * @param  mixed  $payloads
     * @param  mixed  $names
     * @return list<UploadedFile>
     */
    public static function photos(mixed $payloads, mixed $names = []): array
    {
        if (! is_array($payloads)) {
            return [];
        }

        $names = is_array($names) ? $names : [];
        $files = [];

        foreach (array_values($payloads) as $index => $base64) {
            $file = self::file(
                $base64,
                $names[$index] ?? 'photo.jpg',
                'itemPhotos.'.$index,
                5 * 1024 * 1024,
                ['jpg', 'jpeg', 'png', 'webp'],
                'jpg',
                'quote_photo_'
            );

            if ($file instanceof UploadedFile) {
                $files[] = $file;
            }
        }

        return $files;
    }
}
