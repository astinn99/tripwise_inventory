<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureDepartmentSubsystem
{
    public function handle(Request $request, Closure $next): Response
    {
        $configuredKey = (string) config('services.department.api_key', '');
        $providedKey = $request->bearerToken() ?: (string) $request->header('X-Department-Key', '');

        if ($configuredKey !== '' && $providedKey !== '' && hash_equals($configuredKey, $providedKey)) {
            return $next($request);
        }

        $user = $request->user('sanctum') ?? $request->user();
        if ($user && ($user->isInternal() || $user->tokenCan('department'))) {
            return $next($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'Invalid department API credentials.',
            'errors' => [],
        ], 401);
    }
}
