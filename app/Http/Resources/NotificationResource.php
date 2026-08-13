<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AppNotification */
class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->notification_number,
            'title' => $this->title,
            'message' => $this->message,
            'timestamp' => $this->logged_at,
            'type' => $this->type,
            'severity' => $this->severity,
            'read' => (bool) $this->is_read,
        ];
    }
}
