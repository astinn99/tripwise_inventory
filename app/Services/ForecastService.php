<?php

namespace App\Services;

use App\Models\ForecastPoint;
use App\Models\ForecastRun;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Quotation;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Process;
use Illuminate\Validation\ValidationException;

class ForecastService
{
    public const MIN_PROPHET_NONZERO_DAYS = 2;

    public const DEFAULT_HORIZON = 30;

    public const DEFAULT_LEAD_TIME = 14;

    public const SAFETY_DAYS = 7;

    /**
     * @param  array<string, int|float>  $dailyNet
     * @return array<string, int>
     */
    public function reconstructOnHand(int $currentQty, array $dailyNet, string $from, string $to): array
    {
        $cursor = Carbon::parse($to)->startOfDay();
        $start = Carbon::parse($from)->startOfDay();
        $onHand = [];
        $qty = $currentQty;

        while ($cursor->gte($start)) {
            $date = $cursor->toDateString();
            $onHand[$date] = (int) round($qty);
            $cursor->subDay();
            $qty -= (float) ($dailyNet[$cursor->copy()->addDay()->toDateString()] ?? 0);
        }

        ksort($onHand);

        return $onHand;
    }

    /**
     * @param  array<string, int|float>  $demandByDate
     * @param  array<string, int|float>  $inboundByDate
     * @return array<string, int>
     */
    public function projectOnHand(int $currentQty, array $demandByDate, array $inboundByDate): array
    {
        $projected = [];
        $qty = $currentQty;
        $dates = array_keys($demandByDate);
        sort($dates);

        foreach ($dates as $date) {
            $qty += (float) ($inboundByDate[$date] ?? 0);
            $qty -= (float) ($demandByDate[$date] ?? 0);
            $projected[$date] = (int) round($qty);
        }

        return $projected;
    }

    /**
     * @param  array<string, int|float>  $projectedOnHand
     */
    public function stockoutDate(array $projectedOnHand): ?string
    {
        foreach ($projectedOnHand as $date => $qty) {
            if ((int) $qty < 0) {
                return (string) $date;
            }
        }

        return null;
    }

    /**
     * @param  array<string, int|float>  $demandByDate
     * @param  array<string, int|float>  $inboundByDate
     */
    public function reorderQuantity(
        int $currentQty,
        int $minStock,
        array $demandByDate,
        array $inboundByDate,
        int $leadTimeDays,
    ): int {
        $coverage = max(1, $leadTimeDays + self::SAFETY_DAYS);
        $dates = array_keys($demandByDate);
        sort($dates);
        $window = array_slice($dates, 0, $coverage);

        $forecasted = 0.0;
        $inbound = 0.0;
        foreach ($window as $date) {
            $forecasted += (float) ($demandByDate[$date] ?? 0);
            $inbound += (float) ($inboundByDate[$date] ?? 0);
        }

        $need = $minStock + $forecasted;
        $have = $currentQty + $inbound;

        return max(0, (int) ceil($need - $have));
    }

    public function listRuns(?int $horizon = null): array
    {
        $horizon ??= self::DEFAULT_HORIZON;
        $runs = ForecastRun::query()
            ->where('horizon_days', $horizon)
            ->orderByRaw('stockout_on is null')
            ->orderBy('stockout_on')
            ->orderByDesc('reorder_qty')
            ->orderBy('item_code')
            ->get();

        $openPrs = $this->openProcurementNumbers();

        return $runs->map(fn (ForecastRun $run) => $this->runPayload($run, $openPrs))->all();
    }

    public function show(string $itemCode, ?int $horizon = null): array
    {
        $horizon ??= self::DEFAULT_HORIZON;
        $run = ForecastRun::query()
            ->where('item_code', $itemCode)
            ->where('horizon_days', $horizon)
            ->first();

        if (! $run) {
            throw ValidationException::withMessages([
                'itemCode' => ['No forecast has been generated for this item yet.'],
            ]);
        }

        return $this->detailPayload($run);
    }

    public function refresh(string $itemCode, int $horizon = self::DEFAULT_HORIZON): array
    {
        $item = InventoryItem::query()->where('item_code', $itemCode)->firstOrFail();
        $run = $this->generateRun($item, $horizon, false);

        return $this->detailPayload($run);
    }

