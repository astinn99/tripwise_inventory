<?php

namespace App\Http\Resources;

use App\Support\StockStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\InventoryItem */
class DepartmentCatalogItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $quantity = (int) $this->quantity;
        $minStock = (int) $this->min_stock_level;
        $status = $this->status ?: StockStatus::fromQuantity($quantity, $minStock);

        return [
            'itemCode' => $this->item_code,
            'description' => $this->description,
            'category' => $this->category,
            'unit' => $this->unit,
            'quantityAvailable' => $quantity,
            'minStockLevel' => $minStock,
            'status' => $status,
            'canRequest' => true,
            'enoughStockFor' => $quantity,
        ];
    }
}
