<?php

namespace App\Services;

use App\Events\NotificationCreated;
use App\Http\Resources\NotificationResource;
use App\Models\AppNotification;
use App\Support\DocumentCode;
use App\Support\SafeBroadcast;

class NotificationService
{
    public function create(string $title, string $message, string $type = 'info', string $severity = 'info', ?int $userId = null): AppNotification
    {
        $notification = AppNotification::query()->create([
            'notification_number' => 'NOTIF-'.strtoupper(bin2hex(random_bytes(4))),
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

    /**
     * @param  list<array{title: string, message: string, type?: string, severity?: string, user_id?: int|null}>  $items
     */
    public function createMany(array $items): void
    {
        if ($items === []) {
            return;
        }

        $now = now();
        $codes = DocumentCode::nextMany('supply_notifications', 'notification_number', 'NOTIF', count($items), 3, false);
        $rows = [];

        foreach ($items as $index => $item) {
            $rows[] = [
                'notification_number' => $codes[$index],
                'user_id' => $item['user_id'] ?? null,
                'title' => $item['title'],
                'message' => $item['message'],
                'logged_at' => $now->format('Y-m-d H:i'),
                'type' => $item['type'] ?? 'info',
                'severity' => $item['severity'] ?? 'info',
                'is_read' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        AppNotification::query()->insert($rows);
    }

    private function broadcastSafely(object $event): void
    {
        SafeBroadcast::later($event);
    }
}
