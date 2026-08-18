<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'po_number', 'procurement_request_id', 'supplier_id', 'supplier',
    'contact_person', 'total_cost', 'budget_reference', 'payment_terms',
    'procurement_reason', 'delivery_date', 'warranty', 'warranty_months',
    'warranty_file_path', 'finance_approval_status',
    'po_status', 'created_date', 'approver', 'finance_remarks',
])]
class PurchaseOrder extends Model
{
    protected function casts(): array
    {
        return [
            'total_cost' => 'float',
            'created_date' => 'date',
            'warranty_months' => 'integer',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'po_number';
    }

    public function procurementRequest(): BelongsTo
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function supplierAccount(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function timeline(): HasMany
    {
        return $this->hasMany(PurchaseOrderTimelineStep::class)->orderBy('sort_order');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(Delivery::class);
    }
}
