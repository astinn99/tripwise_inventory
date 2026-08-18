<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppBootstrapService;
use Illuminate\Http\Request;

class LiveSyncController extends Controller
{
    public function __invoke(Request $request, AppBootstrapService $bootstrap)
    {
        return $this->ok($bootstrap->liveForUser(
            $request->user(),
            (string) $request->query('stamp', ''),
        ));
    }
}
