<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

// php artisan serve is single-threaded. Serve public files (item photos, built JS)
// without booting Laravel so images are not stuck behind /api/live and /api/bootstrap.
if (PHP_SAPI === 'cli-server') {
    $requestPath = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    if ($requestPath !== '/' && ! str_ends_with(strtolower($requestPath), '.php')) {
        $publicRoot = realpath(__DIR__);
        $assetPath = realpath(__DIR__.str_replace('/', DIRECTORY_SEPARATOR, $requestPath));
        if ($publicRoot && $assetPath && is_file($assetPath) && str_starts_with($assetPath, $publicRoot)) {
            $extension = strtolower(pathinfo($assetPath, PATHINFO_EXTENSION));
            $mimes = [
                'png' => 'image/png',
                'jpg' => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'gif' => 'image/gif',
                'webp' => 'image/webp',
                'svg' => 'image/svg+xml',
                'ico' => 'image/x-icon',
                'css' => 'text/css',
                'js' => 'text/javascript',
                'woff' => 'font/woff',
                'woff2' => 'font/woff2',
                'map' => 'application/json',
            ];
            header('Content-Type: '.($mimes[$extension] ?? (mime_content_type($assetPath) ?: 'application/octet-stream')));
            header('Content-Length: '.(string) filesize($assetPath));
            if (isset($mimes[$extension]) && str_starts_with($mimes[$extension], 'image/')) {
                header('Cache-Control: public, max-age=86400');
            }
            readfile($assetPath);
            exit;
        }
    }
}

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
