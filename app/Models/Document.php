<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'document_number', 'title', 'type', 'reference_number', 'supplier',
    'issue_date', 'expiration_date', 'status', 'category', 'file_size',
    'file_path', 'original_filename', 'source', 'warranty_months',
    'inventory_item_id', 'purchase_order_id', 'quotation_id', 'supplier_id',
    'last_alerted_at', 'last_alert_window',
])]
class Document extends Model
{
    use SoftDeletes;

    public function getRouteKeyName(): string
    {
        return 'document_number';
    }

    protected function casts(): array
    {
        return [
            'issue_date' => 'date',
            'expiration_date' => 'date',
            'last_alerted_at' => 'datetime',
            'warranty_months' => 'integer',
        ];
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function supplierAccount(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function resolveStatus(): string
    {
        if (! $this->expiration_date) {
            return $this->status ?: 'Active';
        }

        if ($this->expiration_date->isPast()) {
            return 'Expired';
        }

        if ($this->expiration_date->lte(now()->addDays(30))) {
            return 'Expiring Soon';
        }

        return 'Active';
    }

    public function daysRemaining(): ?int
    {
        if (! $this->expiration_date) {
            return null;
        }

        return (int) now()->startOfDay()->diffInDays($this->expiration_date, false);
    }

    public function fileUrl(): ?string
    {
        if (! $this->file_path) {
            return null;
        }

        return '/storage/'.$this->file_path;
    }

    public function alertWindow(): ?string
    {
        $days = $this->daysRemaining();
        if ($days === null) {
            return null;
        }

        if ($days < 0) {
            return 'expired';
        }
        if ($days <= 0) {
            return '0';
        }
        if ($days <= 7) {
            return '7';
        }
        if ($days <= 30) {
            return '30';
        }
        if ($days <= 60) {
            return '60';
        }
        if ($days <= 90) {
            return '90';
        }

        return null;
    }
}
