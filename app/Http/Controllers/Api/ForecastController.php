<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ForecastRefreshRequest;
use App\Services\ForecastService;
use Illuminate\Http\Request;

class ForecastController extends Controller
{
    public function index(Request $request, ForecastService $forecasts)
    {
        $horizon = (int) $request->query('horizon', ForecastService::DEFAULT_HORIZON);
        $horizon = max(7, min(90, $horizon));

        return $this->ok($forecasts->listRuns($horizon));
    }

    public function show(string $itemCode, Request $request, ForecastService $forecasts)
    {
        $horizon = (int) $request->query('horizon', ForecastService::DEFAULT_HORIZON);
        $horizon = max(7, min(90, $horizon));

        return $this->ok($forecasts->show($itemCode, $horizon));
    }

    public function refresh(ForecastRefreshRequest $request, ForecastService $forecasts)
    {
        return $this->ok(
            $forecasts->refresh($request->validated('itemCode'), $request->horizon()),
            'Forecast refreshed'
        );
    }
}
