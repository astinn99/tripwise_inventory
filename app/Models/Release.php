<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'release_number', 'supply_request_id', 'request_id', 'requesting_department',
    'item_code', 'item_name', 'quantity_released', 'approval_status',
    'stock_status', 'release_date', 'released_to', 'dispatched_by',
])]
class Release extends Model
{
    public function supplyRequest(): BelongsTo
    {
        return $this->belongsTo(SupplyRequest::class);
    }
}
