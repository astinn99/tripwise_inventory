<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\InspectDeliveryRequest;
use App\Http\Resources\DeliveryResource;
use App\Models\Delivery;
use App\Services\SupplyChainService;

class DeliveryController extends Controller
{
    public function index(SupplyChainService $service)
    {
        $service->syncConfirmedPurchaseOrderDeliveries();

        return $this->ok(DeliveryResource::collection(
            Delivery::query()->with('items')->orderByDesc('id')->get()
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

        return $this->ok(new DeliveryResource($updated), 'Delivery inspection recorded');
    }
}
