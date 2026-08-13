<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReleaseResource;
use App\Models\Release;

class ReleaseController extends Controller
{
    public function index()
    {
        return $this->ok(ReleaseResource::collection(Release::query()->orderByDesc('id')->get()));
    }
}
