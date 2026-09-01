<?php

namespace App\Services;

use App\Exceptions\OtpException;
use App\Mail\EmailOtpMail;
use App\Models\EmailOtp;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class OtpService
{
    public function issue(User $user, string $purpose, ?string $portal = null): EmailOtp
    {
        $this->assertHourlyLimit($user->email, $purpose);

        EmailOtp::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        $code = $this->generateCode();

        $otp = EmailOtp::query()->create([
            'challenge_id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'email' => $user->email,
            'purpose' => $purpose,
            'portal' => $portal,
            'code_hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => now()->addMinutes((int) config('otp.ttl_minutes')),
            'last_sent_at' => now(),
        ]);

        $this->sendToRegisteredEmail($user, $code, $purpose);
        $this->incrementHourlyLimit($user->email, $purpose);

        return $otp;
    }

    public function verify(string $challengeId, string $code, string $purpose): EmailOtp
    {
        $otp = EmailOtp::query()
            ->with('user')
            ->where('challenge_id', $challengeId)
            ->where('purpose', $purpose)
            ->first();

        if (! $otp || $otp->consumed_at || $otp->expires_at->isPast()) {
            throw new OtpException('This code is invalid or has expired.');
        }

        if ($otp->attempts >= (int) config('otp.max_attempts')) {
            throw new OtpException('Too many incorrect attempts. Request a new code.');
        }

        if (! Hash::check($code, $otp->code_hash)) {
            $otp->increment('attempts');
            throw new OtpException('That code is incorrect.');
        }

        $otp->update(['consumed_at' => now()]);

        return $otp->fresh('user');
    }

    public function resend(string $challengeId, string $purpose): EmailOtp
    {
        $otp = EmailOtp::query()
            ->with('user')
            ->where('challenge_id', $challengeId)
            ->where('purpose', $purpose)
            ->first();

        if (! $otp || $otp->consumed_at || ! $otp->user || $otp->expires_at->isPast()) {
            throw new OtpException('This code is invalid or has expired.');
        }

        $wait = (int) config('otp.resend_seconds');
        if ($otp->last_sent_at?->gt(now()->subSeconds($wait))) {
            throw new OtpException('Please wait before requesting another code.', 429);
        }

        $this->assertHourlyLimit($otp->user->email, $purpose);

        $code = $this->generateCode();
        $otp->update([
            'code_hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => now()->addMinutes((int) config('otp.ttl_minutes')),
            'last_sent_at' => now(),
        ]);

        $this->sendToRegisteredEmail($otp->user, $code, $purpose);
        $this->incrementHourlyLimit($otp->user->email, $purpose);

        return $otp->fresh('user');
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(EmailOtp $otp, bool $requiresOtp = true, bool $requiresEmailVerification = false): array
    {
        return [
            'requiresOtp' => $requiresOtp,
            'requiresEmailVerification' => $requiresEmailVerification,
            'challengeId' => $otp->challenge_id,
            'emailMasked' => self::mask($otp->email),
            'expiresIn' => max(0, (int) now()->diffInSeconds($otp->expires_at, false)),
            'resendIn' => (int) config('otp.resend_seconds'),
        ];
    }

    public static function mask(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $visible = substr($local, 0, 1);

        return $visible.'***@'.$domain;
    }

    private function sendToRegisteredEmail(User $user, string $code, string $purpose): void
    {
        $mailer = (string) config('mail.default');

        if (in_array($mailer, ['log', 'array'], true) && ! app()->environment(['local', 'testing'])) {
            throw new OtpException(
                'Email is not configured on this server. Set MAIL_MAILER=smtp with Brevo credentials, then run php artisan config:clear.'
            );
        }

        try {
            Mail::mailer($mailer)->to($user->email)->send(new EmailOtpMail($user, $code, $purpose));
        } catch (OtpException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            report($exception);

            throw new OtpException('We could not send the verification email. Confirm SMTP settings and that outbound port 587 is open.');
        }
    }

    private function generateCode(): string
    {
        $length = (int) config('otp.length', 6);

        return str_pad((string) random_int(0, (10 ** $length) - 1), $length, '0', STR_PAD_LEFT);
    }

    private function assertHourlyLimit(string $email, string $purpose): void
    {
        $limit = (int) config('otp.hourly_limit');
        $count = (int) Cache::get($this->hourlyKey($email, $purpose), 0);

        if ($count >= $limit) {
            throw new OtpException('Too many codes were sent to this email. Try again later.', 429);
        }
    }

    private function incrementHourlyLimit(string $email, string $purpose): void
    {
        $key = $this->hourlyKey($email, $purpose);

        if (! Cache::has($key)) {
            Cache::put($key, 1, now()->addHour());

            return;
        }

        Cache::increment($key);
    }

    private function hourlyKey(string $email, string $purpose): string
    {
        return 'otp:hour:'.$purpose.':'.strtolower($email);
    }
}
