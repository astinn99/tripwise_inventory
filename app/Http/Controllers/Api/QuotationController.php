<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\QuotationSubmitRequest;
use App\Http\Requests\QuotationUpdateRequest;
use App\Http\Resources\PurchaseOrderResource;
use App\Http\Resources\QuotationResource;
use App\Models\ProcurementRequest;
use App\Models\Quotation;
use App\Services\SupplyChainService;
use Illuminate\Http\Request;

class QuotationController extends Controller
{
    public function index(Request $request)
    {
        $query = Quotation::query()->with(['procurementRequest.catalogItem', 'supplier'])->orderByDesc('id');

        if ($request->user()->isSupplier() && $request->user()->supplier_id) {
            $query->where('supplier_id', $request->user()->supplier_id);
        }

        return $this->ok(QuotationResource::collection($query->get()));
    }

    public function store(QuotationSubmitRequest $request, SupplyChainService $service)
    {
        $quote = $service->submitSupplierQuotation($request->validated(), $request->user());

        return $this->created(new QuotationResource($quote), 'Quotation submitted');
    }

    public function update(QuotationUpdateRequest $request, Quotation $quotation, SupplyChainService $service)
    {
        $quote = $service->updateSupplierQuotation($quotation, $request->validated(), $request->user());

        return $this->ok(new QuotationResource($quote), 'Quotation updated');
    }

    public function select(Request $request, Quotation $quotation, SupplyChainService $service)
    {
        if (! $request->user()->canManageAll()) {
            return $this->fail('Only supply chain staff can select a supplier.', 403);
        }

        $pr = $quotation->procurementRequest ?: ProcurementRequest::query()->findOrFail($quotation->procurement_request_id);
        $po = $service->selectSupplierAndCreatePO($pr, $quotation);

        return $this->ok(new PurchaseOrderResource($po), 'Supplier selected and purchase order created');
    }
}
