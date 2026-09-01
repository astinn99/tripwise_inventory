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
use App\Support\Priority;
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

    public function liveForUser(User $user, array $query = []): array
    {
        $stamps = $this->liveStamps($user);
        $payload = [
            'stamp' => implode('|', $stamps),
            'stamps' => $stamps,
        ];

        $hasCollectionStamps = array_key_exists('quotations', $query)
            || array_key_exists('notifications', $query)
            || array_key_exists('purchaseOrders', $query)
            || array_key_exists('opportunities', $query)
            || array_key_exists('procurementRequests', $query)
            || array_key_exists('inventory', $query)
            || array_key_exists('deliveries', $query)
            || array_key_exists('movements', $query)
            || array_key_exists('supplyRequests', $query)
            || array_key_exists('releases', $query)
            || array_key_exists('suppliers', $query);

        $clientStamp = (string) ($query['stamp'] ?? '');

        if (! $hasCollectionStamps) {
            if ($clientStamp === '' || $clientStamp === $payload['stamp']) {
                return $payload;
            }

            foreach ($stamps as $key => $stamp) {
                $payload[$key] = $this->liveCollection($user, $key);
            }

            return $payload;
        }

        foreach ($stamps as $key => $stamp) {
            if ((string) ($query[$key] ?? '') === (string) $stamp) {
                continue;
            }

            $payload[$key] = $this->liveCollection($user, $key);
        }

        return $payload;
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

    private function liveStamps(User $user): array
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

            return [
                'quotations' => ($row->quotations_id ?? 0).'|'.($row->quotations_at ?? '0'),
                'purchaseOrders' => ($row->po_id ?? 0).'|'.($row->po_at ?? '0'),
                'opportunities' => (string) ($row->opp_id ?? 0),
                'notifications' => (string) ($row->notif_id ?? 0),
            ];
        }

        $row = DB::selectOne(
            'SELECT
                (SELECT COALESCE(MAX(id), 0) FROM quotations) AS quotations_id,
                (SELECT COALESCE(CAST(MAX(updated_at) AS TEXT), \'0\') FROM quotations) AS quotations_at,
                (SELECT COALESCE(MAX(id), 0) FROM procurement_requests) AS pr_id,
                (SELECT COALESCE(CAST(MAX(updated_at) AS TEXT), \'0\') FROM procurement_requests) AS pr_at,
                (SELECT COALESCE(MAX(id), 0) FROM inventory_items) AS inv_id,
                (SELECT COALESCE(CAST(MAX(updated_at) AS TEXT), \'0\') FROM inventory_items) AS inv_at,
                (SELECT COALESCE(MAX(id), 0) FROM deliveries) AS del_id,
                (SELECT COALESCE(CAST(MAX(updated_at) AS TEXT), \'0\') FROM deliveries) AS del_at,
                (SELECT COALESCE(MAX(id), 0) FROM inventory_movements) AS mov_id,
                (SELECT COALESCE(MAX(id), 0) FROM supply_requests) AS sr_id,
                (SELECT COALESCE(CAST(MAX(updated_at) AS TEXT), \'0\') FROM supply_requests) AS sr_at,
                (SELECT COALESCE(MAX(id), 0) FROM releases) AS rel_id,
                (SELECT COALESCE(MAX(id), 0) FROM suppliers WHERE deleted_at IS NULL) AS suppliers_id,
                (SELECT COALESCE(CAST(MAX(updated_at) AS TEXT), \'0\') FROM suppliers WHERE deleted_at IS NULL) AS suppliers_at,
                (SELECT COALESCE(MAX(id), 0) FROM supply_notifications WHERE user_id IS NULL) AS notif_id'
        );

        return [
            'quotations' => ($row->quotations_id ?? 0).'|'.($row->quotations_at ?? '0'),
            'procurementRequests' => ($row->pr_id ?? 0).'|'.($row->pr_at ?? '0'),
            'inventory' => ($row->inv_id ?? 0).'|'.($row->inv_at ?? '0'),
            'deliveries' => ($row->del_id ?? 0).'|'.($row->del_at ?? '0'),
            'movements' => (string) ($row->mov_id ?? 0),
            'supplyRequests' => ($row->sr_id ?? 0).'|'.($row->sr_at ?? '0'),
            'releases' => (string) ($row->rel_id ?? 0),
            'suppliers' => ($row->suppliers_id ?? 0).'|'.($row->suppliers_at ?? '0'),
            'notifications' => (string) ($row->notif_id ?? 0),
        ];
    }

    private function liveCollection(User $user, string $key): array
    {
        $supplierId = $user->isSupplier() ? (int) $user->supplier_id : null;

        return match ($key) {
            'quotations' => $this->quotationsPayload($supplierId),
            'notifications' => $this->notificationsPayload($user->isSupplier() ? $user->id : null),
            'purchaseOrders' => $this->purchaseOrdersPayload($supplierId),
            'opportunities' => $this->opportunitiesPayload($user),
            'procurementRequests' => $this->procurementRequestsPayload(),
            'inventory' => $this->inventoryPayload(),
            'deliveries' => $this->deliveriesPayload(),
            'movements' => $this->movementsPayload(),
            'supplyRequests' => $this->supplyRequestsPayload(),
            'releases' => $this->releasesPayload(),
            'suppliers' => $this->suppliersPayload(),
            default => [],
        };
    }

    private function purchaseOrdersPayload(?int $supplierId = null): array
    {
        return $this->resolve(PurchaseOrderResource::collection(
            PurchaseOrder::query()
                ->with(['items', 'procurementRequest:id,pr_number,priority', 'supplierAccount:id,code'])
                ->when($supplierId !== null, fn ($query) => $query->where('supplier_id', $supplierId))
                ->orderByDesc('id')
                ->get()
        ));
    }

    private function opportunitiesPayload(User $user): array
    {
        $supplierId = $user->supplier_id;

        return $this->resolve(OpportunityResource::collection(
            SupplierOpportunity::rankedForVendor($supplierId, openOnly: (bool) $supplierId)
        ));
    }

    private function quotationsPayload(?int $supplierId = null): array
    {
        return $this->resolve(QuotationResource::collection(
            Quotation::query()
                ->with([
                    'procurementRequest:id,pr_number,item_code,item_name,selected_supplier,po_number,priority',
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

    private function suppliersPayload(): array
    {
        return $this->resolve(SupplierResource::collection(
            Supplier::query()
                ->with(['documents' => fn ($query) => $query->orderByDesc('id')])
                ->orderBy('company_name')
                ->get()
        ));
    }

    private function inventoryPayload(): array
    {
        return $this->resolve(InventoryItemResource::collection(
            InventoryItem::query()
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
                ->get()
        ));
    }

    private function deliveriesPayload(): array
    {
        return $this->resolve(DeliveryResource::collection(
            Priority::sortRecords(
                Delivery::query()->with(['items', 'purchaseOrder:id,priority'])->orderByDesc('id')->get(),
                'purchaseOrder.priority'
            )
        ));
    }

    private function movementsPayload(): array
    {
        return $this->resolve(InventoryMovementResource::collection(
            InventoryMovement::query()->orderByDesc('id')->limit(100)->get()
        ));
    }

    private function supplyRequestsPayload(): array
    {
        return $this->resolve(SupplyRequestResource::collection(
            SupplyRequest::query()
                ->with([
                    'catalogItem:id,item_code,code,image_path',
                    'inventoryItem:id,code,image_path',
                ])
                ->orderByDesc('id')
                ->get()
        ));
    }

    private function releasesPayload(): array
    {
        return $this->resolve(ReleaseResource::collection(
            Release::query()->orderByDesc('id')->get()
        ));
    }

    private function procurementRequestsPayload(): array
    {
        return $this->resolve(ProcurementRequestResource::collection(
            ProcurementRequest::query()
                ->with('catalogItem:id,item_code,code,image_path')
                ->withCount(['opportunities', 'quotations'])
                ->withMin('opportunities', 'deadline')
                ->orderByDesc('id')
                ->get()
        ));
    }

    private function supplierCollections(User $user): array
    {
        $supplierId = $user->supplier_id;

        $purchaseOrders = PurchaseOrder::query()
            ->with(['items', 'procurementRequest:id,pr_number,priority', 'supplierAccount:id,code'])
            ->when($supplierId, fn ($query) => $query->where('supplier_id', $supplierId))
            ->orderByDesc('id')
            ->get();

        $opportunities = SupplierOpportunity::rankedForVendor($supplierId, openOnly: (bool) $supplierId);

        return [
            'quotations' => $this->quotationsPayload($supplierId),
            'purchaseOrders' => $this->resolve(PurchaseOrderResource::collection($purchaseOrders)),
            'opportunities' => $this->resolve(OpportunityResource::collection($opportunities)),
            'notifications' => $this->notificationsPayload($user->id),
        ];
    }

    private function internalCore(): array
    {
        app(SupplyChainService::class)->flagOverdueRfqs();

        if (DB::connection()->getDriverName() === 'pgsql') {
            return $this->internalCoreRemote();
        }

        return $this->internalCoreEloquent();
    }

    private function internalCoreEloquent(): array
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
                    ->with(['items', 'procurementRequest:id,pr_number,priority', 'supplierAccount:id,code'])
                    ->orderByDesc('id')
                    ->get()
            )),
            'suppliers' => $this->suppliersPayload(),
            'deliveries' => $this->resolve(DeliveryResource::collection(
                Priority::sortRecords(
                    Delivery::query()->with(['items', 'purchaseOrder:id,priority'])->orderByDesc('id')->get(),
                    'purchaseOrder.priority'
                )
            )),
            'stockCounts' => $this->resolve(StockCountResource::collection(
                StockCount::query()->with('items')->orderByDesc('id')->get()
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
            'deliveries' => $this->resolve(DeliveryResource::collection(
                Priority::sortRecords(
                    Delivery::query()->with(['items', 'purchaseOrder:id,priority'])->orderByDesc('id')->get(),
                    'purchaseOrder.priority'
                )
            )),
            'stockCounts' => $this->resolve(StockCountResource::collection(
                StockCount::query()->with('items')->orderByDesc('id')->get()
            )),
            'opportunities' => $this->resolve(OpportunityResource::collection(
                SupplierOpportunity::rankedForVendor()
            )),
            'purchaseOrders' => $this->resolve(PurchaseOrderResource::collection(
                PurchaseOrder::query()
                    ->with(['items', 'timeline', 'procurementRequest:id,pr_number,priority', 'supplierAccount:id,code'])
                    ->orderByDesc('id')
                    ->get()
            )),
            'documents' => $this->resolve(DocumentResource::collection(
                Document::query()->with(['inventoryItem:id,item_code', 'purchaseOrder:id,po_number', 'supplierAccount:id,company_name'])->orderByDesc('id')->get()
            )),
        ];
    }

    private function internalCoreRemote(): array
    {
        $row = DB::selectOne(<<<'SQL'
SELECT
    (SELECT COALESCE(json_agg(obj ORDER BY item_code), '[]'::json) FROM (
        SELECT json_build_object(
            'id', i.code,
            'itemCode', i.item_code,
            'itemName', i.description,
            'description', i.description,
            'category', i.category,
            'quantity', i.quantity,
            'damagedQuantity', COALESCE(i.damaged_quantity, 0),
            'minStockLevel', i.min_stock_level,
            'unit', i.unit,
            'supplier', COALESCE(s.company_name, ''),
            'cost', i.cost,
            'storageLocationId', i.storage_location_id,
            'location', CASE
                WHEN loc.id IS NULL THEN 'Unassigned'
                ELSE loc.rack || ' → ' || loc.shelf || ' → ' || loc.bin
            END,
            'serialNumber', COALESCE(NULLIF(i.serial_number, ''), 'N/A'),
            'warranty', COALESCE(NULLIF(i.warranty, ''), 'N/A'),
            'warrantyExpiresOn', to_char(i.warranty_expires_on, 'YYYY-MM-DD'),
            'condition', COALESCE(NULLIF(i.condition, ''), 'N/A'),
            'imageUrl', CASE WHEN NULLIF(i.image_path, '') IS NULL THEN NULL ELSE '/storage/' || i.image_path END,
            'status', i.status,
            'updatedAt', i.updated_at
        ) AS obj, i.item_code
        FROM inventory_items i
        LEFT JOIN suppliers s ON s.id = i.supplier_id AND s.deleted_at IS NULL
        LEFT JOIN storage_locations loc ON loc.id = i.storage_location_id
        WHERE i.deleted_at IS NULL
    ) inventory_rows) AS inventory,

    (SELECT COALESCE(json_agg(obj ORDER BY id DESC), '[]'::json) FROM (
        SELECT json_build_object(
            'id', COALESCE(NULLIF(sr.request_number, ''), sr.id::text),
            'requestingDepartment', COALESCE(sr.requesting_department, ''),
            'itemCode', COALESCE(sr.item_code, ''),
            'itemName', COALESCE(sr.item_name, ''),
            'imageUrl', CASE WHEN NULLIF(img.image_path, '') IS NULL THEN NULL ELSE '/storage/' || img.image_path END,
            'category', sr.category,
            'quantityRequested', sr.quantity_requested,
            'requiredDate', to_char(sr.required_date, 'YYYY-MM-DD'),
            'priority', CASE
                WHEN UPPER(BTRIM(COALESCE(sr.priority, ''))) = 'URGENT' THEN 'URGENT'
                WHEN UPPER(BTRIM(COALESCE(sr.priority, ''))) = 'HIGH' THEN 'HIGH'
                ELSE 'NORMAL'
            END,
            'stockAvailability', COALESCE(NULLIF(sr.stock_availability, ''), 'Pending'),
            'status', CASE WHEN sr.status = 'Received' THEN 'Pending' ELSE COALESCE(NULLIF(sr.status, ''), 'Pending') END,
            'requestedBy', sr.requested_by,
            'purpose', sr.purpose,
            'dateReceived', to_char(sr.date_received, 'YYYY-MM-DD'),
            'actionLogs', '[]'::json
        ) AS obj, sr.id
        FROM supply_requests sr
        LEFT JOIN LATERAL (
            SELECT image_path FROM inventory_items
            WHERE deleted_at IS NULL AND (id = sr.inventory_item_id OR item_code = sr.item_code)
            ORDER BY CASE WHEN id = sr.inventory_item_id THEN 0 ELSE 1 END
            LIMIT 1
        ) img ON TRUE
    ) supply_rows) AS supply_requests,

    (SELECT COALESCE(json_agg(obj ORDER BY id DESC), '[]'::json) FROM (
        SELECT json_build_object(
            'id', pr.pr_number,
            'sourceRequest', pr.source_request,
            'department', pr.department,
            'itemCode', pr.item_code,
            'itemName', pr.item_name,
            'imageUrl', CASE WHEN NULLIF(img.image_path, '') IS NULL THEN NULL ELSE '/storage/' || img.image_path END,
            'quantity', pr.quantity,
            'reason', pr.reason,
            'priority', CASE
                WHEN UPPER(BTRIM(COALESCE(pr.priority, ''))) = 'URGENT' THEN 'URGENT'
                WHEN UPPER(BTRIM(COALESCE(pr.priority, ''))) = 'HIGH' THEN 'HIGH'
                ELSE 'NORMAL'
            END,
            'neededInDays', COALESCE(pr.needed_in_days, CASE
                WHEN UPPER(BTRIM(COALESCE(pr.priority, ''))) = 'URGENT' THEN 3
                WHEN UPPER(BTRIM(COALESCE(pr.priority, ''))) = 'HIGH' THEN 7
                ELSE 14
            END),
            'quoteWindowDays', CASE
                WHEN UPPER(BTRIM(COALESCE(pr.priority, ''))) = 'URGENT' THEN 2
                WHEN UPPER(BTRIM(COALESCE(pr.priority, ''))) = 'HIGH' THEN 5
                ELSE 10
            END,
            'status', pr.status,
            'dateCreated', to_char(pr.date_created, 'YYYY-MM-DD'),
            'estimatedCost', pr.estimated_cost,
            'selectedSupplier', pr.selected_supplier,
            'poNumber', pr.po_number,
            'vendorInviteCount', COALESCE(invites.invite_count, 0),
            'quoteCount', COALESCE(quotes.quote_count, 0),
            'quoteDeadline', to_char(deadlines.min_deadline, 'YYYY-MM-DD'),
            'rfqOverdue', COALESCE(quotes.quote_count, 0) = 0
                AND deadlines.min_deadline IS NOT NULL
                AND deadlines.min_deadline < CURRENT_DATE
                AND COALESCE(pr.po_number, '') = ''
                AND COALESCE(pr.selected_supplier, '') = '',
            'canEdit', pr.status = 'For Procurement' AND COALESCE(pr.po_number, '') = '',
            'sentToVendors', pr.status <> 'For Procurement' OR COALESCE(invites.invite_count, 0) > 0
        ) AS obj, pr.id
        FROM procurement_requests pr
        LEFT JOIN LATERAL (
            SELECT image_path FROM inventory_items
            WHERE deleted_at IS NULL AND item_code = pr.item_code
            LIMIT 1
        ) img ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS invite_count
            FROM supplier_opportunities so
            WHERE so.procurement_request_id = pr.id
        ) invites ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS quote_count
            FROM quotations q
            WHERE q.procurement_request_id = pr.id
        ) quotes ON TRUE
        LEFT JOIN LATERAL (
            SELECT MIN(so.deadline) AS min_deadline
            FROM supplier_opportunities so
            WHERE so.procurement_request_id = pr.id
        ) deadlines ON TRUE
    ) procurement_rows) AS procurement_requests,

    (SELECT COALESCE(json_agg(obj ORDER BY id DESC), '[]'::json) FROM (
        SELECT json_build_object(
            'id', q.quote_number,
            'procurementId', pr.pr_number,
            'supplierId', s.code,
            'supplierName', q.supplier_name,
            'item', q.item,
            'itemCode', pr.item_code,
            'imageUrl', CASE WHEN NULLIF(img.image_path, '') IS NULL THEN NULL ELSE '/storage/' || img.image_path END,
            'quantity', q.quantity,
            'unitPrice', q.unit_price,
            'totalPrice', q.total_price,
            'warranty', q.warranty,
            'warrantyMonths', q.warranty_months,
            'warrantyLabel', NULL,
            'warrantyFileUrl', CASE WHEN NULLIF(q.warranty_file_path, '') IS NULL THEN NULL ELSE '/storage/' || q.warranty_file_path END,
            'manualFileUrl', CASE WHEN NULLIF(q.manual_file_path, '') IS NULL THEN NULL ELSE '/storage/' || q.manual_file_path END,
            'itemPhotoUrls', COALESCE((
                SELECT json_agg('/storage/' || photo_path)
                FROM json_array_elements_text(COALESCE(q.item_photo_paths::text, '[]')::json) AS photo_path
                WHERE NULLIF(photo_path, '') IS NOT NULL
            ), '[]'::json),
            'deliveryTimeDays', q.delivery_time_days,
            'qualityRating', q.quality_rating,
            'paymentTerms', q.payment_terms,
            'priority', CASE
                WHEN UPPER(BTRIM(COALESCE(pr.priority, ''))) = 'URGENT' THEN 'URGENT'
                WHEN UPPER(BTRIM(COALESCE(pr.priority, ''))) = 'HIGH' THEN 'HIGH'
                ELSE 'NORMAL'
            END,
            'status', q.status,
            'notes', q.notes,
            'canEdit', q.status NOT IN ('Selected', 'Accepted', 'Rejected')
                AND COALESCE(pr.selected_supplier, '') = ''
                AND COALESCE(pr.po_number, '') = ''
        ) AS obj, q.id
        FROM quotations q
        LEFT JOIN procurement_requests pr ON pr.id = q.procurement_request_id
        LEFT JOIN suppliers s ON s.id = q.supplier_id AND s.deleted_at IS NULL
        LEFT JOIN LATERAL (
            SELECT image_path FROM inventory_items
            WHERE deleted_at IS NULL AND item_code = pr.item_code
            LIMIT 1
        ) img ON TRUE
    ) quotation_rows) AS quotations,

    (SELECT COALESCE(json_agg(obj ORDER BY id DESC), '[]'::json) FROM (
        SELECT json_build_object(
            'poNumber', po.po_number,
            'procurementId', pr.pr_number,
            'supplierId', s.code,
            'supplier', po.supplier,
            'contactPerson', po.contact_person,
            'items', (
                SELECT COALESCE(json_agg(json_build_object(
                    'itemCode', poi.item_code,
                    'description', poi.description,
                    'quantity', poi.quantity,
                    'unitPrice', poi.unit_price,
                    'total', poi.total,
                    'deliveredQty', poi.delivered_qty
                ) ORDER BY poi.id), '[]'::json)
                FROM purchase_order_items poi
                WHERE poi.purchase_order_id = po.id
            ),
            'totalCost', po.total_cost,
            'budgetReference', po.budget_reference,
            'paymentTerms', po.payment_terms,
            'procurementReason', po.procurement_reason,
            'priority', CASE
                WHEN UPPER(BTRIM(COALESCE(po.priority, pr.priority, ''))) = 'URGENT' THEN 'URGENT'
                WHEN UPPER(BTRIM(COALESCE(po.priority, pr.priority, ''))) = 'HIGH' THEN 'HIGH'
                ELSE 'NORMAL'
            END,
            'deliveryDate', po.delivery_date,
            'confirmBy', to_char(po.confirm_by, 'YYYY-MM-DD'),
            'warranty', po.warranty,
            'warrantyMonths', po.warranty_months,
            'warrantyLabel', NULL,
            'warrantyFileUrl', CASE WHEN NULLIF(po.warranty_file_path, '') IS NULL THEN NULL ELSE '/storage/' || po.warranty_file_path END,
            'manualFileUrl', CASE WHEN NULLIF(po.manual_file_path, '') IS NULL THEN NULL ELSE '/storage/' || po.manual_file_path END,
            'financeApprovalStatus', po.finance_approval_status,
            'poStatus', po.po_status,
            'createdDate', to_char(po.created_date, 'YYYY-MM-DD'),
            'approver', po.approver,
            'financeRemarks', po.finance_remarks
        ) AS obj, po.id
        FROM purchase_orders po
        LEFT JOIN procurement_requests pr ON pr.id = po.procurement_request_id
        LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.deleted_at IS NULL
    ) po_rows) AS purchase_orders,

    (SELECT COALESCE(json_agg(obj ORDER BY company_name), '[]'::json) FROM (
        SELECT json_build_object(
            'id', s.code,
            'companyName', s.company_name,
            'contactPerson', s.contact_person,
            'phone', s.phone,
            'email', s.email,
            'address', s.address,
            'status', s.status,
            'rating', s.rating,
            'qualityScore', s.quality_score,
            'responsivenessScore', s.responsiveness_score,
            'deliveryPerformance', s.delivery_performance,
            'pricingScore', s.pricing_score,
            'overallScore', s.overall_score,
            'categories', COALESCE(s.categories, '[]'::json),
            'taxId', s.tax_id,
            'secRegistration', s.sec_registration,
            'bankDetails', s.bank_details,
            'activeOrders', s.active_orders,
            'credentials', (
                SELECT COALESCE(json_agg(json_build_object(
                    'id', d.document_number,
                    'title', d.title,
                    'type', d.type,
                    'referenceNumber', d.reference_number,
                    'expirationDate', to_char(d.expiration_date, 'YYYY-MM-DD'),
                    'status', CASE
                        WHEN d.expiration_date IS NULL THEN COALESCE(NULLIF(d.status, ''), 'Active')
                        WHEN d.expiration_date < CURRENT_DATE THEN 'Expired'
                        WHEN d.expiration_date <= (CURRENT_DATE + INTERVAL '30 days') THEN 'Expiring Soon'
                        ELSE 'Active'
                    END,
                    'fileUrl', CASE WHEN NULLIF(d.file_path, '') IS NULL THEN NULL ELSE '/storage/' || d.file_path END,
                    'downloadUrl', '/api/documents/' || d.document_number || '/download',
                    'originalFilename', d.original_filename,
                    'fileSize', d.file_size
                ) ORDER BY d.id DESC), '[]'::json)
                FROM documents d
                WHERE d.supplier_id = s.id AND d.deleted_at IS NULL
            )
        ) AS obj, s.company_name
        FROM suppliers s
        WHERE s.deleted_at IS NULL
    ) supplier_rows) AS suppliers,

    (SELECT COALESCE(json_agg(obj ORDER BY id DESC), '[]'::json) FROM (
        SELECT json_build_object(
            'id', d.delivery_number,
            'poNumber', d.po_number,
            'supplier', d.supplier,
            'priority', CASE
                WHEN UPPER(BTRIM(COALESCE(po.priority, ''))) = 'URGENT' THEN 'URGENT'
                WHEN UPPER(BTRIM(COALESCE(po.priority, ''))) = 'HIGH' THEN 'HIGH'
                ELSE 'NORMAL'
            END,
            'deliveryDate', d.delivery_date,
            'itemsCount', d.items_count,
            'status', d.status,
            'carrier', d.carrier,
            'trackingNumber', d.tracking_number,
            'inspectionResult', d.inspection_result,
            'inspectionNotes', d.inspection_notes,
            'itemsDelivered', (
                SELECT COALESCE(json_agg(json_build_object(
                    'itemCode', di.item_code,
                    'description', di.description,
                    'poQuantity', di.po_quantity,
                    'deliveredQuantity', di.delivered_quantity,
                    'condition', di.condition,
                    'result', di.result,
                    'remarks', di.remarks
                ) ORDER BY di.id), '[]'::json)
                FROM delivery_items di
                WHERE di.delivery_id = d.id
            )
        ) AS obj, d.id
        FROM deliveries d
        LEFT JOIN purchase_orders po ON po.id = d.purchase_order_id
    ) delivery_rows) AS deliveries,

    (SELECT COALESCE(json_agg(obj ORDER BY id DESC), '[]'::json) FROM (
        SELECT json_build_object(
            'id', sc.count_number,
            'title', sc.title,
            'date', to_char(sc.count_date, 'YYYY-MM-DD'),
            'location', sc.location,
            'status', sc.status,
            'totalItemsAudited', sc.total_items_audited,
            'discrepancyCount', sc.discrepancy_count,
            'items', (
                SELECT COALESCE(json_agg(json_build_object(
                    'itemCode', sci.item_code,
                    'itemName', sci.item_name,
                    'systemQty', sci.system_qty,
                    'actualQty', sci.actual_qty,
                    'variance', sci.variance,
                    'notes', sci.notes
                ) ORDER BY sci.id), '[]'::json)
                FROM stock_count_items sci
                WHERE sci.stock_count_id = sc.id
            )
        ) AS obj, sc.id
        FROM stock_counts sc
    ) stock_count_rows) AS stock_counts,

    (SELECT COALESCE(json_agg(obj ORDER BY id DESC), '[]'::json) FROM (
        SELECT json_build_object(
            'id', m.movement_number,
            'itemCode', m.item_code,
            'itemName', m.item_name,
            'movementType', m.movement_type,
            'quantity', m.quantity,
            'date', m.moved_at,
            'location', m.location,
            'reference', m.reference,
            'remarks', m.remarks,
            'recordedBy', m.recorded_by
        ) AS obj, m.id
        FROM inventory_movements m
        ORDER BY m.id DESC
        LIMIT 40
    ) movement_rows) AS movements,

    (SELECT COALESCE(json_agg(obj), '[]'::json) FROM (
        SELECT json_build_object(
            'movementType', m.movement_type,
            'quantity', m.quantity,
            'createdAt', m.created_at
        ) AS obj
        FROM inventory_movements m
        WHERE m.created_at >= (CURRENT_DATE - INTERVAL '6 days')
    ) trend_rows) AS trend_moves,

    (SELECT COALESCE(json_agg(obj ORDER BY id DESC), '[]'::json) FROM (
        SELECT json_build_object(
            'id', doc.document_number,
            'title', doc.title,
            'type', doc.type,
            'referenceNumber', doc.reference_number,
            'supplier', COALESCE(sa.company_name, doc.supplier),
            'supplierId', doc.supplier_id,
            'issueDate', to_char(doc.issue_date, 'YYYY-MM-DD'),
            'expirationDate', to_char(doc.expiration_date, 'YYYY-MM-DD'),
            'status', CASE
                WHEN doc.expiration_date IS NULL THEN COALESCE(NULLIF(doc.status, ''), 'Active')
                WHEN doc.expiration_date < CURRENT_DATE THEN 'Expired'
                WHEN doc.expiration_date <= (CURRENT_DATE + INTERVAL '30 days') THEN 'Expiring Soon'
                ELSE 'Active'
            END,
            'daysRemaining', CASE
                WHEN doc.expiration_date IS NULL THEN NULL
                ELSE (doc.expiration_date - CURRENT_DATE)
            END,
            'category', doc.category,
            'fileSize', doc.file_size,
            'fileUrl', CASE WHEN NULLIF(doc.file_path, '') IS NULL THEN NULL ELSE '/storage/' || doc.file_path END,
            'originalFilename', doc.original_filename,
            'source', doc.source,
            'warrantyMonths', doc.warranty_months,
            'itemCode', NULL,
            'purchaseOrderNumber', NULL
        ) AS obj, doc.id
        FROM documents doc
        LEFT JOIN suppliers sa ON sa.id = doc.supplier_id AND sa.deleted_at IS NULL
        WHERE doc.deleted_at IS NULL
    ) document_rows) AS documents,

    (SELECT COALESCE(json_agg(obj ORDER BY id DESC), '[]'::json) FROM (
        SELECT json_build_object(
            'id', n.notification_number,
            'title', n.title,
            'message', n.message,
            'timestamp', n.logged_at,
            'type', n.type,
            'severity', n.severity,
            'read', n.is_read
        ) AS obj, n.id
        FROM supply_notifications n
        WHERE n.user_id IS NULL
        ORDER BY n.id DESC
        LIMIT 40
    ) notification_rows) AS notifications
SQL);

        $inventory = $this->jsonList($row->inventory ?? []);
        $trendMoves = $this->jsonList($row->trend_moves ?? []);

        return [
            'inventory' => $inventory,
            'supplyRequests' => $this->jsonList($row->supply_requests ?? []),
            'procurementRequests' => $this->jsonList($row->procurement_requests ?? []),
            'quotations' => $this->jsonList($row->quotations ?? []),
            'purchaseOrders' => $this->jsonList($row->purchase_orders ?? []),
            'suppliers' => $this->jsonList($row->suppliers ?? []),
            'deliveries' => $this->jsonList($row->deliveries ?? []),
            'stockCounts' => $this->jsonList($row->stock_counts ?? []),
            'movements' => $this->jsonList($row->movements ?? []),
            'documents' => $this->jsonList($row->documents ?? []),
            'notifications' => $this->jsonList($row->notifications ?? []),
            'movementTrend' => $this->movementTrendFromRows($trendMoves),
            'lowStockTrend' => $this->lowStockTrendFromRows($inventory),
        ];
    }

    private function jsonList(mixed $value): array
    {
        if (is_array($value)) {
            return array_values($value);
        }

        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);

            return is_array($decoded) ? array_values($decoded) : [];
        }

        return [];
    }

    private function movementTrendFromRows(array $movements): array
    {
        return collect(range(6, 0))->map(function (int $ago) use ($movements) {
            $date = Carbon::today()->subDays($ago);
            $dayMoves = collect($movements)->filter(function (array $movement) use ($date) {
                $created = $movement['createdAt'] ?? $movement['created_at'] ?? null;

                return $created && Carbon::parse($created)->isSameDay($date);
            });

            return [
                'day' => $date->format('D'),
                'receiving' => (int) $dayMoves->where('movementType', 'Receiving')->sum('quantity'),
                'releasing' => (int) $dayMoves->where('movementType', 'Releasing')->sum('quantity'),
            ];
        })->values()->all();
    }

    private function lowStockTrendFromRows(array $items): array
    {
        return collect(range(4, 0))->map(function (int $ago) use ($items) {
            $start = Carbon::now()->startOfWeek()->subWeeks($ago);
            $end = (clone $start)->endOfWeek();

            return [
                'week' => 'W'.$start->weekOfYear.' '.$start->format('M'),
                'count' => collect($items)
                    ->whereIn('status', ['LOW STOCK', 'OUT OF STOCK'])
                    ->filter(function (array $item) use ($start, $end) {
                        $updated = $item['updatedAt'] ?? $item['updated_at'] ?? null;

                        return $updated && Carbon::parse($updated)->between($start, $end);
                    })
                    ->count(),
            ];
        })->values()->all();
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
