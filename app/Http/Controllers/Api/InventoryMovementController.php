<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\InventoryMovementResource;
use App\Models\InventoryMovement;

class InventoryMovementController extends Controller
{
    public function index()
    {
        return $this->ok(InventoryMovementResource::collection(
            InventoryMovement::query()->orderByDesc('id')->get()
        ));
    }
}
