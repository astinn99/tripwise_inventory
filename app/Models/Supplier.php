<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'code', 'company_name', 'contact_person', 'phone', 'email', 'address', 'status',
    'rating', 'quality_score', 'responsiveness_score', 'delivery_performance',
    'pricing_score', 'overall_score', 'categories', 'tax_id', 'sec_registration',
    'bank_details', 'active_orders',
])]
class Supplier extends Model
{
    use SoftDeletes;

    protected function casts(): array
    {
        return [
            'categories' => 'array',
            'rating' => 'float',
            'overall_score' => 'float',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function inventoryItems(): HasMany
    {
        return $this->hasMany(InventoryItem::class);
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }
}
