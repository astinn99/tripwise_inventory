<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureInternalUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isInternal()) {
            return response()->json([
                'success' => false,
                'message' => 'This action is restricted to internal staff.',
                'errors' => [],
            ], 403);
        }

        return $next($request);
    }
}
