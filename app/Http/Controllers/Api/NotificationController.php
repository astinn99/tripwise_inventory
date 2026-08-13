<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\AppNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $query = AppNotification::query()->orderByDesc('id');

        if ($request->user()->isSupplier()) {
            $query->where('user_id', $request->user()->id);
        } else {
            $query->whereNull('user_id');
        }

        return $this->ok(NotificationResource::collection($query->get()));
    }

    public function markRead(Request $request, AppNotification $notification)
    {
        if ($request->user()->isSupplier() && $notification->user_id !== $request->user()->id) {
            return $this->fail('You can only update your own notifications.', 403);
        }

        $notification->update(['is_read' => true]);

        return $this->ok(new NotificationResource($notification->fresh()), 'Notification marked read');
    }

    public function markAllRead(Request $request)
    {
        $query = AppNotification::query()->where('is_read', false);

        if ($request->user()->isSupplier()) {
            $query->where('user_id', $request->user()->id);
        } else {
            $query->whereNull('user_id');
        }

        $query->update(['is_read' => true]);

        return $this->ok([], 'All notifications marked read');
    }
}
