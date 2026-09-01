<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\InspectDeliveryRequest;
use App\Http\Resources\DeliveryResource;
use App\Http\Resources\InventoryItemResource;
use App\Models\Delivery;
use App\Models\InventoryItem;
use App\Services\SupplyChainService;
use App\Support\Priority;

class DeliveryController extends Controller
{
    public function index(SupplyChainService $service)
    {
        $service->syncConfirmedPurchaseOrderDeliveries();

        return $this->ok(DeliveryResource::collection(
            Priority::sortRecords(
                Delivery::query()->with(['items', 'purchaseOrder:id,priority'])->orderByDesc('id')->get(),
                'purchaseOrder.priority'
            )
        ));
    }

    public function inspect(InspectDeliveryRequest $request, Delivery $delivery, SupplyChainService $service)
    {
        $updated = $service->processDeliveryInspection(
            $delivery->load(['items', 'purchaseOrder.items', 'purchaseOrder.timeline']),
            $request->validated('itemsDelivered'),
            $request->validated('inspectionResult'),
            (string) ($request->validated('remarks') ?? ''),
            $request->user()
        );

        $codes = collect($request->validated('itemsDelivered'))->pluck('itemCode')->filter()->all();
        $items = InventoryItem::query()
            ->with(['supplier:id,company_name', 'storageLocation:id,rack,shelf,bin'])
            ->whereIn('item_code', $codes)
            ->get();

        return $this->ok($this->withRecordedMovements([
            ...(new DeliveryResource($updated))->resolve(),
            'updatedInventory' => InventoryItemResource::collection($items)->resolve(),
        ], $service), 'Delivery inspection recorded');
    }
}
