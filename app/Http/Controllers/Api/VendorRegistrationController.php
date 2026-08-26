<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VendorRegisterRequest;
use App\Http\Resources\SupplierResource;
use App\Services\VendorRegistrationService;
use Illuminate\Http\Request;

class VendorRegistrationController extends Controller
{
    public function store(VendorRegisterRequest $request, VendorRegistrationService $service)
    {
        $supplier = $service->register($request->validated());

        return $this->created([
            'supplierId' => $supplier->code,
            'companyName' => $supplier->company_name,
            'status' => $supplier->status,
            'email' => $supplier->email,
        ], 'Vendor registration submitted. You can sign in while your credentials are reviewed.');
    }

    public function profile(Request $request)
    {
        $user = $request->user();

        if (! $user?->isSupplier() || ! $user->supplier) {
            return $this->fail('No vendor profile is linked to this account.', 403);
        }

        $supplier = $user->supplier->load(['documents' => fn ($query) => $query->orderByDesc('id')]);

        return $this->ok(new SupplierResource($supplier));
    }
}
