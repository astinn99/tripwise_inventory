<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppBootstrapService;

class DashboardController extends Controller
{
    public function __invoke(AppBootstrapService $bootstrap)
    {
        return $this->ok($bootstrap->dashboardTrends());
    }
}
