<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BootstrapController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DeliveryController;
use App\Http\Controllers\Api\DepartmentSupplyApiController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\ForecastController;
use App\Http\Controllers\Api\InventoryItemController;
use App\Http\Controllers\Api\InventoryMovementController;
use App\Http\Controllers\Api\LiveSyncController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OpportunityController;
use App\Http\Controllers\Api\ProcurementRequestController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\QuotationController;
use App\Http\Controllers\Api\ReleaseController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\StockCountController;
use App\Http\Controllers\Api\StorageLocationController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\SupplyRequestController;
use App\Http\Controllers\Api\VendorMessageController;
use App\Http\Controllers\Api\VendorRegistrationController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/login/otp', [AuthController::class, 'verifyLoginOtp'])->middleware('throttle:10,1');
Route::post('/login/otp/resend', [AuthController::class, 'resendLoginOtp'])->middleware('throttle:6,1');
Route::post('/vendor/register', [VendorRegistrationController::class, 'store'])->middleware('throttle:6,1');
Route::post('/vendor/register/verify', [VendorRegistrationController::class, 'verify'])->middleware('throttle:10,1');
Route::post('/vendor/register/resend', [VendorRegistrationController::class, 'resend'])->middleware('throttle:6,1');

Route::middleware('department')->prefix('department')->group(function () {
    Route::get('/items', [DepartmentSupplyApiController::class, 'items']);
    Route::get('/items/{itemCode}', [DepartmentSupplyApiController::class, 'showItem']);
    Route::get('/supply-requests/{supplyRequest}', [DepartmentSupplyApiController::class, 'showRequest']);
    Route::post('/supply-requests', [DepartmentSupplyApiController::class, 'storeRequest']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::get('/bootstrap', BootstrapController::class);
    Route::get('/live', LiveSyncController::class);

    Route::get('/quotations', [QuotationController::class, 'index']);
    Route::match(['get', 'post'], '/quotation-uploads', [QuotationController::class, 'upload']);
    Route::post('/quotations', [QuotationController::class, 'store']);
    Route::match(['put', 'post'], '/quotations/{quotation}', [QuotationController::class, 'update']);
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index']);
    Route::post('/purchase-orders/{purchaseOrder}/confirm', [PurchaseOrderController::class, 'confirm']);
    Route::get('/opportunities', [OpportunityController::class, 'index']);
    Route::post('/procurement-requests/{procurementRequest}/cancel', [ProcurementRequestController::class, 'cancel']);
    Route::get('/vendor/profile', [VendorRegistrationController::class, 'profile']);
    Route::put('/vendor/profile', [VendorRegistrationController::class, 'update']);
    Route::post('/vendor/profile/credentials/{document}', [VendorRegistrationController::class, 'replaceCredential']);
    Route::get('/documents/{document}/download', [DocumentController::class, 'download']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::get('/messages', [VendorMessageController::class, 'index']);
    Route::post('/messages', [VendorMessageController::class, 'store']);
    Route::post('/messages/read', [VendorMessageController::class, 'markRead']);

    Route::middleware('internal')->group(function () {
        Route::get('/inventory-items', [InventoryItemController::class, 'index']);
        Route::get('/inventory-items/{inventoryItem}', [InventoryItemController::class, 'show']);
        Route::post('/inventory-items', [InventoryItemController::class, 'store']);
        Route::post('/inventory-items/{inventoryItem}/move', [InventoryItemController::class, 'move']);
        Route::post('/inventory-items/{inventoryItem}/adjust', [InventoryItemController::class, 'adjust']);
        Route::match(['put', 'post'], '/inventory-items/{inventoryItem}', [InventoryItemController::class, 'update']);
        Route::delete('/inventory-items/{inventoryItem}', [InventoryItemController::class, 'destroy']);

        Route::get('/storage-locations', [StorageLocationController::class, 'index']);
        Route::post('/storage-locations', [StorageLocationController::class, 'store']);
        Route::post('/storage-locations/bootstrap', [StorageLocationController::class, 'bootstrap']);
        Route::get('/supply-requests', [SupplyRequestController::class, 'index']);
        Route::post('/supply-requests/{supplyRequest}/check-stock', [SupplyRequestController::class, 'checkStock']);
        Route::post('/supply-requests/{supplyRequest}/release', [SupplyRequestController::class, 'release']);

        Route::get('/procurement-requests', [ProcurementRequestController::class, 'index']);
        Route::post('/procurement-requests', [ProcurementRequestController::class, 'store']);
        Route::put('/procurement-requests/{procurementRequest}', [ProcurementRequestController::class, 'update']);
        Route::post('/procurement-requests/{procurementRequest}/send-to-vendors', [ProcurementRequestController::class, 'sendToVendors']);

        Route::post('/quotations/{quotation}/select', [QuotationController::class, 'select']);
        Route::post('/purchase-orders/{purchaseOrder}/finance-decision', [PurchaseOrderController::class, 'financeDecision']);

        Route::get('/suppliers', [SupplierController::class, 'index']);
        Route::get('/suppliers/{supplier}', [SupplierController::class, 'show']);
        Route::post('/suppliers/{supplier}/approve', [SupplierController::class, 'approve']);
        Route::get('/deliveries', [DeliveryController::class, 'index']);
        Route::post('/deliveries/{delivery}/inspect', [DeliveryController::class, 'inspect']);
        Route::get('/releases', [ReleaseController::class, 'index']);
        Route::get('/inventory-movements', [InventoryMovementController::class, 'index']);

        Route::get('/stock-counts', [StockCountController::class, 'index']);
        Route::post('/stock-counts', [StockCountController::class, 'store']);
        Route::post('/stock-counts/{stockCount}/submit', [StockCountController::class, 'submit']);

        Route::get('/documents', [DocumentController::class, 'index']);
        Route::post('/documents', [DocumentController::class, 'store']);

        Route::get('/dashboard', DashboardController::class);
        Route::get('/reports', ReportController::class);
        Route::get('/forecasts', [ForecastController::class, 'index']);
        Route::get('/forecasts/{itemCode}', [ForecastController::class, 'show']);
        Route::post('/forecasts/refresh', [ForecastController::class, 'refresh']);
    });
});
