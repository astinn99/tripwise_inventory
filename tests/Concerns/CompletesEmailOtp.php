<?php

namespace Tests\Concerns;

use App\Mail\EmailOtpMail;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;

trait CompletesEmailOtp
{
    protected function lastOtpCode(?string $to = null): string
    {
        $mails = Mail::sent(EmailOtpMail::class, function (EmailOtpMail $mail) use ($to) {
            return ! $to || $mail->hasTo($to);
        });

        $this->assertNotEmpty($mails);

        return $mails->last()->code;
    }

    /**
     * @param  array<string, string>  $credentials
     */
    protected function loginWithOtp(array $credentials): TestResponse
    {
        $challenge = $this->postJson('/api/login', $credentials);
        $challenge->assertOk()->assertJsonPath('data.requiresOtp', true);
        $this->assertArrayNotHasKey('token', $challenge->json('data') ?? []);

        return $this->postJson('/api/login/otp', [
            'challengeId' => $challenge->json('data.challengeId'),
            'code' => $this->lastOtpCode(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function registerAndVerifyVendor(array $payload): TestResponse
    {
        $response = $this->post('/api/vendor/register', $payload, [
            'Accept' => 'application/json',
        ]);
        $response->assertCreated()->assertJsonPath('data.requiresOtp', true);

        $email = $response->json('data.email');
        Mail::assertSent(EmailOtpMail::class, fn (EmailOtpMail $mail) => $mail->hasTo($email));

        $verified = $this->postJson('/api/vendor/register/verify', [
            'challengeId' => $response->json('data.challengeId'),
            'code' => $this->lastOtpCode($email),
        ]);
        $verified->assertOk()->assertJsonPath('data.role', 'supplier');
        $this->assertNotEmpty($verified->json('data.token'));

        return $verified;
    }
}
