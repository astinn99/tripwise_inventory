<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ManualProcurementRequest;
use App\Http\Resources\ProcurementRequestResource;
use App\Models\InventoryItem;
use App\Models\ProcurementRequest;
use App\Services\SupplyChainService;

class ProcurementRequestController extends Controller
{
    public function index()
    {
        return $this->ok(ProcurementRequestResource::collection(
            ProcurementRequest::query()->withCount('opportunities')->orderByDesc('id')->get()
        ));
    }

    public function store(ManualProcurementRequest $request, SupplyChainService $service)
    {
        $item = InventoryItem::query()->where('item_code', $request->validated('itemCode'))->firstOrFail();
        $pr = $service->createManualProcurementRequest(
            $item,
            (int) $request->validated('quantity'),
            $request->validated('reason'),
            $request->validated('priority')
        );

        return $this->created(new ProcurementRequestResource($pr->loadCount('opportunities')), 'Procurement request created');
    }

    public function sendToVendors(ProcurementRequest $procurementRequest, SupplyChainService $service)
    {
        $count = $service->sendProcurementToVendors($procurementRequest);

        return $this->ok(
            new ProcurementRequestResource($procurementRequest->fresh()->loadCount('opportunities')),
            $count > 0
                ? "Procurement request sent to {$count} vendor portal(s)"
                : 'All active vendors already received this request'
        );
    }
}
