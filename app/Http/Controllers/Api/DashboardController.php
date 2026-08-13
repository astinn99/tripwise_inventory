<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __invoke()
    {
        $days = collect(range(6, 0))->map(function (int $ago) {
            $date = Carbon::today()->subDays($ago);

            return [
                'day' => $date->format('D'),
                'receiving' => InventoryMovement::query()
                    ->where('movement_type', 'Receiving')
                    ->whereDate('created_at', $date)
                    ->sum('quantity'),
                'releasing' => InventoryMovement::query()
                    ->where('movement_type', 'Releasing')
                    ->whereDate('created_at', $date)
                    ->sum('quantity'),
            ];
        });

        $weeks = collect(range(4, 0))->map(function (int $ago) {
            $start = Carbon::now()->startOfWeek()->subWeeks($ago);
            $end = (clone $start)->endOfWeek();

            return [
                'week' => 'W'.$start->weekOfYear.' '.$start->format('M'),
                'count' => DB::table('inventory_items')
                    ->whereNull('deleted_at')
                    ->whereIn('status', ['LOW STOCK', 'OUT OF STOCK'])
                    ->whereBetween('updated_at', [$start, $end])
                    ->count(),
            ];
        });

        return $this->ok([
            'movementTrend' => $days->values(),
            'lowStockTrend' => $weeks->values(),
        ]);
    }
}
