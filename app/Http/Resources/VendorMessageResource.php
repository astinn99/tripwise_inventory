<?php

namespace App\Http\Resources;

use App\Models\VendorMessage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin VendorMessage */
class VendorMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $system = $this->user_id === null;

        return [
            'id' => $this->id,
            'body' => $this->body,
            'mine' => ! $system && (int) $this->user_id === (int) $request->user()?->id,
            'authorName' => $system ? 'TripWise' : (string) ($this->user?->name ?? 'TripWise'),
            'system' => $system,
            'createdAt' => optional($this->created_at)?->format('Y-m-d H:i'),
        ];
    }
}
