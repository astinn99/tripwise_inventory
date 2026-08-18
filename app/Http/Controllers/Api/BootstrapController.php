<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AppBootstrapService;
use Illuminate\Http\Request;

class BootstrapController extends Controller
{
    public function __invoke(Request $request, AppBootstrapService $bootstrap)
    {
        $phase = $request->query('phase', 'core');

        return $this->ok($bootstrap->forUser($request->user(), $phase === 'more' ? 'more' : 'core'));
    }
}
