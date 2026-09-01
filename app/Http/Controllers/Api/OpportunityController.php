<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\OpportunityResource;
use App\Models\SupplierOpportunity;
use App\Support\Priority;
use Illuminate\Http\Request;

class OpportunityController extends Controller
{
    public function index(Request $request)
    {
        $query = SupplierOpportunity::query()->withVendorRelations()->orderByDesc('id');

        if ($request->user()->isSupplier()) {
            $query->openForVendor((int) $request->user()->supplier_id);
        }

        return $this->ok(OpportunityResource::collection(
            Priority::sortOpportunities($query->get())
        ));
    }
}
