<?php

namespace App\Console\Commands;

use App\Services\SupplyChainService;
use Illuminate\Console\Command;

class CheckOverdueRfqs extends Command
{
    protected $signature = 'rfq:check-overdue';

    protected $description = 'Alert supply staff when an RFQ deadline has passed with no vendor quotations.';

    public function handle(SupplyChainService $service): int
    {
        $notified = $service->flagOverdueRfqs();
        $this->info("Sent {$notified} overdue RFQ notification(s).");

        return self::SUCCESS;
    }
}
