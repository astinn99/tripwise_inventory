<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReleaseRequest;
use App\Http\Resources\ReleaseResource;
use App\Http\Resources\SupplyRequestResource;
use App\Models\SupplyRequest;
use App\Services\SupplyChainService;

class SupplyRequestController extends Controller
{
    public function index()
    {
        $requests = SupplyRequest::query()->with('logs')->orderByDesc('id')->get();

        return $this->ok(SupplyRequestResource::collection($requests));
    }

    public function checkStock(SupplyRequest $supplyRequest, SupplyChainService $service)
    {
        $updated = $service->processSupplyRequestStock($supplyRequest);

        return $this->ok(new SupplyRequestResource($updated), 'Stock check completed');
    }

    public function release(ReleaseRequest $request, SupplyRequest $supplyRequest, SupplyChainService $service)
    {
        $releasedTo = $request->validated('releasedTo') ?: $supplyRequest->requested_by;
        $release = $service->releaseSupplyRequest($supplyRequest, (string) $releasedTo, $request->user());

        return $this->ok(new ReleaseResource($release), 'Supply request released');
    }
}