    public function refreshAfterMovement(string $itemCode): void
    {
        $item = InventoryItem::query()->where('item_code', $itemCode)->firstOrFail();
        $horizons = ForecastRun::query()
            ->where('item_code', $item->item_code)
            ->pluck('horizon_days');

        if ($horizons->isEmpty()) {
            $this->generateRun($item, self::DEFAULT_HORIZON, true);

            return;
        }

        foreach ($horizons as $horizon) {
            $this->generateRun($item, (int) $horizon, true);
        }
    }

    public function refreshAll(int $horizon = self::DEFAULT_HORIZON): int
    {
        $count = 0;

        InventoryItem::query()
            ->orderBy('item_code')
            ->each(function (InventoryItem $item) use ($horizon, &$count): void {
                $this->generateRun($item, $horizon, false);
                $count++;
            });

        return $count;
    }

    private function generateRun(InventoryItem $item, int $horizon, bool $fast): ForecastRun
    {
        $today = now()->toDateString();
        $movements = InventoryMovement::query()
            ->where('item_code', $item->item_code)
            ->orderBy('id')
            ->get(['movement_type', 'quantity', 'moved_at', 'created_at']);

        [$demandByDate, $dailyNet] = $this->bucketMovements($movements);
        $historyFrom = $this->historyStart($demandByDate, $dailyNet, $today);
        $actualDemand = $this->fillDaily($demandByDate, $historyFrom, $today);
        $onHandActual = $this->reconstructOnHand((int) $item->quantity, $dailyNet, $historyFrom, $today);
        $existing = ForecastRun::query()
            ->where('item_code', $item->item_code)
            ->where('horizon_days', $horizon)
            ->first();
        $leadTime = $fast && $existing
            ? (int) $existing->lead_time_days
            : $this->leadTimeDays($item->item_code);
        $inboundByDate = $this->inboundByDate($item->item_code, $today, $horizon, $leadTime);

        $nonzeroDays = collect($actualDemand)->filter(fn ($qty) => $qty > 0)->count();
        $status = 'ready';
        $error = null;
        $forecastPoints = [];

        if ($fast || $nonzeroDays < self::MIN_PROPHET_NONZERO_DAYS) {
            $model = 'mean';
            $forecastPoints = $this->meanForecast($actualDemand, $today, $horizon);
        } else {
            $model = 'prophet';
            try {
                $forecastPoints = $this->invokeProphet($actualDemand, $horizon);
            } catch (\Throwable $e) {
                $status = 'error';
                $error = $e->getMessage();
                $forecastPoints = $this->meanForecast($actualDemand, $today, $horizon);
            }
        }

        $futureDemand = [];
        foreach ($forecastPoints as $point) {
            if (($point['ds'] ?? '') > $today) {
                $futureDemand[$point['ds']] = max(0, (float) ($point['yhat'] ?? 0));
            }
        }

        $onHandProjected = $this->projectOnHand((int) $item->quantity, $futureDemand, $inboundByDate);
        $stockoutOn = $this->stockoutDate($onHandProjected);
        $reorderQty = $this->reorderQuantity(
            (int) $item->quantity,
            (int) $item->min_stock_level,
            $futureDemand,
            $inboundByDate,
            $leadTime,
        );

        $prNumber = $this->openProcurementNumber($item->item_code);

        ForecastRun::query()
            ->where('item_code', $item->item_code)
            ->where('horizon_days', $horizon)
            ->delete();

        $run = ForecastRun::query()->create([
            'item_code' => $item->item_code,
            'item_name' => $item->description,
            'horizon_days' => $horizon,
            'model' => $model,
            'lead_time_days' => $leadTime,
            'reorder_qty' => $reorderQty,
            'stockout_on' => $stockoutOn,
            'procurement_pr_number' => $prNumber,
            'current_qty' => (int) $item->quantity,
            'min_stock_level' => (int) $item->min_stock_level,
            'generated_at' => now(),
            'status' => $status,
            'error' => $error,
        ]);

        $this->storePoints($run, $actualDemand, $onHandActual, $forecastPoints, $onHandProjected, $inboundByDate, $today);

        return $run->load('points');
    }

