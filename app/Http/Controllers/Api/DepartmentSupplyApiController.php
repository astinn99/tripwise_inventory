<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DepartmentSupplyRequestStoreRequest;
use App\Http\Resources\DepartmentCatalogItemResource;
use App\Http\Resources\SupplyRequestResource;
use App\Models\InventoryItem;
use App\Models\SupplyRequest;
use App\Services\SupplyChainService;
use Illuminate\Http\Request;

class DepartmentSupplyApiController extends Controller
{
    public function items(Request $request)
    {
        $query = InventoryItem::query()->orderBy('item_code');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($builder) use ($search) {
                $builder->where('item_code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%");
            });
        }

        if ($category = trim((string) $request->query('category', ''))) {
            $query->where('category', $category);
        }

        if ($request->boolean('availableOnly')) {
            $query->where('quantity', '>', 0);
        }

        return $this->ok(DepartmentCatalogItemResource::collection($query->get()));
    }

    public function showItem(string $itemCode)
    {
        $item = InventoryItem::query()->where('item_code', $itemCode)->firstOrFail();

        return $this->ok(new DepartmentCatalogItemResource($item));
    }

    public function storeRequest(DepartmentSupplyRequestStoreRequest $request, SupplyChainService $service)
    {
        $supplyRequest = $service->receiveDepartmentSupplyRequest($request->validated());

        return $this->created(new SupplyRequestResource($supplyRequest), 'Supply request received');
    }

    public function showRequest(SupplyRequest $supplyRequest)
    {
        return $this->ok(new SupplyRequestResource($supplyRequest->load('logs')));
    }
}
