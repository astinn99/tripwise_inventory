<?php

namespace App\Services;

use App\Events\NotificationCreated;
use App\Http\Resources\NotificationResource;
use App\Models\AppNotification;
use App\Support\DocumentCode;
use App\Support\SafeBroadcast;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class NotificationService
{
    public function create(string $title, string $message, string $type = 'info', string $severity = 'info', ?int $userId = null): AppNotification
    {
        $notification = $this->insertWithUniqueCode(fn (string $number) => AppNotification::query()->create([
            'notification_number' => $number,
            'user_id' => $userId,
            'title' => $title,
            'message' => $message,
            'logged_at' => now()->format('Y-m-d H:i'),
            'type' => $type,
            'severity' => $severity,
            'is_read' => false,
        ]));

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
        $codes = [];
        $offset = 0;

        $this->insertWithUniqueCode(function () use ($items, $now, &$codes, &$offset): true {
            $codes = DocumentCode::nextMany('supply_notifications', 'notification_number', 'NOTIF', count($items), 3, false, $offset);
            $offset += count($items);
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

            return true;
        });

        AppNotification::query()
            ->whereIn('notification_number', $codes)
            ->orderBy('id')
            ->get()
            ->each(function (AppNotification $notification): void {
                $this->broadcastSafely(new NotificationCreated(
                    (new NotificationResource($notification))->resolve()
                ));
            });
    }

    /**
     * @template T
     * @param  callable(string): T  $callback
     * @return T
     */
    private function insertWithUniqueCode(callable $callback): mixed
    {
        $attempts = 0;

        while (true) {
            try {
                return DB::transaction(fn () => $callback(
                    DocumentCode::next('supply_notifications', 'notification_number', 'NOTIF', 3, false)
                ));
            } catch (UniqueConstraintViolationException $exception) {
                $attempts++;
                if ($attempts >= 5) {
                    throw $exception;
                }
            }
        }
    }

    private function broadcastSafely(object $event): void
    {
        SafeBroadcast::later($event);
    }
}
