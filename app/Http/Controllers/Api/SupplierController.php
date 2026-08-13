<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;

class SupplierController extends Controller
{
    public function index()
    {
        $suppliers = Supplier::query()
            ->whereHas('users')
            ->orderBy('company_name')
            ->get();

        return $this->ok(SupplierResource::collection($suppliers));
    }
}
