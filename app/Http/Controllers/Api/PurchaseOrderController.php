<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinanceDecisionRequest;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\PurchaseOrder;
use App\Services\SupplyChainService;
use Illuminate\Http\Request;

class PurchaseOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = PurchaseOrder::query()
            ->with(['items', 'timeline', 'procurementRequest', 'supplierAccount'])
            ->orderByDesc('id');

        if ($request->user()->isSupplier() && $request->user()->supplier_id) {
            $query->where('supplier_id', $request->user()->supplier_id);
        }

        return $this->ok(PurchaseOrderResource::collection($query->get()));
    }

    public function financeDecision(FinanceDecisionRequest $request, PurchaseOrder $purchaseOrder, SupplyChainService $service)
    {
        $isPending = $purchaseOrder->finance_approval_status === 'Pending Finance Approval'
            || $purchaseOrder->po_status === 'Pending Finance Approval';

        if (! $isPending) {
            return $this->fail('This purchase order has already been decided by Finance.', 422);
        }

        $po = $service->updateFinanceApproval(
            $purchaseOrder->load('timeline', 'procurementRequest'),
            $request->validated('status'),
            (string) ($request->validated('remarks') ?? ''),
            $request->user()
        );

        return $this->ok(new PurchaseOrderResource($po), 'Finance decision recorded');
    }

    public function confirm(Request $request, PurchaseOrder $purchaseOrder, SupplyChainService $service)
    {
        $user = $request->user();
        if ($user->isSupplier() && $user->supplier_id !== $purchaseOrder->supplier_id) {
            return $this->fail('You can only confirm your own purchase orders.', 403);
        }
        if (! $user->isSupplier() && ! $user->canManageAll()) {
            return $this->fail('You are not allowed to confirm this purchase order.', 403);
        }

        $po = $service->supplierConfirmPO($purchaseOrder->load(['timeline', 'items']));

        return $this->ok(new PurchaseOrderResource($po), 'Purchase order confirmed');
    }
}
