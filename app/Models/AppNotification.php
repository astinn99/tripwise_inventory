<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'notification_number', 'user_id', 'title', 'message', 'logged_at',
    'type', 'severity', 'is_read',
])]
class AppNotification extends Model
{
    protected $table = 'supply_notifications';

    public function getRouteKeyName(): string
    {
        return 'notification_number';
    }

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
