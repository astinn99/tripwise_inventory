<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'quote_number', 'procurement_request_id', 'supplier_id', 'supplier_name',
    'item', 'quantity', 'unit_price', 'total_price', 'warranty',
    'warranty_months', 'warranty_file_path', 'manual_file_path', 'item_photo_paths',
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
            'warranty_months' => 'integer',
            'item_photo_paths' => 'array',
        ];
    }

    /** @return list<string> */
    public function itemPhotoPaths(): array
    {
        return array_values(array_filter(
            (array) ($this->item_photo_paths ?? []),
            fn ($path) => is_string($path) && $path !== ''
        ));
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
