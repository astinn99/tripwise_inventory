<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SupplierResource;
use App\Models\Supplier;
use App\Services\NotificationService;

class SupplierController extends Controller
{
    public function index()
    {
        $suppliers = Supplier::query()
            ->with(['documents' => fn ($query) => $query->orderByDesc('id')])
            ->whereHas('users')
            ->orderBy('company_name')
            ->get();

        return $this->ok(SupplierResource::collection($suppliers));
    }

    public function show(Supplier $supplier)
    {
        $supplier->load(['documents' => fn ($query) => $query->orderByDesc('id')]);

        return $this->ok(new SupplierResource($supplier));
    }

    public function approve(Supplier $supplier, NotificationService $notifications)
    {
        $supplier->update(['status' => 'Active']);

        foreach ($supplier->users as $vendorUser) {
            $notifications->create(
                'Vendor Account Approved',
                'Your company is now cleared to receive RFQs and submit quotations.',
                'info',
                'info',
                $vendorUser->id
            );
        }

        $supplier->load(['documents' => fn ($query) => $query->orderByDesc('id')]);

        return $this->ok(new SupplierResource($supplier), 'Vendor approved');
    }
}
