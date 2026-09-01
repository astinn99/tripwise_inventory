<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\OpportunityResource;
use App\Models\SupplierOpportunity;
use App\Services\SupplyChainService;
use App\Support\Priority;
use Illuminate\Http\Request;

class OpportunityController extends Controller
{
    public function index(Request $request, SupplyChainService $supplyChain)
    {
        $user = $request->user();

        if ($user->isSupplier() && $user->supplier?->status === 'Active') {
            $supplyChain->inviteSupplierToOpenRfqs($user->supplier);
        }

        $query = SupplierOpportunity::query()->withVendorRelations()->orderByDesc('id');

        if ($user->isSupplier()) {
            $query->openForVendor((int) $user->supplier_id);
        }

        return $this->ok(OpportunityResource::collection(
            Priority::sortOpportunities($query->get())
        ));
    }
}
