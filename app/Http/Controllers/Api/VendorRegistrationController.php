<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\OtpException;
use App\Http\Controllers\Controller;
use App\Http\Requests\OtpChallengeRequest;
use App\Http\Requests\OtpResendRequest;
use App\Http\Requests\VendorRegisterRequest;
use App\Http\Resources\SupplierResource;
use App\Models\EmailOtp;
use App\Services\OtpService;
use App\Services\PortalTokenService;
use App\Services\VendorRegistrationService;
use Illuminate\Http\Request;

class VendorRegistrationController extends Controller
{
    public function __construct(
        private OtpService $otp,
        private PortalTokenService $tokens,
    ) {}

    public function store(VendorRegisterRequest $request, VendorRegistrationService $service)
    {
        $supplier = $service->register($request->validated());
        $user = $supplier->users->first();

        if (! $user) {
            return $this->fail('Registration saved, but the portal account could not be created.');
        }

        try {
            $challenge = $this->otp->issue($user, EmailOtp::PURPOSE_REGISTER, 'vendor');
        } catch (OtpException $exception) {
            return $this->fail($exception->getMessage(), $exception->status);
        }

        return $this->created([
            'supplierId' => $supplier->code,
            'companyName' => $supplier->company_name,
            'status' => $supplier->status,
            'email' => $supplier->email,
            ...$this->otp->payload($challenge),
        ], 'Registration submitted. Enter the code we sent to your registered email.');
    }

    public function verify(OtpChallengeRequest $request)
    {
        try {
            $challenge = $this->otp->verify(
                $request->validated('challengeId'),
                $request->validated('code'),
                EmailOtp::PURPOSE_REGISTER,
            );
        } catch (OtpException $exception) {
            return $this->fail($exception->getMessage(), $exception->status);
        }

        $user = $challenge->user;

        if (! $user) {
            return $this->fail('This code is invalid or has expired.');
        }

        $user->markEmailAsVerified();
        $user->load('supplier:id,code,company_name,status');

        return $this->ok(
            $this->tokens->issue($user, 'vendor'),
            'Email verified. Welcome to the vendor portal.'
        );
    }

    public function resend(OtpResendRequest $request)
    {
        try {
            $challenge = $this->otp->resend(
                $request->validated('challengeId'),
                EmailOtp::PURPOSE_REGISTER,
            );
        } catch (OtpException $exception) {
            return $this->fail($exception->getMessage(), $exception->status);
        }

        return $this->ok(
            $this->otp->payload($challenge, requiresOtp: false, requiresEmailVerification: true),
            'A new verification code was sent to your registered email.'
        );
    }

    public function profile(Request $request)
    {
        $user = $request->user();

        if (! $user?->isSupplier() || ! $user->supplier) {
            return $this->fail('No vendor profile is linked to this account.', 403);
        }

        $supplier = $user->supplier->load(['documents' => fn ($query) => $query->orderByDesc('id')]);

        return $this->ok(new SupplierResource($supplier));
    }
}
