<?php

namespace App\Http\Controllers;

use App\Services\SupplyChainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\JsonResource;

abstract class Controller
{
    protected function ok(mixed $data = [], string $message = 'Request successful', int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
        ], $status);
    }

    protected function withRecordedMovements(mixed $resource, SupplyChainService $service): array
    {
        $payload = $resource instanceof JsonResource ? $resource->resolve() : (array) $resource;
        $movements = $service->recordedMovementPayload();
        if ($movements !== []) {
            $payload['createdMovements'] = $movements;
        }
        $release = $service->recordedReleasePayload();
        if ($release !== null) {
            $payload['createdRelease'] = $release;
        }

        return $payload;
    }

    protected function created(mixed $data = [], string $message = 'Resource created'): JsonResponse
    {
        return $this->ok($data, $message, 201);
    }

    protected function fail(string $message = 'Something went wrong', int $status = 400, array $errors = []): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ], $status);
    }
}
