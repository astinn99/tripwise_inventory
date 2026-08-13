<?php

namespace Database\Seeders;

use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class EssentialAccountsSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('SEED_USER_PASSWORD', 'password');

        User::query()->firstOrCreate(
            ['email' => env('SEED_SUPPLY_CHAIN_EMAIL', 'jperez@pureride.test')],
            [
                'name' => 'J. Perez',
                'password' => Hash::make($password),
                'role' => User::ROLE_SUPPLY_CHAIN,
                'email_verified_at' => now(),
            ]
        );
    }
}