    /**
     * @param  Collection<int, InventoryMovement>  $movements
     * @return array{0: array<string, int>, 1: array<string, int>}
     */
    private function bucketMovements(Collection $movements): array
    {
        $demand = [];
        $net = [];

        foreach ($movements as $movement) {
            $date = $this->movementDate($movement);
            $qty = (int) $movement->quantity;
            $type = (string) $movement->movement_type;

            if ($type === 'Receiving') {
                $net[$date] = ($net[$date] ?? 0) + $qty;

                continue;
            }

            if ($type === 'Transfer') {
                continue;
            }

            $net[$date] = ($net[$date] ?? 0) - $qty;

            if ($type === 'Releasing') {
                $demand[$date] = ($demand[$date] ?? 0) + $qty;
            }
        }

        return [$demand, $net];
    }

    private function movementDate(InventoryMovement $movement): string
    {
        try {
            if (filled($movement->moved_at)) {
                return Carbon::parse($movement->moved_at)->toDateString();
            }
        } catch (\Throwable) {
        }

        return optional($movement->created_at)?->toDateString() ?? now()->toDateString();
    }

    /**
     * @param  array<string, int|float>  $demand
     * @param  array<string, int|float>  $net
     */
    private function historyStart(array $demand, array $net, string $today): string
    {
        $dates = array_merge(array_keys($demand), array_keys($net));
        if ($dates === []) {
            return Carbon::parse($today)->subDays(13)->toDateString();
        }

        sort($dates);

        return $dates[0];
    }

    /**
     * @param  array<string, int|float>  $values
     * @return array<string, int>
     */
    private function fillDaily(array $values, string $from, string $to): array
    {
        $filled = [];
        $cursor = Carbon::parse($from)->startOfDay();
        $end = Carbon::parse($to)->startOfDay();

        while ($cursor->lte($end)) {
            $date = $cursor->toDateString();
            $filled[$date] = (int) ($values[$date] ?? 0);
            $cursor->addDay();
        }

        return $filled;
    }

    public function leadTimeDays(string $itemCode): int
    {
        $quoteDays = Quotation::query()
            ->whereHas('procurementRequest', fn ($query) => $query->where('item_code', $itemCode))
            ->where('delivery_time_days', '>', 0)
            ->pluck('delivery_time_days');

        if ($quoteDays->isNotEmpty()) {
            return max(1, (int) round($this->median($quoteDays->all())));
        }

        $poDays = PurchaseOrder::query()
            ->whereHas('items', fn ($query) => $query->where('item_code', $itemCode))
            ->whereNotNull('delivery_date')
            ->whereNotNull('created_date')
            ->get()
            ->map(function (PurchaseOrder $po): ?int {
                try {
                    $created = Carbon::parse($po->created_date);
                    $delivery = Carbon::parse($po->delivery_date);
                } catch (\Throwable) {
                    return null;
                }

                $days = $created->diffInDays($delivery, false);

                return $days > 0 ? (int) $days : null;
            })
            ->filter();

        if ($poDays->isNotEmpty()) {
            return max(1, (int) round($this->median($poDays->all())));
        }

        return self::DEFAULT_LEAD_TIME;
    }

    /**
     * @param  list<int|float>  $values
     */
    private function median(array $values): float
    {
        sort($values);
        $count = count($values);
        $middle = intdiv($count, 2);

        if ($count % 2 === 1) {
            return (float) $values[$middle];
        }

        return ((float) $values[$middle - 1] + (float) $values[$middle]) / 2;
    }

    /**
     * @return array<string, int>
     */
    private function inboundByDate(string $itemCode, string $today, int $horizon, int $leadTime): array
    {
        $inbound = [];
        $horizonEnd = Carbon::parse($today)->addDays($horizon)->toDateString();

        PurchaseOrderItem::query()
            ->where('item_code', $itemCode)
            ->whereColumn('delivered_qty', '<', 'quantity')
            ->with('purchaseOrder')
            ->get()
            ->each(function (PurchaseOrderItem $line) use (&$inbound, $today, $horizonEnd, $leadTime): void {
                $remaining = max(0, (int) $line->quantity - (int) $line->delivered_qty);
                if ($remaining < 1 || ! $line->purchaseOrder) {
                    return;
                }

                $date = $today;
                $raw = $line->purchaseOrder->delivery_date ?: null;
                if (filled($raw)) {
                    try {
                        $date = Carbon::parse($raw)->toDateString();
                    } catch (\Throwable) {
                        $date = $today;
                    }
                } elseif ($line->purchaseOrder->created_date) {
                    $date = Carbon::parse($line->purchaseOrder->created_date)->addDays($leadTime)->toDateString();
                }

                if ($date < $today) {
                    $date = $today;
                }
                if ($date > $horizonEnd) {
                    return;
                }

                $inbound[$date] = ($inbound[$date] ?? 0) + $remaining;
            });

        return $inbound;
    }

