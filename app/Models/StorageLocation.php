<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['rack', 'shelf', 'bin', 'category', 'max_capacity'])]
class StorageLocation extends Model
{
    public function inventoryItems(): HasMany
    {
        return $this->hasMany(InventoryItem::class);
    }

    public function label(): string
    {
        return "{$this->rack} → {$this->shelf} → {$this->bin}";
    }
}
