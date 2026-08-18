<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorageLocationRequest;
use App\Http\Resources\StorageLocationResource;
use App\Models\StorageLocation;
use App\Services\SupplyChainService;

class StorageLocationController extends Controller
{
    public function index(SupplyChainService $service)
    {
        if (StorageLocation::query()->doesntExist()) {
            $service->bootstrapWarehouseLayout();
            $service->placeUnassignedItems();
        }

        $locations = StorageLocation::query()->with('inventoryItems')->orderBy('rack')->orderBy('shelf')->orderBy('bin')->get();

        return $this->ok(StorageLocationResource::collection($locations));
    }

    public function store(StorageLocationRequest $request, SupplyChainService $service)
    {
        $location = $service->createStorageLocation($request->validated());

        return $this->created(new StorageLocationResource($location->load('inventoryItems')), 'Storage bin created');
    }

    public function bootstrap(SupplyChainService $service)
    {
        $created = $service->bootstrapWarehouseLayout();
        $service->placeUnassignedItems();

        $locations = StorageLocation::query()->with('inventoryItems')->orderBy('rack')->orderBy('shelf')->orderBy('bin')->get();

        return $this->ok(StorageLocationResource::collection($locations), $created === 0
            ? 'Warehouse layout is already in place'
            : "{$created} storage bins mapped");
    }
}