    /**
     * @param  array<string, int>  $actualDemand
     * @return list<array{ds: string, yhat: float, yhat_lower: float, yhat_upper: float}>
     */
    private function meanForecast(array $actualDemand, string $today, int $horizon): array
    {
        $tail = array_slice($actualDemand, -14, 14, true);
        $mean = $tail === [] ? 0.0 : array_sum($tail) / count($tail);
        $points = [];

        foreach ($actualDemand as $ds => $y) {
            $points[] = [
                'ds' => $ds,
                'yhat' => $mean,
                'yhat_lower' => $mean,
                'yhat_upper' => $mean,
            ];
        }

        for ($offset = 1; $offset <= $horizon; $offset++) {
            $ds = Carbon::parse($today)->addDays($offset)->toDateString();
            $points[] = [
                'ds' => $ds,
                'yhat' => $mean,
                'yhat_lower' => $mean,
                'yhat_upper' => $mean,
            ];
        }

        return $points;
    }

    /**
     * @param  array<string, int>  $actualDemand
     * @return list<array{ds: string, yhat: float, yhat_lower: float, yhat_upper: float}>
     */
    private function invokeProphet(array $actualDemand, int $horizon): array
    {
        $series = [];
        foreach ($actualDemand as $ds => $y) {
            $series[] = ['ds' => $ds, 'y' => $y];
        }

        $python = (string) config('services.forecast.python');
        $script = (string) config('services.forecast.script');

        if ($python === '' || $script === '' || ! is_file($script)) {
            throw new \RuntimeException('Python unavailable');
        }

        $result = Process::timeout(90)
            ->input(json_encode(['series' => $series, 'horizon' => $horizon], JSON_THROW_ON_ERROR))
            ->run([$python, $script]);

        if (! $result->successful()) {
            throw new \RuntimeException(trim($result->errorOutput()) !== '' ? trim($result->errorOutput()) : 'Python unavailable');
        }

        $payload = json_decode($result->output(), true);
        if (! is_array($payload) || ! isset($payload['points']) || ! is_array($payload['points'])) {
            throw new \RuntimeException('Python unavailable');
        }

        $points = [];
        foreach ($payload['points'] as $point) {
            if (! isset($point['ds'])) {
                continue;
            }
            $points[] = [
                'ds' => (string) $point['ds'],
                'yhat' => (float) ($point['yhat'] ?? 0),
                'yhat_lower' => (float) ($point['yhat_lower'] ?? $point['yhat'] ?? 0),
                'yhat_upper' => (float) ($point['yhat_upper'] ?? $point['yhat'] ?? 0),
            ];
        }

        return $points;
    }

