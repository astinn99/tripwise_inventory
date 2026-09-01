<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\OtpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\OtpChallengeRequest;
use App\Http\Requests\OtpResendRequest;
use App\Http\Resources\UserResource;
use App\Models\EmailOtp;
use App\Models\User;
use App\Services\OtpService;
use App\Services\PortalTokenService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\TransientToken;

class AuthController extends Controller
{
    public function __construct(
        private OtpService $otp,
        private PortalTokenService $tokens,
    ) {}

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

        if ($user->isSupplier() && ! $user->hasVerifiedEmail()) {
            try {
                $challenge = $this->otp->issue($user, EmailOtp::PURPOSE_REGISTER, 'vendor');
            } catch (OtpException $exception) {
                return $this->fail($exception->getMessage(), $exception->status);
            }

            return $this->ok(
                $this->otp->payload($challenge, requiresOtp: false, requiresEmailVerification: true),
                'Verify the email on this account before signing in. We sent a code to your registered address.'
            );
        }

        try {
            $challenge = $this->otp->issue($user, EmailOtp::PURPOSE_LOGIN, $portal);
        } catch (OtpException $exception) {
            return $this->fail($exception->getMessage(), $exception->status);
        }

        return $this->ok(
            $this->otp->payload($challenge),
            'A verification code was sent to your registered email.'
        );
    }

    public function verifyLoginOtp(OtpChallengeRequest $request)
    {
        try {
            $challenge = $this->otp->verify(
                $request->validated('challengeId'),
                $request->validated('code'),
                EmailOtp::PURPOSE_LOGIN,
            );
        } catch (OtpException $exception) {
            return $this->fail($exception->getMessage(), $exception->status);
        }

        $user = $challenge->user?->load('supplier:id,code,company_name,status');

        if (! $user) {
            return $this->fail('This code is invalid or has expired.');
        }

        $portal = $challenge->portal ?: 'internal';

        return $this->ok($this->tokens->issue($user, $portal), 'Login successful');
    }

    public function resendLoginOtp(OtpResendRequest $request)
    {
        try {
            $challenge = $this->otp->resend(
                $request->validated('challengeId'),
                EmailOtp::PURPOSE_LOGIN,
            );
        } catch (OtpException $exception) {
            return $this->fail($exception->getMessage(), $exception->status);
        }

        return $this->ok(
            $this->otp->payload($challenge),
            'A new verification code was sent to your registered email.'
        );
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
