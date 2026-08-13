<?php

namespace App\Services;

use App\Events\NotificationCreated;
use App\Http\Resources\NotificationResource;
use App\Models\AppNotification;
use App\Support\DocumentCode;

class NotificationService
{
    public function create(string $title, string $message, string $type = 'info', string $severity = 'info', ?int $userId = null): AppNotification
    {
        $notification = AppNotification::query()->create([
            'notification_number' => DocumentCode::next('supply_notifications', 'notification_number', 'NOTIF', 3, false),
            'user_id' => $userId,
            'title' => $title,
            'message' => $message,
            'logged_at' => now()->format('Y-m-d H:i'),
            'type' => $type,
            'severity' => $severity,
            'is_read' => false,
        ]);

        $this->broadcastSafely(new NotificationCreated(
            (new NotificationResource($notification))->resolve()
        ));

        return $notification;
    }

    private function broadcastSafely(object $event): void
    {
        try {
            broadcast($event)->toOthers();
        } catch (\Throwable) {
            // Broadcasting is optional during tests and local bootstrap.
        }
    }
}
