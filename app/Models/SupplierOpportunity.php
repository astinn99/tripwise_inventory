<?php

namespace App\Models;

use App\Support\Priority;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;

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

    public function scopeWithVendorRelations(Builder $query): Builder
    {
        return $query->with([
            'procurementRequest.catalogItem',
        ]);
    }

    public function scopeOpenForVendor(Builder $query, int $supplierId): Builder
    {
        return $query->where('supplier_id', $supplierId)
            ->where('status', 'Open for Quotation')
            ->whereDoesntHave('procurementRequest.quotations', function ($quotes) use ($supplierId) {
                $quotes->where('supplier_id', $supplierId);
            });
    }

    /**
     * @return Collection<int, self>
     */
    public static function rankedForVendor(?int $supplierId = null, bool $openOnly = false): Collection
    {
        $query = static::query()->withVendorRelations()->orderByDesc('id');

        if ($supplierId && $openOnly) {
            $query->openForVendor($supplierId);
        } elseif ($supplierId) {
            $query->where('supplier_id', $supplierId);
        }

        return Priority::sortOpportunities($query->get());
    }
}