    /**
     * @param  array<string, int>  $actualDemand
     * @param  array<string, int>  $onHandActual
     * @param  list<array{ds: string, yhat: float, yhat_lower: float, yhat_upper: float}>  $forecastPoints
     * @param  array<string, int>  $onHandProjected
     * @param  array<string, int>  $inboundByDate
     */
    private function storePoints(
        ForecastRun $run,
        array $actualDemand,
        array $onHandActual,
        array $forecastPoints,
        array $onHandProjected,
        array $inboundByDate,
        string $today,
    ): void {
        $byDate = [];

        foreach ($actualDemand as $ds => $qty) {
            $byDate[$ds] = [
                'ds' => $ds,
                'actual_demand' => $qty,
                'yhat' => null,
                'yhat_lower' => null,
                'yhat_upper' => null,
                'on_hand_actual' => $onHandActual[$ds] ?? null,
                'on_hand_projected' => null,
                'inbound' => $inboundByDate[$ds] ?? 0,
            ];
        }

        foreach ($forecastPoints as $point) {
            $ds = $point['ds'];
            $byDate[$ds] ??= [
                'ds' => $ds,
                'actual_demand' => $ds <= $today ? ($actualDemand[$ds] ?? 0) : null,
                'yhat' => null,
                'yhat_lower' => null,
                'yhat_upper' => null,
                'on_hand_actual' => $ds <= $today ? ($onHandActual[$ds] ?? null) : null,
                'on_hand_projected' => null,
                'inbound' => $inboundByDate[$ds] ?? 0,
            ];
            $byDate[$ds]['yhat'] = $point['yhat'];
            $byDate[$ds]['yhat_lower'] = $point['yhat_lower'];
            $byDate[$ds]['yhat_upper'] = $point['yhat_upper'];
        }

        foreach ($onHandProjected as $ds => $qty) {
            $byDate[$ds] ??= [
                'ds' => $ds,
                'actual_demand' => null,
                'yhat' => null,
                'yhat_lower' => null,
                'yhat_upper' => null,
                'on_hand_actual' => null,
                'on_hand_projected' => $qty,
                'inbound' => $inboundByDate[$ds] ?? 0,
            ];
            $byDate[$ds]['on_hand_projected'] = $qty;
            $byDate[$ds]['inbound'] = $inboundByDate[$ds] ?? ($byDate[$ds]['inbound'] ?? 0);
        }

        ksort($byDate);

        $now = now();
        $rows = [];
        foreach ($byDate as $row) {
            $rows[] = [
                'forecast_run_id' => $run->id,
                'ds' => $row['ds'],
                'actual_demand' => $row['actual_demand'],
                'yhat' => $row['yhat'],
                'yhat_lower' => $row['yhat_lower'],
                'yhat_upper' => $row['yhat_upper'],
                'on_hand_actual' => $row['on_hand_actual'],
                'on_hand_projected' => $row['on_hand_projected'],
                'inbound' => $row['inbound'],
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if ($rows !== []) {
            ForecastPoint::query()->insert($rows);
        }
    }

    private function openProcurementNumber(string $itemCode): ?string
    {
        $pr = ProcurementRequest::query()
            ->where('item_code', $itemCode)
            ->whereIn('status', ['For Procurement', 'Quotation'])
            ->where(fn ($query) => $query->whereNull('po_number')->orWhere('po_number', ''))
            ->orderByDesc('id')
            ->first();

        return $pr?->pr_number;
    }

    /**
     * @return array<string, string>
     */
    private function openProcurementNumbers(): array
    {
        return ProcurementRequest::query()
            ->whereIn('status', ['For Procurement', 'Quotation'])
            ->where(fn ($query) => $query->whereNull('po_number')->orWhere('po_number', ''))
            ->orderBy('id')
            ->get()
            ->mapWithKeys(fn (ProcurementRequest $pr) => [$pr->item_code => $pr->pr_number])
            ->all();
    }

    private function runPayload(ForecastRun $run, array $openPrs = []): array
    {
        $prNumber = $run->procurement_pr_number ?: ($openPrs[$run->item_code] ?? null);

        return [
            'itemCode' => $run->item_code,
            'itemName' => $run->item_name,
            'horizonDays' => $run->horizon_days,
            'model' => $run->model,
            'leadTimeDays' => $run->lead_time_days,
            'reorderQty' => $run->reorder_qty,
            'stockoutOn' => optional($run->stockout_on)?->toDateString() ?? $run->stockout_on,
            'procurementPrNumber' => $prNumber,
            'currentQty' => $run->current_qty,
            'minStockLevel' => $run->min_stock_level,
            'generatedAt' => optional($run->generated_at)?->format('Y-m-d H:i'),
            'status' => $run->status,
            'error' => $run->error,
            'forecastBadge' => $this->badge($run),
        ];
    }

    private function detailPayload(ForecastRun $run): array
    {
        $run->loadMissing('points');
        $openPrs = $this->openProcurementNumbers();

        return [
            'run' => $this->runPayload($run, $openPrs),
            'points' => $run->points->map(fn (ForecastPoint $point) => [
                'ds' => optional($point->ds)?->toDateString() ?? $point->ds,
                'actualDemand' => $point->actual_demand,
                'yhat' => $point->yhat,
                'yhatLower' => $point->yhat_lower,
                'yhatUpper' => $point->yhat_upper,
                'onHandActual' => $point->on_hand_actual,
                'onHandProjected' => $point->on_hand_projected,
                'inbound' => $point->inbound,
            ])->all(),
        ];
    }

    private function badge(ForecastRun $run): string
    {
        if ($run->status === 'error') {
            return 'No forecast';
        }
        if ($run->stockout_on) {
            return 'At risk';
        }

        return 'Covered';
    }
}
