<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ManualProcurementRequest;
use App\Http\Requests\UpdateProcurementRequest;
use App\Http\Resources\ProcurementRequestResource;
use App\Models\InventoryItem;
use App\Models\ProcurementRequest;
use App\Services\SupplyChainService;
use Illuminate\Http\Request;

class ProcurementRequestController extends Controller
{
    public function index(SupplyChainService $service)
    {
        $service->flagOverdueRfqs();

        return $this->ok(ProcurementRequestResource::collection(
            ProcurementRequest::query()
                ->with(['catalogItem', 'purchaseOrder:id,procurement_request_id,po_status'])
                ->withCount(['opportunities', 'quotations'])
                ->withMin('opportunities', 'deadline')
                ->orderByDesc('id')
                ->get()
        ));
    }

    public function store(ManualProcurementRequest $request, SupplyChainService $service)
    {
        $item = InventoryItem::query()->where('item_code', $request->validated('itemCode'))->firstOrFail();
        $pr = $service->createManualProcurementRequest(
            $item,
            (int) $request->validated('quantity'),
            $request->validated('reason'),
            $request->validated('priority'),
            $request->validated('neededInDays') !== null ? (int) $request->validated('neededInDays') : null
        );

        return $this->created(new ProcurementRequestResource($pr->loadCount('opportunities')), 'Procurement request created');
    }

    public function update(UpdateProcurementRequest $request, ProcurementRequest $procurementRequest, SupplyChainService $service)
    {
        $pr = $service->updateProcurementRequest($procurementRequest, $request->validated());

        return $this->ok(new ProcurementRequestResource($pr), 'Procurement request updated');
    }

    public function cancel(Request $request, ProcurementRequest $procurementRequest, SupplyChainService $service)
    {
        $pr = $service->cancelProcurementRequest($procurementRequest, $request->user());

        return $this->ok(new ProcurementRequestResource($pr), 'Procurement request cancelled');
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
