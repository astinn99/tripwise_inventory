<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'quote_number', 'procurement_request_id', 'supplier_id', 'supplier_name',
    'item', 'quantity', 'unit_price', 'total_price', 'warranty',
    'delivery_time_days', 'quality_rating', 'payment_terms', 'status', 'notes',
])]
class Quotation extends Model
{
    public function getRouteKeyName(): string
    {
        return 'quote_number';
    }

    protected function casts(): array
    {
        return [
            'unit_price' => 'float',
            'total_price' => 'float',
            'quality_rating' => 'float',
            'quantity' => 'integer',
            'delivery_time_days' => 'integer',
        ];
    }

    public function procurementRequest(): BelongsTo
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function canEdit(): bool
    {
        if (in_array($this->status, ['Selected', 'Accepted', 'Rejected'], true)) {
            return false;
        }

        $pr = $this->procurementRequest;
        if (! $pr) {
            return false;
        }

        return blank($pr->selected_supplier) && blank($pr->po_number);
    }
}
