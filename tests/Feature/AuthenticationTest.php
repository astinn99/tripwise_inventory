<?php

namespace Tests\Feature;

use App\Mail\EmailOtpMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\CompletesEmailOtp;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use CompletesEmailOtp;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    public function test_login_requires_otp_sent_to_account_email(): void
    {
        $user = User::factory()->create([
            'email' => 'jperez@pureride.test',
            'password' => 'password',
        ]);

        $challenge = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $challenge->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.requiresOtp', true)
            ->assertJsonPath('data.emailMasked', 'j***@pureride.test');
        $this->assertArrayNotHasKey('token', $challenge->json('data'));

        Mail::assertSent(EmailOtpMail::class, function (EmailOtpMail $mail) use ($user) {
            return $mail->hasTo($user->email)
                && $mail->hasTo('jperez@pureride.test')
                && $mail->code !== '';
        });
        Mail::assertNotSent(EmailOtpMail::class, fn (EmailOtpMail $mail) => $mail->hasTo('attacker@example.com'));

        $response = $this->postJson('/api/login/otp', [
            'challengeId' => $challenge->json('data.challengeId'),
            'code' => $this->lastOtpCode($user->email),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.email', 'jperez@pureride.test')
            ->assertJsonPath('data.role', 'supply_chain');
        $this->assertNotEmpty($response->json('data.token'));
    }

    public function test_login_otp_rejects_wrong_code(): void
    {
        $user = User::factory()->create([
            'email' => 'jperez@pureride.test',
            'password' => 'password',
        ]);

        $challenge = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->postJson('/api/login/otp', [
            'challengeId' => $challenge->json('data.challengeId'),
            'code' => '000000',
        ])->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_unverified_supplier_must_verify_registered_email_before_login(): void
    {
        $user = User::factory()->unverified()->create([
            'email' => 'vendor@pureride.test',
            'password' => 'password',
            'role' => User::ROLE_SUPPLIER,
        ]);

        $challenge = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
            'portal' => 'vendor',
        ]);

        $challenge->assertOk()
            ->assertJsonPath('data.requiresEmailVerification', true)
            ->assertJsonPath('data.requiresOtp', false);
        $this->assertArrayNotHasKey('token', $challenge->json('data'));

        Mail::assertSent(EmailOtpMail::class, fn (EmailOtpMail $mail) => $mail->hasTo('vendor@pureride.test'));

        $this->postJson('/api/vendor/register/verify', [
            'challengeId' => $challenge->json('data.challengeId'),
            'code' => $this->lastOtpCode($user->email),
        ])->assertOk()
            ->assertJsonPath('data.role', 'supplier');

        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_supplier_cannot_login_to_internal_portal(): void
    {
        $user = User::factory()->create([
            'email' => 'vendor@pureride.test',
            'password' => 'password',
            'role' => User::ROLE_SUPPLIER,
        ]);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
            'portal' => 'internal',
        ])->assertForbidden()
            ->assertJsonPath('success', false);
    }

    public function test_internal_user_cannot_login_to_vendor_portal(): void
    {
        $user = User::factory()->create([
            'email' => 'jperez@pureride.test',
            'password' => 'password',
        ]);

        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
            'portal' => 'vendor',
        ])->assertForbidden()
            ->assertJsonPath('success', false);
    }

    public function test_vendor_logout_does_not_revoke_internal_token(): void
    {
        $internal = User::factory()->create([
            'email' => 'jperez@pureride.test',
            'password' => 'password',
        ]);
        $vendor = User::factory()->create([
            'email' => 'vendor@pureride.test',
            'password' => 'password',
            'role' => User::ROLE_SUPPLIER,
        ]);

        $internalToken = $internal->createToken('internal')->plainTextToken;
        $vendorToken = $vendor->createToken('vendor')->plainTextToken;

        $this->postJson('/api/logout', [], [
            'Authorization' => 'Bearer '.$vendorToken,
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $this->getJson('/api/user', [
            'Authorization' => 'Bearer '.$internalToken,
        ])->assertOk()
            ->assertJsonPath('data.email', 'jperez@pureride.test');

        $this->app['auth']->forgetGuards();

        $this->getJson('/api/user', [
            'Authorization' => 'Bearer '.$vendorToken,
        ])->assertUnauthorized();
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'jperez@pureride.test',
            'password' => 'password',
        ]);

        $this->postJson('/api/login', [
            'email' => 'jperez@pureride.test',
            'password' => 'wrong-password',
        ])->assertUnauthorized()
            ->assertJsonPath('success', false);

        Mail::assertNothingSent();
    }

    public function test_current_user_requires_authentication(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_authenticated_user_can_logout(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_login_on_another_device_does_not_revoke_existing_token(): void
    {
        $user = User::factory()->create([
            'email' => 'jperez@pureride.test',
            'password' => 'password',
        ]);

        $first = $this->loginWithOtp([
            'email' => $user->email,
            'password' => 'password',
        ]);
        $firstToken = $first->json('data.token');

        $this->app['auth']->forgetGuards();

        $second = $this->loginWithOtp([
            'email' => $user->email,
            'password' => 'password',
        ]);
        $secondToken = $second->json('data.token');

        $this->assertNotSame($firstToken, $secondToken);

        $this->app['auth']->forgetGuards();

        $this->getJson('/api/user', [
            'Authorization' => 'Bearer '.$firstToken,
        ])->assertOk()
            ->assertJsonPath('data.email', 'jperez@pureride.test');

        $this->app['auth']->forgetGuards();

        $this->getJson('/api/user', [
            'Authorization' => 'Bearer '.$secondToken,
        ])->assertOk()
            ->assertJsonPath('data.email', 'jperez@pureride.test');
    }

    public function test_expired_token_is_rejected(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('internal', ['*'], now()->subMinute())->plainTextToken;

        $this->getJson('/api/user', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();
    }

    public function test_vendor_keeps_up_to_fifteen_active_sessions(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        config(['otp.hourly_limit' => 50]);

        $user = User::factory()->create([
            'email' => 'vendor@pureride.test',
            'password' => 'password',
            'role' => User::ROLE_SUPPLIER,
        ]);

        $tokens = [];
        for ($i = 0; $i < 16; $i++) {
            $this->app['auth']->forgetGuards();
            $tokens[] = $this->loginWithOtp([
                'email' => $user->email,
                'password' => 'password',
                'portal' => 'vendor',
            ])->json('data.token');
        }

        $this->assertCount(15, $user->tokens()->where('name', 'vendor')->get());

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/user', [
            'Authorization' => 'Bearer '.$tokens[0],
        ])->assertUnauthorized();

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/user', [
            'Authorization' => 'Bearer '.$tokens[15],
        ])->assertOk()
            ->assertJsonPath('data.email', 'vendor@pureride.test');
    }
}
