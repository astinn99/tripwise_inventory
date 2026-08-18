<?php

namespace App\Support;

class SafeBroadcast
{
    public static function later(object $event): void
    {
        dispatch(function () use ($event): void {
            try {
                broadcast($event)->toOthers();
            } catch (\Throwable) {
                // Reverb is optional; never block the request.
            }
        })->afterResponse();
    }
}
