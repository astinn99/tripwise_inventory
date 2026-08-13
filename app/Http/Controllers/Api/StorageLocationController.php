<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StorageLocationResource;
use App\Models\StorageLocation;

class StorageLocationController extends Controller
{
    public function index()
    {
        $locations = StorageLocation::query()->with('inventoryItems')->orderBy('rack')->orderBy('shelf')->orderBy('bin')->get();

        return $this->ok(StorageLocationResource::collection($locations));
    }
}
