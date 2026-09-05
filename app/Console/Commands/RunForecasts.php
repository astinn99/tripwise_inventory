<?php

namespace App\Console\Commands;

use App\Services\ForecastService;
use Illuminate\Console\Command;

class RunForecasts extends Command
{
    protected $signature = 'forecasts:run {--horizon=30}';

    protected $description = 'Generate demand forecasts for every SKU.';

    public function handle(ForecastService $forecasts): int
    {
        $horizon = max(7, min(90, (int) $this->option('horizon')));
        $count = $forecasts->refreshAll($horizon);

        $this->info("Generated forecasts for {$count} item(s).");

        return self::SUCCESS;
    }
}
