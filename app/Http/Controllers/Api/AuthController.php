<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function login(LoginRequest $request)
    {
        if (! Auth::attempt($request->validated(), true)) {
            return $this->fail('Invalid email or password.', 401);
        }

        $request->session()->regenerate();

        return $this->ok(new UserResource($request->user()->load('supplier')), 'Login successful');
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->ok([], 'Logged out');
    }

    public function user(Request $request)
    {
        return $this->ok(new UserResource($request->user()->load('supplier')));
    }
}
