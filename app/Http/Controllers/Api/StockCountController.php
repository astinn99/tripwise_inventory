<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StockCountSubmitRequest;
use App\Http\Resources\StockCountResource;
use App\Models\StockCount;
use App\Services\SupplyChainService;
use Illuminate\Http\Request;

class StockCountController extends Controller
{
    public function index()
    {
        return $this->ok(StockCountResource::collection(
            StockCount::query()->with('items')->orderByDesc('id')->get()
        ));
    }

    public function store(Request $request, SupplyChainService $service)
    {
        if (! $request->user()->canOperateWarehouse()) {
            return $this->fail('You are not allowed to start a stock count.', 403);
        }

        $count = $service->startStockCount(
            (string) $request->input('title', ''),
            (string) $request->input('location', ''),
            $request->user()
        );

        return $this->created(new StockCountResource($count), 'Stock count started');
    }

    public function submit(StockCountSubmitRequest $request, StockCount $stockCount, SupplyChainService $service)
    {
        $count = $service->submitPhysicalCount($stockCount, $request->validated('items'), $request->user());

        return $this->ok($this->withRecordedMovements(new StockCountResource($count), $service), 'Stock count submitted');
    }
}
