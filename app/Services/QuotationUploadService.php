<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

class QuotationUploadService
{
    public function start(User $user, string $kind, string $fileName): array
    {
        $this->assertKind($kind);

        $uploadId = bin2hex(random_bytes(16));
        $this->writeMeta($uploadId, [
            'id' => $uploadId,
            'user_id' => $user->id,
            'kind' => $kind,
            'file_name' => basename($fileName) ?: ($kind === 'warranty' ? 'warranty.pdf' : 'photo.jpg'),
            'bytes' => 0,
        ]);
        file_put_contents($this->partPath($uploadId), '');

        return ['uploadId' => $uploadId];
    }

    public function append(User $user, string $uploadId, string $chunkBase64): void
    {
        $meta = $this->readOwnedMeta($uploadId, $user);
        $chunk = base64_decode($chunkBase64, true);

        if ($chunk === false || $chunk === '') {
            throw ValidationException::withMessages([
                'chunkBase64' => ['The file chunk could not be processed.'],
            ]);
        }

        $maxBytes = $meta['kind'] === 'warranty' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
        if (($meta['bytes'] + strlen($chunk)) > $maxBytes) {
            throw ValidationException::withMessages([
                'chunkBase64' => ['The file is larger than the allowed limit.'],
            ]);
        }

        file_put_contents($this->partPath($uploadId), $chunk, FILE_APPEND);
        $meta['bytes'] += strlen($chunk);
        $this->writeMeta($uploadId, $meta);
    }

    public function finish(User $user, string $uploadId): array
    {
        $meta = $this->readOwnedMeta($uploadId, $user);
        $part = $this->partPath($uploadId);

        if (($meta['bytes'] ?? 0) < 1 || ! is_file($part)) {
            throw ValidationException::withMessages([
                'uploadId' => ['The file upload is empty.'],
            ]);
        }

        $contents = (string) file_get_contents($part);
        @unlink($part);
        @unlink($this->metaPath($uploadId));

        return $this->storeCompleted($user, $meta['kind'], $meta['file_name'], $contents);
    }

    public function complete(User $user, string $kind, string $fileName, string $contents): array
    {
        $this->assertKind($kind);

        return $this->storeCompleted($user, $kind, $fileName, $contents);
    }

    public function completeFromUpload(User $user, string $kind, UploadedFile $file): array
    {
        $path = $file->getRealPath();
        $contents = ($path !== false && is_file($path)) ? (string) file_get_contents($path) : '';

        return $this->complete(
            $user,
            $kind,
            $file->getClientOriginalName() ?: ($kind === 'warranty' ? 'warranty.pdf' : 'photo.jpg'),
            $contents
        );
    }

    public function toUploadedFile(string $token, User $user, string $errorKey): UploadedFile
    {
        $meta = $this->readJson($this->tokenMetaPath($token));
        if (! $meta || (int) ($meta['user_id'] ?? 0) !== (int) $user->id || empty($meta['path']) || ! is_file($meta['path'])) {
            throw ValidationException::withMessages([
                $errorKey => ['The uploaded file could not be found. Please attach it again.'],
            ]);
        }

        return new UploadedFile($meta['path'], $meta['file_name'] ?? 'upload.bin', null, null, true);
    }

    /**
     * @param  list<string>  $tokens
     * @return list<UploadedFile>
     */
    public function photosFromTokens(mixed $tokens, User $user): array
    {
        if (! is_array($tokens)) {
            return [];
        }

        $files = [];
        foreach (array_values($tokens) as $index => $token) {
            if (! is_string($token) || $token === '') {
                continue;
            }
            $files[] = $this->toUploadedFile($token, $user, 'itemPhotos.'.$index);
        }

        return $files;
    }

    private function storeCompleted(User $user, string $kind, string $fileName, string $contents): array
    {
        $maxBytes = $kind === 'warranty' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
        if ($contents === '' || strlen($contents) > $maxBytes) {
            throw ValidationException::withMessages([
                'file' => [$contents === '' ? 'The file upload is empty.' : 'The file is larger than the allowed limit.'],
            ]);
        }

        $token = bin2hex(random_bytes(16));
        $safeName = basename($fileName) ?: ($kind === 'warranty' ? 'warranty.pdf' : 'photo.jpg');
        $final = $this->tokenPath($token, $this->extension($safeName, $kind));
        file_put_contents($final, $contents);

        $this->writeJson($this->tokenMetaPath($token), [
            'token' => $token,
            'user_id' => $user->id,
            'kind' => $kind,
            'file_name' => $safeName,
            'path' => $final,
        ]);

        return [
            'token' => $token,
            'kind' => $kind,
            'fileName' => $safeName,
        ];
    }

    private function assertKind(string $kind): void
    {
        if (! in_array($kind, ['photo', 'warranty'], true)) {
            throw ValidationException::withMessages([
                'kind' => ['Upload kind must be photo or warranty.'],
            ]);
        }
    }

    /** @return array<string, mixed> */
    private function readOwnedMeta(string $uploadId, User $user): array
    {
        $meta = $this->readJson($this->metaPath($uploadId));
        if (! $meta || (int) ($meta['user_id'] ?? 0) !== (int) $user->id) {
            throw ValidationException::withMessages([
                'uploadId' => ['The upload session is invalid.'],
            ]);
        }

        return $meta;
    }

    private function extension(string $fileName, string $kind): string
    {
        $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION) ?: '');
        $allowed = $kind === 'warranty'
            ? ['pdf', 'jpg', 'jpeg', 'png', 'webp']
            : ['jpg', 'jpeg', 'png', 'webp'];

        if (! in_array($extension, $allowed, true)) {
            return $kind === 'warranty' ? 'pdf' : 'jpg';
        }

        return $extension;
    }

    private function directory(): string
    {
        $directory = storage_path('app/tmp/quote-uploads');
        if (! is_dir($directory)) {
            mkdir($directory, 0755, true);
        }

        return $directory;
    }

    private function metaPath(string $uploadId): string
    {
        return $this->directory().DIRECTORY_SEPARATOR.$uploadId.'.json';
    }

    private function partPath(string $uploadId): string
    {
        return $this->directory().DIRECTORY_SEPARATOR.$uploadId.'.part';
    }

    private function tokenPath(string $token, string $extension): string
    {
        return $this->directory().DIRECTORY_SEPARATOR.$token.'.'.$extension;
    }

    private function tokenMetaPath(string $token): string
    {
        return $this->directory().DIRECTORY_SEPARATOR.$token.'.json';
    }

    /** @param  array<string, mixed>  $meta */
    private function writeMeta(string $uploadId, array $meta): void
    {
        $this->writeJson($this->metaPath($uploadId), $meta);
    }

    /** @return array<string, mixed>|null */
    private function readJson(string $path): ?array
    {
        if (! is_file($path)) {
            return null;
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return is_array($decoded) ? $decoded : null;
    }

    /** @param  array<string, mixed>  $payload */
    private function writeJson(string $path, array $payload): void
    {
        file_put_contents($path, json_encode($payload));
    }
}
