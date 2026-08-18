<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\OpportunityResource;
use App\Models\SupplierOpportunity;
use Illuminate\Http\Request;

class OpportunityController extends Controller
{
    public function index(Request $request)
    {
        $query = SupplierOpportunity::query()->with('procurementRequest.catalogItem')->orderByDesc('id');

        if ($request->user()->isSupplier()) {
            $supplierId = $request->user()->supplier_id;
            $query->where('supplier_id', $supplierId)
                ->where('status', 'Open for Quotation')
                ->whereDoesntHave('procurementRequest.quotations', function ($quotes) use ($supplierId) {
                    $quotes->where('supplier_id', $supplierId);
                });
        }

        return $this->ok(OpportunityResource::collection($query->get()));
    }
}
