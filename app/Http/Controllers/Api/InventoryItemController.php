<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdjustInventoryItemRequest;
use App\Http\Requests\InventoryItemRequest;
use App\Http\Requests\MoveInventoryItemRequest;
use App\Http\Resources\InventoryItemResource;
use App\Models\InventoryItem;
use App\Services\SupplyChainService;

class InventoryItemController extends Controller
{
    public function index()
    {
        $items = InventoryItem::query()->with(['supplier', 'storageLocation'])->orderBy('item_code')->get();

        return $this->ok(InventoryItemResource::collection($items));
    }

    public function show(InventoryItem $inventoryItem)
    {
        return $this->ok(new InventoryItemResource($inventoryItem->load(['supplier', 'storageLocation'])));
    }

    public function store(InventoryItemRequest $request, SupplyChainService $service)
    {
        $item = $service->saveInventoryItem($request->validated());

        return $this->created(new InventoryItemResource($item), 'Inventory item created');
    }

    public function update(InventoryItemRequest $request, InventoryItem $inventoryItem, SupplyChainService $service)
    {
        $item = $service->saveInventoryItem($request->validated(), $inventoryItem);

        return $this->ok(new InventoryItemResource($item), 'Inventory item updated');
    }

    public function move(MoveInventoryItemRequest $request, InventoryItem $inventoryItem, SupplyChainService $service)
    {
        $item = $service->moveInventoryItem(
            $inventoryItem,
            $request->validated('storageLocationId'),
            $request->user()
        );

        return $this->ok($this->withRecordedMovements(new InventoryItemResource($item), $service), 'Item moved');
    }

    public function adjust(AdjustInventoryItemRequest $request, InventoryItem $inventoryItem, SupplyChainService $service)
    {
        $data = $request->validated();
        $data['source'] = $request->resolvedSource($inventoryItem);
        $item = $service->adjustInventory($inventoryItem, $data, $request->user());

        $messages = [
            'Damaged' => 'Units moved to quarantine',
            'Disposed' => 'Units disposed',
            'Return' => 'Units returned to vendor',
            'Lost' => 'Units recorded as lost',
            'ManualRelease' => 'Stock released',
        ];

        return $this->ok(
            $this->withRecordedMovements(new InventoryItemResource($item), $service),
            $messages[$data['type']] ?? 'Inventory adjusted'
        );
    }
}
