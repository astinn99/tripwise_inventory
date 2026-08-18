<?php

namespace App\Services;

use App\Http\Resources\DeliveryResource;
use App\Http\Resources\DocumentResource;
use App\Http\Resources\InventoryItemResource;
use App\Http\Resources\InventoryMovementResource;
use App\Http\Resources\NotificationResource;
use App\Http\Resources\OpportunityResource;
use App\Http\Resources\ProcurementRequestResource;
use App\Http\Resources\PurchaseOrderResource;
use App\Http\Resources\QuotationResource;
use App\Http\Resources\ReleaseResource;
use App\Http\Resources\StockCountResource;
use App\Http\Resources\StorageLocationResource;
use App\Http\Resources\SupplierResource;
use App\Http\Resources\SupplyRequestResource;
use App\Models\AppNotification;
use App\Models\Delivery;
use App\Models\Document;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\Quotation;
use App\Models\Release;
use App\Models\StockCount;
use App\Models\StorageLocation;
use App\Models\Supplier;
use App\Models\SupplierOpportunity;
use App\Models\SupplyRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AppBootstrapService
{
    public function __construct(private SupplyChainService $supplyChain) {}

    public function forUser(User $user, string $phase = 'core'): array
    {
        if ($user->isSupplier()) {
            return [
                ...$this->emptyCollections(),
                ...$this->supplierCollections($user),
            ];
        }

        return $phase === 'more'
            ? $this->internalMore()
            : $this->internalCore();
    }

    public function liveForUser(User $user, string $clientStamp = ''): array
    {
        $stamp = $this->liveStamp($user);

        if ($clientStamp === '' || $clientStamp === $stamp) {
            return ['stamp' => $stamp];
        }

        return [
            'stamp' => $stamp,
            ...($user->isSupplier() ? $this->supplierCollections($user) : $this->internalLiveCollections()),
        ];
    }

    public function dashboardTrends(?Collection $movements = null, ?Collection $items = null): array
    {
        $movements ??= InventoryMovement::query()
            ->where('created_at', '>=', Carbon::today()->subDays(6))
            ->get(['movement_type', 'quantity', 'created_at']);
        $items ??= InventoryItem::query()->get(['status', 'updated_at']);

        return [
            'movementTrend' => $this->movementTrend($movements),
            'lowStockTrend' => $this->lowStockTrend($items),
        ];
    }

    private function liveStamp(User $user): string
    {
        if ($user->isSupplier()) {
            $supplierId = (int) $user->supplier_id;
            $userId = (int) $user->id;
            $row = DB::selectOne(
                'SELECT
                    (SELECT COALESCE(MAX(id), 0) FROM quotations WHERE supplier_id = ?) AS quotations_id,
                    (SELECT COALESCE(CAST(MAX(updated_at) AS TEXT), \'0\') FROM quotations WHERE supplier_id = ?) AS quotations_at,
                    (SELECT COALESCE(MAX(id), 0) FROM purchase_orders WHERE supplier_id = ?) AS po_id,
                    (SELECT COALESCE(CAST(MAX(updated_at) AS TEXT), \'0\') FROM purchase_orders WHERE supplier_id = ?) AS po_at,
                    (SELECT COALESCE(MAX(id), 0) FROM supplier_opportunities WHERE supplier_id = ?) AS opp_id,
                    (SELECT COALESCE(MAX(id), 0) FROM supply_notifications WHERE user_id = ?) AS notif_id',
                [$supplierId, $supplierId, $supplierId, $supplierId, $supplierId, $userId]
            );
        } else {
            $row = DB::selectOne(
                'SELECT
                    (SELECT COALESCE(MAX(id), 0) FROM quotations) AS quotations_id,
                    (SELECT COALESCE(CAST(MAX(updated_at) AS TEXT), \'0\') FROM quotations) AS quotations_at,
                    (SELECT COALESCE(MAX(id), 0) FROM procurement_requests) AS pr_id,
                    (SELECT COALESCE(CAST(MAX(updated_at) AS TEXT), \'0\') FROM procurement_requests) AS pr_at,
                    (SELECT COALESCE(MAX(id), 0) FROM supply_notifications WHERE user_id IS NULL) AS notif_id'
            );
        }

        return implode('|', [
            $row->quotations_id ?? 0,
            $row->quotations_at ?? '0',
            $row->pr_id ?? 0,
            $row->pr_at ?? '0',
            $row->po_id ?? 0,
            $row->po_at ?? '0',
            $row->opp_id ?? 0,
            $row->notif_id ?? 0,
        ]);
    }

    private function internalLiveCollections(): array
    {
        return [
            'quotations' => $this->quotationsPayload(),
            'notifications' => $this->notificationsPayload(),
            'procurementRequests' => $this->procurementRequestsPayload(),
        ];
    }

    private function quotationsPayload(?int $supplierId = null): array
    {
        return $this->resolve(QuotationResource::collection(
            Quotation::query()
                ->with([
                    'procurementRequest:id,pr_number,item_code,item_name',
                    'procurementRequest.catalogItem:id,item_code,code,image_path',
                    'supplier:id,code,company_name',
                ])
                ->when($supplierId !== null, fn ($query) => $query->where('supplier_id', $supplierId))
                ->orderByDesc('id')
                ->get()
        ));
    }

    private function notificationsPayload(?int $userId = null): array
    {
        return $this->resolve(NotificationResource::collection(
            AppNotification::query()
                ->when(
                    $userId,
                    fn ($query) => $query->where('user_id', $userId),
                    fn ($query) => $query->whereNull('user_id')
                )
                ->orderByDesc('id')
                ->limit(40)
                ->get()
        ));
    }

    private function procurementRequestsPayload(): array
    {
        return $this->resolve(ProcurementRequestResource::collection(
            ProcurementRequest::query()
                ->with('catalogItem:id,item_code,code,image_path')
                ->withCount('opportunities')
                ->orderByDesc('id')
                ->get()
        ));
    }

    private function supplierCollections(User $user): array
    {
        $supplierId = $user->supplier_id;

        $purchaseOrders = PurchaseOrder::query()
            ->with(['items', 'procurementRequest:id,pr_number'])
            ->when($supplierId, fn ($query) => $query->where('supplier_id', $supplierId))
            ->orderByDesc('id')
            ->get();

        $opportunities = SupplierOpportunity::query()
            ->with('procurementRequest.catalogItem:id,item_code,code,image_path')
            ->when($supplierId, function ($query) use ($supplierId) {
                $query->where('supplier_id', $supplierId)
                    ->where('status', 'Open for Quotation')
                    ->whereDoesntHave('procurementRequest.quotations', function ($quotes) use ($supplierId) {
                        $quotes->where('supplier_id', $supplierId);
                    });
            })
            ->orderByDesc('id')
            ->get();

        return [
            'quotations' => $this->quotationsPayload($supplierId),
            'purchaseOrders' => $this->resolve(PurchaseOrderResource::collection($purchaseOrders)),
            'opportunities' => $this->resolve(OpportunityResource::collection($opportunities)),
            'notifications' => $this->notificationsPayload($user->id),
        ];
    }

    private function internalCore(): array
    {
        $inventory = InventoryItem::query()
            ->select([
                'id', 'code', 'item_code', 'description', 'category', 'quantity',
                'damaged_quantity', 'min_stock_level', 'unit', 'supplier_id', 'cost',
                'storage_location_id', 'serial_number', 'warranty', 'warranty_expires_on',
                'condition', 'image_path', 'status', 'updated_at',
            ])
            ->with([
                'supplier:id,company_name',
                'storageLocation:id,rack,shelf,bin',
            ])
            ->orderBy('item_code')
            ->get();

        $recentMovements = InventoryMovement::query()
            ->orderByDesc('id')
            ->limit(40)
            ->get();

        $trendMoves = InventoryMovement::query()
            ->where('created_at', '>=', Carbon::today()->subDays(6))
            ->get(['movement_type', 'quantity', 'created_at']);

        $trends = $this->dashboardTrends($trendMoves, $inventory);

        return [
            'inventory' => $this->resolve(InventoryItemResource::collection($inventory)),
            'supplyRequests' => $this->resolve(SupplyRequestResource::collection(
                SupplyRequest::query()
                    ->with([
                        'catalogItem:id,item_code,code,image_path',
                        'inventoryItem:id,code,image_path',
                    ])
                    ->orderByDesc('id')
                    ->get()
            )),
            'procurementRequests' => $this->procurementRequestsPayload(),
            'quotations' => $this->quotationsPayload(),
            'purchaseOrders' => $this->resolve(PurchaseOrderResource::collection(
                PurchaseOrder::query()
                    ->with(['items', 'procurementRequest:id,pr_number'])
                    ->orderByDesc('id')
                    ->get()
            )),
            'suppliers' => $this->resolve(SupplierResource::collection(
                Supplier::query()->orderBy('company_name')->get()
            )),
            'deliveries' => $this->resolve(DeliveryResource::collection(
                Delivery::query()->with('items')->orderByDesc('id')->get()
            )),
            'movements' => $this->resolve(InventoryMovementResource::collection($recentMovements)),
            'documents' => $this->resolve(DocumentResource::collection(
                Document::query()->orderByDesc('id')->get()
            )),
            'notifications' => $this->notificationsPayload(),
            'movementTrend' => $trends['movementTrend'],
            'lowStockTrend' => $trends['lowStockTrend'],
        ];
    }

    private function internalMore(): array
    {
        if (StorageLocation::query()->doesntExist()) {
            $this->supplyChain->bootstrapWarehouseLayout();
            $this->supplyChain->placeUnassignedItems();
        }

        return [
            'storageLocations' => $this->resolve(StorageLocationResource::collection(
                StorageLocation::query()->with('inventoryItems')->orderBy('rack')->orderBy('shelf')->orderBy('bin')->get()
            )),
            'releases' => $this->resolve(ReleaseResource::collection(
                Release::query()->orderByDesc('id')->get()
            )),
            'movements' => $this->resolve(InventoryMovementResource::collection(
                InventoryMovement::query()->orderByDesc('id')->get()
            )),
            'stockCounts' => $this->resolve(StockCountResource::collection(
                StockCount::query()->with('items')->orderByDesc('id')->get()
            )),
            'opportunities' => $this->resolve(OpportunityResource::collection(
                SupplierOpportunity::query()->with('procurementRequest.catalogItem:id,item_code,code,image_path')->orderByDesc('id')->get()
            )),
            'purchaseOrders' => $this->resolve(PurchaseOrderResource::collection(
                PurchaseOrder::query()
                    ->with(['items', 'timeline', 'procurementRequest:id,pr_number', 'supplierAccount:id,code'])
                    ->orderByDesc('id')
                    ->get()
            )),
            'documents' => $this->resolve(DocumentResource::collection(
                Document::query()->with(['inventoryItem:id,item_code', 'purchaseOrder:id,po_number', 'supplierAccount:id,company_name'])->orderByDesc('id')->get()
            )),
        ];
    }

    private function emptyCollections(): array
    {
        return [
            'inventory' => [],
            'supplyRequests' => [],
            'procurementRequests' => [],
            'quotations' => [],
            'purchaseOrders' => [],
            'suppliers' => [],
            'deliveries' => [],
            'storageLocations' => [],
            'releases' => [],
            'movements' => [],
            'stockCounts' => [],
            'documents' => [],
            'notifications' => [],
            'opportunities' => [],
            'movementTrend' => [],
            'lowStockTrend' => [],
        ];
    }

    private function movementTrend(Collection $movements): array
    {
        return collect(range(6, 0))->map(function (int $ago) use ($movements) {
            $date = Carbon::today()->subDays($ago);

            $dayMoves = $movements->filter(
                fn (InventoryMovement $movement) => $movement->created_at?->isSameDay($date)
            );

            return [
                'day' => $date->format('D'),
                'receiving' => (int) $dayMoves->where('movement_type', 'Receiving')->sum('quantity'),
                'releasing' => (int) $dayMoves->where('movement_type', 'Releasing')->sum('quantity'),
            ];
        })->values()->all();
    }

    private function lowStockTrend(Collection $items): array
    {
        return collect(range(4, 0))->map(function (int $ago) use ($items) {
            $start = Carbon::now()->startOfWeek()->subWeeks($ago);
            $end = (clone $start)->endOfWeek();

            return [
                'week' => 'W'.$start->weekOfYear.' '.$start->format('M'),
                'count' => $items
                    ->whereIn('status', ['LOW STOCK', 'OUT OF STOCK'])
                    ->filter(fn (InventoryItem $item) => $item->updated_at && $item->updated_at->between($start, $end))
                    ->count(),
            ];
        })->values()->all();
    }

    private function resolve(JsonResource $resource): array
    {
        return $resource->resolve();
    }
}
