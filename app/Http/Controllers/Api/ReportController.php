<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DocumentResource;
use App\Http\Resources\InventoryItemResource;
use App\Http\Resources\InventoryMovementResource;
use App\Http\Resources\PurchaseOrderResource;
use App\Http\Resources\SupplierResource;
use App\Models\Document;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\PurchaseOrder;
use App\Models\Supplier;

class ReportController extends Controller
{
    public function __invoke()
    {
        $inventory = InventoryItem::query()->with(['supplier', 'storageLocation'])->get();
        $orders = PurchaseOrder::query()->with(['items', 'timeline', 'procurementRequest', 'supplierAccount'])->get();
        $suppliers = Supplier::query()->get();
        $movements = InventoryMovement::query()->orderByDesc('id')->get();
        $documents = Document::query()->orderByDesc('id')->get();

        return $this->ok([
            'inventory' => InventoryItemResource::collection($inventory),
            'purchaseOrders' => PurchaseOrderResource::collection($orders),
            'suppliers' => SupplierResource::collection($suppliers),
            'movements' => InventoryMovementResource::collection($movements),
            'documents' => DocumentResource::collection($documents),
        ]);
    }
}
