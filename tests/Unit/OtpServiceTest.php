<?php

namespace Tests\Unit;

use App\Exceptions\OtpException;
use App\Mail\EmailOtpMail;
use App\Models\EmailOtp;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class OtpServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    public function test_issue_mails_only_the_stored_account_email(): void
    {
        $user = User::factory()->create(['email' => 'vendor@acme.test']);
        $otp = app(OtpService::class)->issue($user, EmailOtp::PURPOSE_LOGIN, 'vendor');

        $this->assertSame('vendor@acme.test', $otp->email);
        Mail::assertSent(EmailOtpMail::class, fn (EmailOtpMail $mail) => $mail->hasTo('vendor@acme.test'));
        Mail::assertNotSent(EmailOtpMail::class, fn (EmailOtpMail $mail) => $mail->hasTo('other@example.com'));
    }

    public function test_verify_accepts_the_issued_code(): void
    {
        $user = User::factory()->create(['email' => 'jperez@pureride.test']);
        $service = app(OtpService::class);
        $otp = $service->issue($user, EmailOtp::PURPOSE_LOGIN, 'internal');

        $code = Mail::sent(EmailOtpMail::class)->last()->code;
        $verified = $service->verify($otp->challenge_id, $code, EmailOtp::PURPOSE_LOGIN);

        $this->assertNotNull($verified->consumed_at);
        $this->assertTrue($verified->user->is($user));
    }

    public function test_verify_rejects_an_expired_code(): void
    {
        $user = User::factory()->create();
        $service = app(OtpService::class);
        $otp = $service->issue($user, EmailOtp::PURPOSE_REGISTER, 'vendor');
        $code = Mail::sent(EmailOtpMail::class)->last()->code;
        $otp->update(['expires_at' => now()->subMinute()]);

        $this->expectException(OtpException::class);
        $service->verify($otp->challenge_id, $code, EmailOtp::PURPOSE_REGISTER);
    }

    public function test_mask_hides_the_local_part(): void
    {
        $this->assertSame('v***@acme.test', OtpService::mask('vendor@acme.test'));
    }
}
