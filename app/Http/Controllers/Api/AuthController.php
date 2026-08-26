<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\TransientToken;

class AuthController extends Controller
{
    public function login(LoginRequest $request)
    {
        $portal = $request->validated('portal') ?: 'internal';

        $email = strtolower(trim((string) $request->validated('email')));

        $user = User::query()
            ->with('supplier:id,code,company_name,status')
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (! $user || ! Hash::check($request->validated('password'), $user->password)) {
            return $this->fail('Invalid email or password.', 401);
        }

        if ($portal === 'vendor' && ! $user->isSupplier()) {
            return $this->fail('Use a supplier account to sign in to the vendor portal.', 403);
        }

        if ($portal === 'internal' && ! $user->isInternal()) {
            return $this->fail('Use a supply chain account to sign in to inventory.', 403);
        }

        $user->tokens()->where('name', $portal)->delete();
        $token = $user->createToken($portal)->plainTextToken;

        return $this->ok([
            ...(new UserResource($user))->resolve(),
            'token' => $token,
        ], 'Login successful');
    }

    public function logout(Request $request)
    {
        $token = $request->user()?->currentAccessToken();

        if ($token && ! $token instanceof TransientToken) {
            $token->delete();
        }

        return $this->ok([], 'Logged out');
    }

    public function user(Request $request)
    {
        return $this->ok(new UserResource($request->user()->load('supplier')));
    }
}
