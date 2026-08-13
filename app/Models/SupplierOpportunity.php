<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'opportunity_number', 'pr_number', 'procurement_request_id', 'supplier_id', 'title',
    'category', 'quantity', 'deadline', 'budget_range', 'status', 'requirements',
])]
class SupplierOpportunity extends Model
{
    protected function casts(): array
    {
        return [
            'deadline' => 'date',
            'quantity' => 'integer',
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
}
