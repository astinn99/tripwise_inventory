<?php

use Illuminate\Support\Facades\Route;

Route::view('/', 'welcome');
Route::view('/vendor/{any?}', 'welcome')->where('any', '.*');
