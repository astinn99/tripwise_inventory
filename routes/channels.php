<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function (User $user, int|string $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('supply-chain', function (User $user) {
    return $user->isInternal() || $user->isSupplier();
});
