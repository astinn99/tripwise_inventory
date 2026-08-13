<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PurchaseOrderUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public array $purchaseOrder) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('supply-chain')];
    }

    public function broadcastAs(): string
    {
        return 'purchase-order.updated';
    }

    public function broadcastWith(): array
    {
        return ['purchaseOrder' => $this->purchaseOrder];
    }
}
