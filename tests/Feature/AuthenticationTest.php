<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_succeeds_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'jperez@pureride.test',
            'password' => 'password',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.email', 'jperez@pureride.test')
            ->assertJsonPath('data.role', 'supply_chain');
        $this->assertNotEmpty($response->json('data.token'));
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
}
