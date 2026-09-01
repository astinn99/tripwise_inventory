<?php

namespace App\Services;

use App\Http\Resources\UserResource;
use App\Models\User;

class PortalTokenService
{
    private const VENDOR_SESSION_LIMIT = 15;

    private const INTERNAL_SESSION_LIMIT = 5;

    /**
     * @return array<string, mixed>
     */
    public function issue(User $user, string $portal): array
    {
        $this->pruneStalePortalTokens($user, $portal);

        $minutes = (int) (config('sanctum.expiration') ?: 0);
        $expiresAt = $minutes > 0 ? now()->addMinutes($minutes) : null;
        $token = $user->createToken($portal, ['*'], $expiresAt)->plainTextToken;
        $this->capPortalTokens($user, $portal);

        return [
            ...(new UserResource($user))->resolve(),
            'token' => $token,
        ];
    }

    private function pruneStalePortalTokens(User $user, string $portal): void
    {
        $minutes = (int) (config('sanctum.expiration') ?: 0);
        $cutoff = $minutes > 0 ? now()->subMinutes($minutes) : now()->subDays(30);

        $user->tokens()
            ->where('name', $portal)
            ->where(function ($query) use ($cutoff) {
                $query->where('last_used_at', '<', $cutoff)
                    ->orWhere(function ($query) use ($cutoff) {
                        $query->whereNull('last_used_at')
                            ->where('created_at', '<', $cutoff);
                    });
            })
            ->delete();
    }

    private function capPortalTokens(User $user, string $portal): void
    {
        $limit = $portal === 'vendor' ? self::VENDOR_SESSION_LIMIT : self::INTERNAL_SESSION_LIMIT;

        $keep = $user->tokens()
            ->where('name', $portal)
            ->orderByDesc('id')
            ->limit($limit)
            ->pluck('id');

        $user->tokens()
            ->where('name', $portal)
            ->whereNotIn('id', $keep)
            ->delete();
    }
}
