<?php

namespace App\Services;

use App\Events\DeliveryUpdated;
use App\Events\InventoryMovementCreated;
use App\Events\OpportunityPublished;
use App\Events\PurchaseOrderUpdated;
use App\Events\QuotationSubmitted;
use App\Events\StockStatusChanged;
use App\Http\Resources\DeliveryResource;
use App\Http\Resources\InventoryItemResource;
use App\Http\Resources\InventoryMovementResource;
use App\Http\Resources\PurchaseOrderResource;
use App\Http\Resources\QuotationResource;
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
use App\Support\Base64Upload;
use App\Support\DocumentCode;
use App\Support\Priority;
use App\Support\SafeBroadcast;
use App\Support\WarrantyDuration;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SupplyChainService
{
    private const MAX_QUOTATION_ITEM_PHOTOS = 3;

    /** @var list<InventoryMovement> */
    private array $recordedMovements = [];

    public function __construct(private NotificationService $notifications) {}

    public function recordedMovementPayload(): array
    {
        if ($this->recordedMovements === []) {
            return [];
        }

        return InventoryMovementResource::collection($this->recordedMovements)->resolve();
    }

    public function receiveDepartmentSupplyRequest(array $data): SupplyRequest
    {
        $item = InventoryItem::query()->where('item_code', $data['itemCode'])->firstOrFail();
        $quantity = (int) $data['quantity'];
        $available = (int) $item->quantity;

        return DB::transaction(function () use ($data, $item, $quantity, $available) {
            $request = SupplyRequest::query()->create([
                'request_number' => DocumentCode::next('supply_requests', 'request_number', 'REQ'),
                'requesting_department' => $data['requestingDepartment'],
                'inventory_item_id' => $item->id,
                'item_code' => $item->item_code,
                'item_name' => $item->description,
                'category' => $item->category,
                'quantity_requested' => $quantity,
                'required_date' => $data['requiredDate'] ?? null,
                'priority' => Priority::normalize($data['priority'] ?? null),
                'stock_availability' => $available >= $quantity ? 'Stock Available' : 'Insufficient Stock',
                'status' => 'Pending',
                'requested_by' => $data['requestedBy'],
                'purpose' => $data['purpose'] ?? null,
                'date_received' => now()->toDateString(),
            ]);

            $request->logs()->create([
                'logged_at' => now()->format('Y-m-d H:i'),
                'note' => "Approved request received from {$data['requestingDepartment']}. Current stock: {$available}.",
            ]);

            $this->notifications->create(
                'New Supply Request Received',
                "{$data['requestingDepartment']} requested {$quantity} {$item->unit} of {$item->item_code} ({$item->description}).",
                'stock',
                $available >= $quantity ? 'info' : 'warning'
            );

            return $request->fresh(['logs']);
        });
    }

    public function processSupplyRequestStock(SupplyRequest $request): SupplyRequest
    {
        return DB::transaction(function () use ($request) {
            $item = InventoryItem::query()->where('item_code', $request->item_code)->first();
            $available = $item?->quantity ?? 0;
            $timestamp = now()->format('Y-m-d H:i');

            if ($available >= $request->quantity_requested) {
                $request->update([
                    'stock_availability' => 'Stock Available',
                    'status' => 'Ready for Release',
                ]);
                $request->logs()->create([
                    'logged_at' => $timestamp,
                    'note' => "Stock verified: {$available} units available. Ready for Release.",
                ]);
                $this->notifications->create(
                    'Supply Request Approved & Reserved',
                    "Request {$request->request_number} ({$request->item_name}) has available stock ({$available} units). Ready for release.",
                    'stock',
                    'success'
                );

                return $request->fresh(['logs', 'procurementRequests']);
            }

            $prNumber = DocumentCode::next('procurement_requests', 'pr_number', 'PR');
            $orderQty = $request->quantity_requested + ($item ? max(0, $item->min_stock_level - $available) : 10);

            $pr = ProcurementRequest::query()->create([
                'pr_number' => $prNumber,
                'source_request' => $request->request_number,
                'supply_request_id' => $request->id,
                'department' => $request->requesting_department,
                'item_code' => $request->item_code,
                'item_name' => $request->item_name,
                'quantity' => $orderQty,
                'reason' => "Insufficient stock for {$request->request_number}. Available: {$available}, Requested: {$request->quantity_requested}",
                'priority' => Priority::normalize($request->priority),
                'needed_in_days' => Priority::neededInDays($request->priority),
                'status' => 'For Procurement',
                'date_created' => now()->toDateString(),
                'estimated_cost' => ($item?->cost ?? 1000) * $request->quantity_requested,
            ]);

            $request->update([
                'stock_availability' => 'Insufficient Stock',
                'status' => 'For Procurement',
            ]);
            $request->logs()->create([
                'logged_at' => $timestamp,
                'note' => "Stock check failed (Available: {$available}). Initiated Procurement {$prNumber}.",
            ]);
            $this->notifications->create(
                'Procurement Request Initiated',
                "Request {$request->request_number} had insufficient stock. Auto-generated Procurement Request {$prNumber}.",
                'procurement',
                'warning'
            );

            return $request->fresh(['logs', 'procurementRequests']);
        });
    }

    public function selectSupplierAndCreatePO(ProcurementRequest $pr, Quotation $quote): PurchaseOrder
    {
        if ($quote->procurement_request_id !== $pr->id) {
            throw ValidationException::withMessages([
                'quotation' => ['Quotation does not belong to this procurement request.'],
            ]);
        }

        return DB::transaction(function () use ($pr, $quote) {
            $poNumber = DocumentCode::next('purchase_orders', 'po_number', 'PO');
            $timestamp = now()->format('Y-m-d H:i');

            Quotation::query()->where('procurement_request_id', $pr->id)->each(function (Quotation $item) use ($quote) {
                $item->update(['status' => $item->id === $quote->id ? 'Selected' : 'Rejected']);
            });

            $pr->update([
                'status' => 'Pending Finance Approval',
                'selected_supplier' => $quote->supplier_name,
                'po_number' => $poNumber,
            ]);

            $po = PurchaseOrder::query()->create([
                'po_number' => $poNumber,
                'procurement_request_id' => $pr->id,
                'supplier_id' => $quote->supplier_id,
                'supplier' => $quote->supplier_name,
                'contact_person' => $quote->supplier?->contact_person ?? 'Vendor Sales Manager',
                'total_cost' => $quote->total_price,
                'budget_reference' => 'BUD-'.now()->year.'-'.strtoupper(substr($pr->department, 0, 3)).'-'.random_int(10, 99),
                'payment_terms' => $quote->payment_terms ?: '30 Days Net',
                'procurement_reason' => $pr->reason,
                'priority' => Priority::normalize($pr->priority),
                'delivery_date' => now()->addDays($quote->delivery_time_days ?: 7)->toDateString(),
                'warranty' => $quote->warranty,
                'warranty_months' => $quote->warranty_months,
                'warranty_file_path' => $quote->warranty_file_path,
                'manual_file_path' => $quote->manual_file_path,
                'finance_approval_status' => 'Pending Finance Approval',
                'po_status' => 'Pending Finance Approval',
                'created_date' => now()->toDateString(),
                'approver' => 'Finance Subsystem Checkpoint',
                'finance_remarks' => '',
            ]);

            $po->items()->create([
                'item_code' => $pr->item_code,
                'description' => $pr->item_name,
                'quantity' => $pr->quantity,
                'unit_price' => $quote->unit_price,
                'total' => $quote->total_price,
                'delivered_qty' => 0,
            ]);

            $this->createDefaultTimeline($po, $timestamp);

            $this->notifications->create(
                'Purchase Order Created - Awaiting Finance Approval',
                "PO {$poNumber} for {$quote->supplier_name} (₱".number_format($quote->total_price, 2).') created. Forwarded to Finance Subsystem for approval.',
                'finance',
                'warning'
            );

            $fresh = $po->fresh(['items', 'timeline', 'procurementRequest', 'supplierAccount']);
            $this->broadcastPO($fresh);

            return $fresh;
        });
    }

    public function updateFinanceApproval(PurchaseOrder $po, string $status, string $remarks, User $actor): PurchaseOrder
    {
        $timestamp = now()->format('Y-m-d H:i');
        $remarksText = $remarks !== ''
            ? $remarks
            : ($status === 'Finance Approved' ? 'Approved by Finance Officer' : 'Decision recorded by Finance');
        $confirmBy = $po->confirm_by;
        $priority = Priority::normalize($po->priority);

        if ($status === 'Finance Approved') {
            $po->loadMissing('procurementRequest');
            $priority = Priority::normalize($po->priority ?: $po->procurementRequest?->priority);
            $confirmBy = now()->copy()->addDays(Priority::confirmDays($priority))->toDateString();
            $poStatus = 'Sent to Supplier';
            $prStatus = 'Finance Approved';
            $timeline = [
                'Finance Approval Checkpoint' => [$timestamp, 'completed'],
                'Sent to Supplier' => [$timestamp, 'completed'],
                'Supplier Confirmation' => ['Awaiting Supplier Response', 'in_progress'],
            ];
        } elseif ($status === 'Finance Rejected') {
            $poStatus = 'Finance Rejected';
            $prStatus = 'Finance Rejected';
            $timeline = [
                'Finance Approval Checkpoint' => ["{$timestamp} (REJECTED)", 'rejected'],
            ];
        } else {
            $poStatus = 'Returned for Revision';
            $prStatus = 'Quotation';
            $timeline = [
                'Finance Approval Checkpoint' => ["{$timestamp} (RETURNED)", 'returned'],
            ];
        }

        $this->updateTimelineSteps((int) $po->id, $timeline);

        $po->update([
            'finance_approval_status' => $status,
            'po_status' => $poStatus,
            'approver' => $actor->name,
            'finance_remarks' => $remarksText,
            'confirm_by' => $status === 'Finance Approved' ? $confirmBy : $po->confirm_by,
            'priority' => $status === 'Finance Approved'
                ? Priority::normalize($po->priority ?: $po->procurementRequest?->priority)
                : $po->priority,
        ]);

        if ($po->procurement_request_id) {
            ProcurementRequest::query()->whereKey($po->procurement_request_id)->update([
                'status' => $prStatus,
            ]);
        }

        $poNumber = $po->po_number;
        $vendorUserIds = $status === 'Finance Approved' && $po->supplier_id
            ? User::query()->where('supplier_id', $po->supplier_id)->pluck('id')->all()
            : [];
        $confirmByDate = $status === 'Finance Approved' ? $confirmBy : null;
        dispatch(function () use ($po, $poNumber, $status, $remarksText, $vendorUserIds, $priority, $confirmByDate): void {
            $this->notifications->create(
                "Finance Subsystem Decision: {$status}",
                "Purchase Order {$poNumber} has been updated to \"{$status}\". Remarks: ".($remarksText !== '' ? $remarksText : 'None'),
                'finance',
                $status === 'Finance Approved' ? 'success' : ($status === 'Finance Rejected' ? 'danger' : 'warning')
            );

            if ($vendorUserIds !== []) {
                $due = $confirmByDate ? ' Confirm shipment by '.Priority::displayDate($confirmByDate).'.' : '';
                $this->notifications->createMany(array_map(fn (int $userId) => [
                    'title' => $priority === Priority::URGENT
                        ? "URGENT PO: confirm {$poNumber}"
                        : "Purchase order {$poNumber} awarded",
                    'message' => "PO {$poNumber} was approved and sent to your portal.{$due}",
                    'type' => 'po',
                    'severity' => Priority::notificationSeverity($priority),
                    'user_id' => $userId,
                ], $vendorUserIds));
            }

            $this->broadcastPO($po);
        })->afterResponse();

        return $po;
    }

    public function supplierConfirmPO(PurchaseOrder $po): PurchaseOrder
    {
        $timestamp = now()->format('Y-m-d H:i');
        $this->updateTimelineSteps((int) $po->id, [
            'Supplier Confirmation' => [$timestamp, 'completed'],
            'Delivery & Inspection' => ['In Transit', 'in_progress'],
        ]);
        $po->update(['po_status' => 'Confirmed']);
        $po->loadMissing('items');
        $delivery = $this->createInboundDeliveryFromPO($po);

        $poNumber = $po->po_number;
        dispatch(function () use ($po, $poNumber, $delivery): void {
            $this->notifications->create(
                'Supplier Confirmed PO',
                "Supplier has confirmed PO {$poNumber}. Inbound delivery created for Receiving and Inspection.",
                'po',
                'success'
            );
            $this->broadcastPO($po);
            $this->broadcastDelivery($delivery);
        })->afterResponse();

        return $po;
    }

    public function syncConfirmedPurchaseOrderDeliveries(): int
    {
        $created = 0;
        $orders = PurchaseOrder::query()
            ->with('items')
            ->where('po_status', 'Confirmed')
            ->whereDoesntHave('deliveries')
            ->get();

        foreach ($orders as $po) {
            $this->createInboundDeliveryFromPO($po);
            $created++;
        }

        Delivery::query()
            ->where('status', 'Expected')
            ->whereHas('purchaseOrder', fn ($query) => $query->where('po_status', 'Confirmed'))
            ->update(['status' => 'In Transit']);

        return $created;
    }

    private function createInboundDeliveryFromPO(PurchaseOrder $po): Delivery
    {
        $existing = Delivery::query()
            ->where(function ($query) use ($po) {
                $query->where('purchase_order_id', $po->id)
                    ->orWhere('po_number', $po->po_number);
            })
            ->first();

        if ($existing) {
            if ($existing->status === 'Expected') {
                $existing->update(['status' => 'In Transit']);
            }

            return $existing->fresh('items');
        }

        $items = $po->items;
        $delivery = Delivery::query()->create([
            'delivery_number' => DocumentCode::next('deliveries', 'delivery_number', 'DEL'),
            'purchase_order_id' => $po->id,
            'po_number' => $po->po_number,
            'supplier' => $po->supplier,
            'delivery_date' => $po->delivery_date ?: now()->toDateString(),
            'items_count' => $items->count(),
            'status' => 'In Transit',
            'carrier' => 'Supplier Dispatch',
            'tracking_number' => 'TBD-'.$po->po_number,
            'inspection_result' => 'Pending',
            'inspection_notes' => 'Awaiting warehouse receiving and quality inspection.',
        ]);

        foreach ($items as $item) {
            $delivery->items()->create([
                'item_code' => $item->item_code,
                'description' => $item->description,
                'po_quantity' => $item->quantity,
                'delivered_quantity' => 0,
                'condition' => 'Pending',
                'result' => 'Pending',
                'remarks' => '',
            ]);
        }

        return $delivery->load('items');
    }

    public function processDeliveryInspection(Delivery $delivery, array $itemsDelivered, string $inspectionResult, string $remarks, User $actor): Delivery
    {
        return DB::transaction(function () use ($delivery, $itemsDelivered, $inspectionResult, $remarks, $actor) {
            $timestamp = now()->format('Y-m-d H:i');
            $status = $inspectionResult === 'Passed' ? 'Accepted' : ($inspectionResult === 'Partial' ? 'Partially Accepted' : 'Rejected');

            $delivery->update([
                'status' => $status,
                'inspection_result' => $inspectionResult,
                'inspection_notes' => $remarks,
            ]);

            foreach ($itemsDelivered as $line) {
                $delivery->items()->where('item_code', $line['itemCode'])->update([
                    'delivered_quantity' => $line['deliveredQuantity'],
                    'condition' => $line['condition'] ?? 'Good',
                    'result' => $line['result'] ?? $inspectionResult,
                    'remarks' => $line['remarks'] ?? $remarks,
                ]);

                $qty = (int) ($line['deliveredQuantity'] ?? 0);
                $lineResult = $line['result'] ?? $inspectionResult;
                if ($qty <= 0 || ($lineResult !== 'Passed' && $inspectionResult === 'Failed')) {
                    continue;
                }

                $item = InventoryItem::query()->where('item_code', $line['itemCode'])->first();
                if ($item) {
                    $item->quantity += $qty;
                    $this->applyReceivedWarranty($item, $delivery->purchaseOrder);
                    $item->save();
                    $this->broadcastStock($item);
                }

                $this->recordMovement([
                    'inventory_item_id' => $item?->id,
                    'item_code' => $line['itemCode'],
                    'item_name' => $line['description'] ?? $line['itemCode'],
                    'movement_type' => 'Receiving',
                    'quantity' => $qty,
                    'moved_at' => $timestamp,
                    'location' => 'Main Warehouse - Receiving Bay',
                    'reference' => "{$delivery->delivery_number} / {$delivery->po_number}",
                    'remarks' => "Inspection Result: {$lineResult}. {$remarks}",
                    'recorded_by' => $actor->name,
                ]);
            }

            if ($delivery->purchaseOrder) {
                $po = $delivery->purchaseOrder->load('items', 'timeline');
                $totalOrdered = 0;
                $totalDelivered = 0;
                foreach ($po->items as $pItem) {
                    $add = collect($itemsDelivered)->firstWhere('itemCode', $pItem->item_code);
                    $addQty = $add['deliveredQuantity'] ?? 0;
                    $pItem->delivered_qty += (int) $addQty;
                    $pItem->save();
                    $totalOrdered += $pItem->quantity;
                    $totalDelivered += $pItem->delivered_qty;
                }

                $isFull = $totalDelivered >= $totalOrdered;
                $poStatus = $isFull ? 'Fully Delivered' : 'Partially Delivered';
                $po->timeline->firstWhere('step', 'Delivery & Inspection')?->update([
                    'step_date' => "{$timestamp} ({$poStatus})",
                    'status' => 'completed',
                ]);
                $po->timeline->firstWhere('step', 'Inventory Updated')?->update([
                    'step_date' => $timestamp,
                    'status' => $isFull ? 'completed' : 'in_progress',
                ]);
                $po->update(['po_status' => $poStatus]);
                $this->broadcastPO($po->fresh(['items', 'timeline', 'procurementRequest', 'supplierAccount']));
            }

            $fresh = $delivery->fresh(['items', 'purchaseOrder']);
            $this->notifications->create(
                "Delivery Inspection Completed ({$inspectionResult})",
                "Delivery {$delivery->delivery_number} inspected. ".($inspectionResult === 'Passed' ? 'Stock updated in inventory.' : 'Partial/Failed inspection logged.'),
                'delivery',
                $inspectionResult === 'Passed' ? 'success' : 'warning'
            );
            $this->broadcastDelivery($fresh);
            $this->broadcastRecordedMovements();

            return $fresh;
        });
    }

    public function releaseSupplyRequest(SupplyRequest $request, string $releasedTo, User $actor): Release
    {
        return DB::transaction(function () use ($request, $releasedTo, $actor) {
            $locked = SupplyRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === 'Released') {
                $existing = Release::query()
                    ->where('supply_request_id', $locked->id)
                    ->orderByDesc('id')
                    ->first();

                if ($existing) {
                    return $existing;
                }
            }

            if ($locked->status !== 'Ready for Release') {
                throw ValidationException::withMessages([
                    'supplyRequest' => ['This request is not ready for dispatch.'],
                ]);
            }

            $timestamp = now()->format('Y-m-d H:i');
            $releaseNumber = DocumentCode::next('releases', 'release_number', 'REL');

            $item = InventoryItem::query()->where('item_code', $locked->item_code)->lockForUpdate()->first();
            if ($item) {
                $item->quantity = max(0, $item->quantity - $locked->quantity_requested);
                $item->save();
                $this->broadcastStock($item);
            }

            $locked->update(['status' => 'Released']);
            $locked->logs()->create([
                'logged_at' => $timestamp,
                'note' => "Item released to {$releasedTo}. Release ID: {$releaseNumber}",
            ]);

            $release = Release::query()->create([
                'release_number' => $releaseNumber,
                'supply_request_id' => $locked->id,
                'request_id' => $locked->request_number,
                'requesting_department' => $locked->requesting_department,
                'item_code' => $locked->item_code,
                'item_name' => $locked->item_name,
                'quantity_released' => $locked->quantity_requested,
                'approval_status' => 'Approved by Dept & Stock Verified',
                'stock_status' => 'Deducted from Inventory',
                'release_date' => $timestamp,
                'released_to' => $releasedTo ?: 'Department Representative',
                'dispatched_by' => $actor->name,
            ]);

            $this->recordMovement([
                'inventory_item_id' => $item?->id,
                'item_code' => $locked->item_code,
                'item_name' => $locked->item_name,
                'movement_type' => 'Releasing',
                'quantity' => $locked->quantity_requested,
                'moved_at' => $timestamp,
                'location' => 'Dispatch Area',
                'reference' => "{$releaseNumber} / {$locked->request_number}",
                'remarks' => "Issued to {$locked->requesting_department} rep: {$releasedTo}",
                'recorded_by' => $actor->name,
            ]);

            $this->notifications->create(
                'Stock Released to Department',
                "Supply Request {$locked->request_number} ({$locked->item_name} x{$locked->quantity_requested}) has been released and deducted from stock.",
                'stock',
                'success'
            );
            $this->broadcastRecordedMovements();

            return $release->fresh();
        });
    }

    public function adjustInventory(InventoryItem $item, array $data, User $actor): InventoryItem
    {
        return DB::transaction(function () use ($item, $data, $actor) {
            $locked = InventoryItem::query()->whereKey($item->id)->lockForUpdate()->firstOrFail();
            $type = (string) $data['type'];
            $quantity = (int) $data['quantity'];
            $reason = trim((string) $data['reason']);
            $source = $this->resolveAdjustmentSource($type, $data['source'] ?? null, $locked);
            $pool = $source === 'damaged' ? (int) $locked->damaged_quantity : (int) $locked->quantity;

            if ($quantity > $pool) {
                $label = $source === 'damaged' ? 'quarantine' : 'available';
                throw ValidationException::withMessages([
                    'quantity' => ["Only {$pool} unit(s) available in {$label} stock."],
                ]);
            }

            $timestamp = now()->format('Y-m-d H:i');
            $location = $locked->locationLabel();
            $reference = $locked->code;
            $unit = $locked->unit ?: 'Units';

            if ($type === 'Damaged') {
                $locked->quantity -= $quantity;
                $locked->damaged_quantity += $quantity;
                $movementType = 'Damaged';
                $location = 'Quarantine';
                $remarks = "Quarantined as damaged. {$reason}";
                $title = 'Stock Quarantined';
                $body = "{$quantity} {$unit} of {$locked->item_code} ({$locked->description}) moved to quarantine.";
                $tone = 'warning';
            } elseif ($type === 'Disposed' || $type === 'Return') {
                if ($source === 'damaged') {
                    $locked->damaged_quantity -= $quantity;
                    $location = 'Quarantine';
                    $from = 'quarantine';
                } else {
                    $locked->quantity -= $quantity;
                    $from = 'available stock';
                }
                $movementType = $type;
                $remarks = ($type === 'Return' ? 'Returned to vendor' : 'Disposed')." from {$from}. {$reason}";
                $title = $type === 'Return' ? 'Returned to Vendor' : 'Stock Disposed';
                $body = $type === 'Return'
                    ? "{$quantity} {$unit} of {$locked->item_code} ({$locked->description}) returned to vendor from {$from}."
                    : "{$quantity} {$unit} of {$locked->item_code} ({$locked->description}) written off as disposed.";
                $tone = 'warning';
            } elseif ($type === 'Lost') {
                $locked->quantity -= $quantity;
                $movementType = 'Lost';
                $remarks = "Recorded as lost. {$reason}";
                $title = 'Stock Lost';
                $body = "{$quantity} {$unit} of {$locked->item_code} ({$locked->description}) recorded as lost.";
                $tone = 'warning';
            } else {
                $releasedTo = trim((string) ($data['releasedTo'] ?? ''));
                $department = trim((string) ($data['department'] ?? ''));

                if ($releasedTo === '' || $department === '') {
                    throw ValidationException::withMessages([
                        'releasedTo' => ['Recipient and department are required for a manual release.'],
                    ]);
                }
                $releaseNumber = DocumentCode::next('releases', 'release_number', 'REL');

                Release::query()->create([
                    'release_number' => $releaseNumber,
                    'supply_request_id' => null,
                    'request_id' => 'MANUAL',
                    'requesting_department' => $department,
                    'item_code' => $locked->item_code,
                    'item_name' => $locked->description,
                    'quantity_released' => $quantity,
                    'approval_status' => 'Manual warehouse issue',
                    'stock_status' => 'Deducted from Inventory',
                    'release_date' => $timestamp,
                    'released_to' => $releasedTo,
                    'dispatched_by' => $actor->name,
                ]);

                $locked->quantity -= $quantity;
                $movementType = 'Releasing';
                $location = 'Dispatch Area';
                $reference = "{$releaseNumber} / MANUAL";
                $remarks = "Manual release to {$department} rep: {$releasedTo}. {$reason}";
                $title = 'Stock Released to Department';
                $body = "{$locked->item_code} ({$locked->description} x{$quantity}) manually released to {$releasedTo} ({$department}).";
                $tone = 'success';
            }

            $locked->save();

            $this->recordMovement([
                'inventory_item_id' => $locked->id,
                'item_code' => $locked->item_code,
                'item_name' => $locked->description,
                'movement_type' => $movementType,
                'quantity' => $quantity,
                'moved_at' => $timestamp,
                'location' => $location,
                'reference' => $reference,
                'remarks' => $remarks,
                'recorded_by' => $actor->name,
            ]);

            $this->notifications->create($title, $body, 'stock', $tone);
            $this->broadcastStock($locked);
            $this->broadcastRecordedMovements();

            return $locked->fresh(['supplier', 'storageLocation']);
        });
    }

    private function resolveAdjustmentSource(string $type, mixed $source, InventoryItem $item): string
    {
        if (in_array($type, ['Damaged', 'Lost', 'ManualRelease'], true)) {
            return 'available';
        }

        if ($source === 'available' || $source === 'damaged') {
            return $source;
        }

        return (int) $item->damaged_quantity > 0 ? 'damaged' : 'available';
    }

    public function saveInventoryItem(array $data, ?InventoryItem $existing = null): InventoryItem
    {
        $image = $data['image'] ?? null;
        $removeImage = (bool) ($data['removeImage'] ?? false);
        unset($data['image'], $data['removeImage']);

        $supplier = isset($data['supplier'])
            ? Supplier::query()->where('company_name', $data['supplier'])->orWhere('code', $data['supplier'])->first()
            : $existing?->supplier;

        $payload = [
            'description' => $data['itemName'] ?? $data['description'],
            'category' => $data['category'],
            'quantity' => (int) $data['quantity'],
            'min_stock_level' => (int) $data['minStockLevel'],
            'unit' => $data['unit'] ?? 'Units',
            'supplier_id' => $supplier?->id,
            'cost' => (float) $data['cost'],
            'storage_location_id' => $this->resolveStorageLocationId($data, $existing),
            'serial_number' => $data['serialNumber'] ?? 'N/A',
            'warranty' => $data['warranty'] ?? 'N/A',
            'warranty_expires_on' => filled($data['warrantyExpiresOn'] ?? null) ? $data['warrantyExpiresOn'] : ($existing?->warranty_expires_on),
            'condition' => $data['condition'] ?? 'New',
        ];

        if ($existing) {
            $existing->update($payload);
            $item = $existing->fresh(['supplier', 'storageLocation']);
            $this->notifications->create('Inventory Updated', "Item {$item->item_code} - {$item->description} details updated.", 'stock', 'info');
        } else {
            $payload['code'] = DocumentCode::next('inventory_items', 'code', 'INV', 3, false);
            $payload['item_code'] = filled($data['itemCode'] ?? null)
                ? $data['itemCode']
                : $this->nextItemCode($data['category'] ?? 'ITEM');
            $item = InventoryItem::query()->create($payload)->fresh(['supplier', 'storageLocation']);
            $this->notifications->create('New Item Added', "Item {$item->item_code} added to inventory.", 'stock', 'success');
        }

        if ($image instanceof UploadedFile) {
            $this->storeInventoryItemImage($item, $image);
            $item = $item->fresh(['supplier', 'storageLocation']);
        } elseif ($removeImage) {
            $this->deleteInventoryItemImage($item);
            $item = $item->fresh(['supplier', 'storageLocation']);
        }

        $this->broadcastStock($item);

        return $item;
    }

    private function storeInventoryItemImage(InventoryItem $item, UploadedFile $image): void
    {
        $oldPath = $item->image_path;
        $extension = strtolower($image->guessExtension() ?: $image->getClientOriginalExtension() ?: 'jpg');

        if (! in_array($extension, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
            $extension = 'jpg';
        }

        $path = $image->storeAs('inventory-items', $item->code.'.'.$extension, 'public');

        if ($oldPath && $oldPath !== $path) {
            $this->deletePublicFile($oldPath);
        }

        $item->forceFill(['image_path' => $path])->save();
    }

    private function deleteInventoryItemImage(InventoryItem $item): void
    {
        $this->deletePublicFile($item->image_path);
        $item->forceFill(['image_path' => null])->save();
    }

    private function deletePublicFile(?string $path): void
    {
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    public function createStorageLocation(array $data): StorageLocation
    {
        return StorageLocation::query()->create([
            'rack' => $data['rack'],
            'shelf' => $data['shelf'],
            'bin' => $data['bin'],
            'category' => $data['category'] ?? null,
            'max_capacity' => (int) ($data['maxCapacity'] ?? 50),
        ]);
    }

    public function bootstrapWarehouseLayout(): int
    {
        $racks = [
            'Rack A' => 'Office Supplies',
            'Rack B' => 'Communication Devices',
            'Rack C' => 'Maintenance Tools',
            'Rack D' => 'Fleet Consumables',
        ];

        $created = 0;

        foreach ($racks as $rack => $category) {
            foreach (['Shelf 01', 'Shelf 02', 'Shelf 03'] as $shelf) {
                foreach (['Bin 01', 'Bin 02', 'Bin 03', 'Bin 04'] as $bin) {
                    $location = StorageLocation::query()->firstOrCreate(
                        compact('rack', 'shelf', 'bin'),
                        [
                            'category' => $category,
                            'max_capacity' => 50,
                        ]
                    );

                    if ($location->wasRecentlyCreated) {
                        $created++;
                    }
                }
            }
        }

        return $created;
    }

    public function moveInventoryItem(InventoryItem $item, mixed $storageLocationId, User $actor): InventoryItem
    {
        $item->loadMissing('storageLocation');
        $from = $item->locationLabel();
        $locationId = $storageLocationId === null || $storageLocationId === ''
            ? null
            : (int) $storageLocationId;

        if ($locationId !== null && (int) $item->storage_location_id === $locationId) {
            return $item->fresh(['supplier', 'storageLocation']);
        }

        if ($locationId === null && $item->storage_location_id === null) {
            return $item->fresh(['supplier', 'storageLocation']);
        }

        $location = $locationId ? StorageLocation::query()->findOrFail($locationId) : null;
        $item->storage_location_id = $location?->id;
        $item->save();

        $item = $item->fresh(['supplier', 'storageLocation']);
        $to = $item->locationLabel();
        $timestamp = now()->format('Y-m-d H:i');

        $this->recordMovement([
            'inventory_item_id' => $item->id,
            'item_code' => $item->item_code,
            'item_name' => $item->description,
            'movement_type' => 'Transfer',
            'quantity' => $item->quantity,
            'moved_at' => $timestamp,
            'location' => $to,
            'reference' => $item->code,
            'remarks' => "Moved from {$from} to {$to}.",
            'recorded_by' => $actor->name,
        ]);

        $this->notifications->create(
            'Item Relocated',
            "{$item->item_code} ({$item->description}) moved from {$from} to {$to}.",
            'stock',
            'info'
        );

        $this->broadcastStock($item);
        $this->broadcastRecordedMovements();

        return $item;
    }

    public function placeUnassignedItems(): int
    {
        $placed = 0;
        $items = InventoryItem::query()->whereNull('storage_location_id')->orderBy('item_code')->get();

        foreach ($items as $item) {
            $location = StorageLocation::query()
                ->where('category', $item->category)
                ->withCount('inventoryItems')
                ->orderBy('inventory_items_count')
                ->orderBy('rack')
                ->orderBy('shelf')
                ->orderBy('bin')
                ->first();

            if (! $location) {
                $location = StorageLocation::query()
                    ->withCount('inventoryItems')
                    ->orderBy('inventory_items_count')
                    ->orderBy('id')
                    ->first();
            }

            if (! $location) {
                continue;
            }

            $item->storage_location_id = $location->id;
            $item->save();
            $placed++;
        }

        return $placed;
    }

    public function submitPhysicalCount(StockCount $count, array $items, User $actor): StockCount
    {
        return DB::transaction(function () use ($count, $items, $actor) {
            $discrepancyCount = 0;

            foreach ($items as $line) {
                $variance = (int) $line['actualQty'] - (int) $line['systemQty'];
                $count->items()->where('item_code', $line['itemCode'])->update([
                    'actual_qty' => (int) $line['actualQty'],
                    'variance' => $variance,
                    'notes' => $line['notes'] ?? '',
                ]);

                if ($variance === 0) {
                    continue;
                }

                $discrepancyCount++;
                $item = InventoryItem::query()->where('item_code', $line['itemCode'])->first();
                if ($item) {
                    $item->quantity = (int) $line['actualQty'];
                    $item->save();
                    $this->broadcastStock($item);
                }

                $this->recordMovement([
                    'inventory_item_id' => $item?->id,
                    'item_code' => $line['itemCode'],
                    'item_name' => $line['itemName'] ?? $line['itemCode'],
                    'movement_type' => $variance < 0 ? 'Adjustment' : 'Receiving',
                    'quantity' => abs($variance),
                    'moved_at' => now()->format('Y-m-d H:i'),
                    'location' => 'Stock Audit Adjustments',
                    'reference' => $count->count_number,
                    'remarks' => 'Physical stock count variance adjustment ('.($variance > 0 ? '+' : '')."{$variance}). Notes: ".($line['notes'] ?? 'None'),
                    'recorded_by' => $actor->name,
                ]);
            }

            $count->update([
                'status' => 'Completed',
                'discrepancy_count' => $discrepancyCount,
                'total_items_audited' => count($items),
            ]);

            $this->notifications->create(
                'Stock Count Audit Submitted',
                "Stock Count {$count->count_number} completed. Audited ".count($items)." items with {$discrepancyCount} discrepancy adjustments.",
                'stock',
                $discrepancyCount > 0 ? 'warning' : 'success'
            );
            $this->broadcastRecordedMovements();

            return $count->fresh(['items']);
        });
    }

    public function startStockCount(string $title, string $location, User $actor): StockCount
    {
        $count = StockCount::query()->create([
            'count_number' => DocumentCode::next('stock_counts', 'count_number', 'SC'),
            'title' => $title ?: 'Ad-Hoc Inventory Physical Audit ('.now()->toDateString().')',
            'count_date' => now()->toDateString(),
            'location' => $location ?: 'Main Warehouse - Pasig Depot',
            'status' => 'In Progress',
            'total_items_audited' => 0,
            'discrepancy_count' => 0,
        ]);

        $items = InventoryItem::query()->get();
        foreach ($items as $item) {
            $count->items()->create([
                'item_code' => $item->item_code,
                'item_name' => $item->description,
                'system_qty' => $item->quantity,
                'actual_qty' => $item->quantity,
                'variance' => 0,
                'notes' => '',
            ]);
        }

        $count->update(['total_items_audited' => $items->count()]);

        return $count->fresh(['items']);
    }

    public function submitSupplierQuotation(array $data, User $actor): Quotation
    {
        $pr = ProcurementRequest::query()->where('pr_number', $data['procurementId'])->firstOrFail();
        $supplier = $actor->supplier;

        if ($actor->isSupplier() && $actor->supplier_id) {
            $invited = SupplierOpportunity::query()
                ->where('procurement_request_id', $pr->id)
                ->where('supplier_id', $actor->supplier_id)
                ->exists();

            if (! $invited) {
                throw ValidationException::withMessages([
                    'procurementId' => ['This procurement request was not sent to your vendor portal.'],
                ]);
            }

            $alreadyQuoted = Quotation::query()
                ->where('procurement_request_id', $pr->id)
                ->where('supplier_id', $actor->supplier_id)
                ->exists();

            if ($alreadyQuoted) {
                throw ValidationException::withMessages([
                    'procurementId' => ['You already submitted a quotation for this item. Edit it from My Quotes.'],
                ]);
            }
        }

        $itemPhotos = $this->uploadedPhotos($data['itemPhotos'] ?? null);
        if ($itemPhotos === [] && ! empty($data['itemPhotoTokens'])) {
            $itemPhotos = app(QuotationUploadService::class)->photosFromTokens($data['itemPhotoTokens'], $actor);
        }
        $warrantyFile = $this->resolveQuotedDocument($data, $actor, 'warrantyFile', 'warrantyToken', 'warrantyFileBase64', 'warrantyFileName');
        $manualFile = $this->resolveQuotedDocument($data, $actor, 'manualFile', 'manualToken', 'manualFileBase64', 'manualFileName');
        unset(
            $data['warrantyFile'],
            $data['warrantyFileBase64'],
            $data['warrantyFileName'],
            $data['warrantyToken'],
            $data['manualFile'],
            $data['manualFileBase64'],
            $data['manualFileName'],
            $data['manualToken'],
            $data['itemPhotos'],
            $data['itemPhotosBase64'],
            $data['itemPhotoNames'],
            $data['itemPhotoTokens']
        );

        $quote = Quotation::query()->create([
            'quote_number' => DocumentCode::next('quotations', 'quote_number', 'QT'),
            'procurement_request_id' => $pr->id,
            'supplier_id' => $supplier?->id,
            'supplier_name' => $supplier?->company_name ?? $actor->name,
            'item' => $data['item'],
            'quantity' => (int) $data['quantity'],
            'unit_price' => (float) $data['unitPrice'],
            'total_price' => (float) $data['totalPrice'],
            'warranty' => $data['warranty'] ?? null,
            'warranty_months' => WarrantyDuration::months($data['warrantyMonths'] ?? null, $data['warranty'] ?? null),
            'delivery_time_days' => (int) ($data['deliveryTimeDays'] ?? 0),
            'quality_rating' => (float) ($data['qualityRating'] ?? ($supplier?->rating ?? 0)),
            'payment_terms' => $data['paymentTerms'] ?? '30 Days Net',
            'status' => 'Submitted',
            'notes' => $data['notes'] ?? null,
        ]);

        if ($warrantyFile instanceof UploadedFile) {
            $this->storeWarrantyFile($quote, $warrantyFile);
        }

        if ($manualFile instanceof UploadedFile) {
            $this->storeManualFile($quote, $manualFile);
        }

        $this->syncQuotationItemPhotos($quote, $itemPhotos, []);

        $pr->update(['status' => 'Evaluation']);

        if ($supplier) {
            SupplierOpportunity::query()
                ->where('procurement_request_id', $pr->id)
                ->where('supplier_id', $supplier->id)
                ->update(['status' => 'Quoted']);
        }

        try {
            $this->notifications->create(
                'New Quotation Received from Supplier',
                "{$quote->supplier_name} submitted a quotation (₱".number_format($quote->total_price, 2).") for {$quote->item}.",
                'procurement',
                'success'
            );
        } catch (\Throwable) {
            // The quotation is already saved; a notification collision must not fail submit.
        }

        $resource = (new QuotationResource($quote->load(['procurementRequest.catalogItem', 'supplier'])))->resolve();
        $this->broadcastSafely(new QuotationSubmitted($resource));

        return $quote->fresh(['procurementRequest.catalogItem', 'supplier']);
    }

    public function updateSupplierQuotation(Quotation $quote, array $data, User $actor): Quotation
    {
        $quote->loadMissing(['procurementRequest', 'supplier']);

        if ($actor->isSupplier() && (int) $quote->supplier_id !== (int) $actor->supplier_id) {
            throw ValidationException::withMessages([
                'quotation' => ['You can only edit quotations from your vendor account.'],
            ]);
        }

        if (! $quote->canEdit()) {
            throw ValidationException::withMessages([
                'quotation' => ['This quotation can no longer be edited because it was accepted or a supplier has already been selected.'],
            ]);
        }

        $itemPhotos = $this->uploadedPhotos($data['itemPhotos'] ?? null);
        if ($itemPhotos === [] && ! empty($data['itemPhotoTokens'])) {
            $itemPhotos = app(QuotationUploadService::class)->photosFromTokens($data['itemPhotoTokens'], $actor);
        }
        $warrantyFile = $this->resolveQuotedDocument($data, $actor, 'warrantyFile', 'warrantyToken', 'warrantyFileBase64', 'warrantyFileName');
        $manualFile = $this->resolveQuotedDocument($data, $actor, 'manualFile', 'manualToken', 'manualFileBase64', 'manualFileName');
        $keepItemPhotos = array_key_exists('keepItemPhotos', $data) && is_array($data['keepItemPhotos'])
            ? $data['keepItemPhotos']
            : null;
        unset(
            $data['warrantyFile'],
            $data['warrantyFileBase64'],
            $data['warrantyFileName'],
            $data['warrantyToken'],
            $data['manualFile'],
            $data['manualFileBase64'],
            $data['manualFileName'],
            $data['manualToken'],
            $data['itemPhotos'],
            $data['itemPhotosBase64'],
            $data['itemPhotoNames'],
            $data['itemPhotoTokens'],
            $data['keepItemPhotos']
        );

        $this->syncQuotationItemPhotos($quote, $itemPhotos, $keepItemPhotos);

        $warrantyText = array_key_exists('warranty', $data) ? ($data['warranty'] ?: null) : $quote->warranty;
        $warrantyMonths = array_key_exists('warrantyMonths', $data)
            ? WarrantyDuration::months($data['warrantyMonths'], $warrantyText)
            : WarrantyDuration::months($quote->warranty_months, $warrantyText);

        $unitPrice = (float) $data['unitPrice'];
        $quote->update([
            'unit_price' => $unitPrice,
            'total_price' => $unitPrice * (int) $quote->quantity,
            'warranty' => $warrantyText,
            'warranty_months' => $warrantyMonths,
            'delivery_time_days' => (int) ($data['deliveryTimeDays'] ?? $quote->delivery_time_days),
            'payment_terms' => $data['paymentTerms'] ?? $quote->payment_terms,
            'notes' => $data['notes'] ?? $quote->notes,
        ]);

        if ($warrantyFile instanceof UploadedFile) {
            $this->storeWarrantyFile($quote, $warrantyFile);
        }

        if ($manualFile instanceof UploadedFile) {
            $this->storeManualFile($quote, $manualFile);
        }

        $quote = $quote->fresh(['procurementRequest.catalogItem', 'supplier']);

        try {
            $this->notifications->create(
                'Quotation Updated',
                "{$quote->supplier_name} updated their quotation (₱".number_format($quote->total_price, 2).") for {$quote->item}.",
                'procurement',
                'info'
            );
        } catch (\Throwable) {
            // Keep the saved quotation even if notification numbering collides.
        }

        $this->broadcastSafely(new QuotationSubmitted(
            (new QuotationResource($quote))->resolve()
        ));

        return $quote;
    }

    public function createManualProcurementRequest(InventoryItem $item, int $quantity, string $reason, string $priority, ?int $neededInDays = null): ProcurementRequest
    {
        $normalized = Priority::normalize($priority);
        $pr = ProcurementRequest::query()->create([
            'pr_number' => DocumentCode::next('procurement_requests', 'pr_number', 'PR'),
            'source_request' => 'MANUAL',
            'department' => 'Inventory Management',
            'item_code' => $item->item_code,
            'item_name' => $item->description,
            'quantity' => $quantity,
            'reason' => $reason,
            'priority' => $normalized,
            'needed_in_days' => Priority::neededInDays($normalized, $neededInDays),
            'status' => 'For Procurement',
            'date_created' => now()->toDateString(),
            'estimated_cost' => ($item->cost ?: 1000) * $quantity,
        ]);

        return $pr;
    }

    public function updateProcurementRequest(ProcurementRequest $pr, array $data): ProcurementRequest
    {
        if ($pr->status !== 'For Procurement' || filled($pr->po_number)) {
            throw ValidationException::withMessages([
                'procurementRequest' => 'This request has already been sent to vendors and can no longer be edited.',
            ]);
        }

        $item = InventoryItem::query()->where('item_code', $pr->item_code)->first();
        $quantity = (int) ($data['quantity'] ?? $pr->quantity);
        $priority = isset($data['priority']) ? Priority::normalize($data['priority']) : Priority::normalize($pr->priority);
        $previousDefault = Priority::neededInDays($pr->priority);
        $neededInDays = array_key_exists('neededInDays', $data)
            ? Priority::neededInDays($priority, $data['neededInDays'])
            : ((int) $pr->needed_in_days === $previousDefault
                ? Priority::neededInDays($priority)
                : Priority::neededInDays($priority, $pr->needed_in_days));

        $pr->update([
            'quantity' => $quantity,
            'reason' => $data['reason'] ?? $pr->reason,
            'priority' => $priority,
            'needed_in_days' => $neededInDays,
            'estimated_cost' => ($item?->cost ?: 1000) * $quantity,
        ]);

        return $pr->fresh()->loadCount('opportunities');
    }

    public function sendProcurementToVendors(ProcurementRequest $pr): int
    {
        return DB::transaction(function () use ($pr) {
            $item = InventoryItem::query()->where('item_code', $pr->item_code)->first();
            $category = $item?->category;
            $invited = $this->publishOpportunities($pr, $category);

            if (in_array($pr->status, ['For Procurement', 'Quotation'], true)) {
                $pr->update(['status' => 'Quotation']);
            }

            if ($invited > 0) {
                $this->notifications->create(
                    'RFQ Sent to Vendor Portals',
                    "Procurement {$pr->pr_number} — {$pr->item_name} ({$pr->item_code}) x{$pr->quantity} — was sent to {$invited} vendor portal(s) for quotation.",
                    'procurement',
                    'success'
                );

                $this->broadcastSafely(new OpportunityPublished([
                    'prNumber' => $pr->pr_number,
                    'itemName' => $pr->item_name,
                    'itemCode' => $pr->item_code,
                    'quantity' => $pr->quantity,
                    'vendorCount' => $invited,
                ]));
            }

            return $invited;
        });
    }

    public function flagOverdueRfqs(): int
    {
        $requests = ProcurementRequest::query()
            ->withCount('quotations')
            ->whereNull('rfq_overdue_notified_at')
            ->whereNull('po_number')
            ->where(function ($query) {
                $query->whereNull('selected_supplier')->orWhere('selected_supplier', '');
            })
            ->whereIn('status', ['Quotation', 'For Procurement'])
            ->whereHas('opportunities', fn ($query) => $query->whereDate('deadline', '<', now()->toDateString()))
            ->get();

        $notified = 0;

        foreach ($requests as $pr) {
            if ((int) $pr->quotations_count > 0) {
                continue;
            }

            $deadline = $pr->opportunities()->min('deadline');
            $this->notifications->create(
                'RFQ deadline passed with no quotes',
                "Procurement {$pr->pr_number} ({$pr->item_name}) received no vendor quotations by ".Priority::displayDate($deadline).'. The RFQ stays open so a late quote can still be submitted.',
                'procurement',
                'danger'
            );
            $pr->update(['rfq_overdue_notified_at' => now()]);
            $notified++;
        }

        return $notified;
    }

    private function publishOpportunities(ProcurementRequest $pr, ?string $category): int
    {
        $suppliers = Supplier::query()
            ->where('status', 'Active')
            ->with('users:id,supplier_id')
            ->get();

        $alreadySent = SupplierOpportunity::query()
            ->where('procurement_request_id', $pr->id)
            ->pluck('supplier_id')
            ->all();

        $newSuppliers = $suppliers->reject(fn (Supplier $supplier) => in_array($supplier->id, $alreadySent, true))->values();

        if ($newSuppliers->isEmpty()) {
            return 0;
        }

        $now = now();
        $priority = Priority::normalize($pr->priority);
        $quoteDays = Priority::quoteDays($priority);
        $neededInDays = Priority::neededInDays($priority, $pr->needed_in_days);
        $deadline = $now->copy()->addDays($quoteDays)->toDateString();
        $neededBy = $now->copy()->addDays($neededInDays)->toDateString();
        $requirements = trim(implode(' ', array_filter([
            "Please submit a quotation for {$pr->quantity} units of {$pr->item_name} ({$pr->item_code}).",
            "Quote by ".Priority::displayDate($deadline).". Need item in {$neededInDays} day(s) (".Priority::displayDate($neededBy).").",
            $pr->reason,
        ])));
        $budgetRange = $pr->estimated_cost
            ? '₱'.number_format((float) $pr->estimated_cost, 2)
            : 'TBD';
        $codes = DocumentCode::nextMany('supplier_opportunities', 'opportunity_number', 'OPP', $newSuppliers->count());
        $rows = [];

        foreach ($newSuppliers as $index => $supplier) {
            $rows[] = [
                'opportunity_number' => $codes[$index],
                'pr_number' => $pr->pr_number,
                'procurement_request_id' => $pr->id,
                'supplier_id' => $supplier->id,
                'title' => $pr->item_name,
                'category' => $category,
                'quantity' => $pr->quantity,
                'deadline' => $deadline,
                'budget_range' => $budgetRange,
                'status' => 'Open for Quotation',
                'requirements' => $requirements,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        SupplierOpportunity::query()->insert($rows);

        $vendorNotes = [];
        $deadlineLabel = $quoteDays === 1 ? 'tomorrow' : Priority::displayDate($deadline);
        foreach ($newSuppliers as $supplier) {
            foreach ($supplier->users as $vendorUser) {
                $vendorNotes[] = [
                    'title' => $priority === Priority::NORMAL
                        ? 'New RFQ Available'
                        : "{$priority} RFQ: quote {$pr->quantity} {$pr->item_name} by {$deadlineLabel}",
                    'message' => "{$pr->pr_number}: quote {$pr->quantity} units of {$pr->item_name} ({$pr->item_code}) by {$deadlineLabel}. Item needed by ".Priority::displayDate($neededBy).".",
                    'type' => 'procurement',
                    'severity' => Priority::notificationSeverity($priority),
                    'user_id' => $vendorUser->id,
                ];
            }
        }

        $this->notifications->createMany($vendorNotes);

        return $newSuppliers->count();
    }

    private function resolveStorageLocationId(array $data, ?InventoryItem $existing): ?int
    {
        if (array_key_exists('storageLocationId', $data)) {
            $id = $data['storageLocationId'];

            return $id === null || $id === '' ? null : (int) $id;
        }

        $label = trim((string) ($data['location'] ?? ''));
        if ($label === '' || strcasecmp($label, 'Unassigned') === 0) {
            return $existing?->storage_location_id;
        }

        $normalized = str_replace(['→', '—', '–'], '->', $label);
        $parts = array_values(array_filter(array_map('trim', explode('->', $normalized))));
        if (count($parts) >= 3) {
            $match = StorageLocation::query()
                ->where('rack', $parts[0])
                ->where('shelf', $parts[1])
                ->where('bin', $parts[2])
                ->first();

            if ($match) {
                return $match->id;
            }
        }

        return $existing?->storage_location_id;
    }

    private function createDefaultTimeline(PurchaseOrder $po, string $timestamp): void
    {
        $steps = [
            ['Procurement Completed', $timestamp, 'completed'],
            ['Supplier Selected', $timestamp, 'completed'],
            ['PO Created', $timestamp, 'completed'],
            ['Finance Approval Checkpoint', $timestamp, 'in_progress'],
            ['Sent to Supplier', '—', 'pending'],
            ['Supplier Confirmation', '—', 'pending'],
            ['Delivery & Inspection', '—', 'pending'],
            ['Inventory Updated', '—', 'pending'],
        ];

        foreach ($steps as $index => [$step, $date, $status]) {
            $po->timeline()->create([
                'sort_order' => $index + 1,
                'step' => $step,
                'step_date' => $date,
                'status' => $status,
            ]);
        }
    }

    private function updateTimelineSteps(int $purchaseOrderId, array $updates): void
    {
        if ($updates === []) {
            return;
        }

        $dateSql = 'CASE step';
        $statusSql = 'CASE step';
        $bindings = [];

        foreach ($updates as $step => [$date, $status]) {
            $dateSql .= ' WHEN ? THEN ?';
            $statusSql .= ' WHEN ? THEN ?';
            array_push($bindings, $step, $date, $step, $status);
        }

        $dateSql .= ' ELSE step_date END';
        $statusSql .= ' ELSE status END';
        $placeholders = implode(',', array_fill(0, count($updates), '?'));

        DB::update(
            "UPDATE purchase_order_timeline_steps SET step_date = {$dateSql}, status = {$statusSql}, updated_at = ? WHERE purchase_order_id = ? AND step IN ({$placeholders})",
            [...$bindings, now(), $purchaseOrderId, ...array_keys($updates)]
        );
    }

    private function broadcastPO(PurchaseOrder $po): void
    {
        $this->broadcastSafely(new PurchaseOrderUpdated(
            (new PurchaseOrderResource($po))->resolve()
        ));
    }

    private function broadcastStock(InventoryItem $item): void
    {
        $this->broadcastSafely(new StockStatusChanged(
            (new InventoryItemResource($item->load(['supplier', 'storageLocation'])))->resolve()
        ));
    }

    private function broadcastDelivery(Delivery $delivery): void
    {
        $this->broadcastSafely(new DeliveryUpdated(
            (new DeliveryResource($delivery->loadMissing('items')))->resolve()
        ));
    }

    private function recordMovement(array $attributes): InventoryMovement
    {
        $movement = InventoryMovement::query()->create([
            'movement_number' => DocumentCode::next('inventory_movements', 'movement_number', 'MOV'),
            ...$attributes,
        ]);
        $this->recordedMovements[] = $movement;

        return $movement;
    }

    private function broadcastRecordedMovements(): void
    {
        if ($this->recordedMovements === []) {
            return;
        }

        $this->broadcastSafely(new InventoryMovementCreated($this->recordedMovementPayload()));
    }

    private function broadcastSafely(object $event): void
    {
        SafeBroadcast::later($event);
    }

    public function archiveDocument(array $data, ?UploadedFile $file = null): Document
    {
        $item = filled($data['itemCode'] ?? null)
            ? InventoryItem::query()->where('item_code', $data['itemCode'])->first()
            : null;
        $po = filled($data['purchaseOrderNumber'] ?? null)
            ? PurchaseOrder::query()->where('po_number', $data['purchaseOrderNumber'])->first()
            : null;
        $supplier = $this->resolveSupplier($data['supplierId'] ?? null, $data['supplier'] ?? null);

        $number = DocumentCode::next('documents', 'document_number', 'DOC');
        $filePath = null;
        $fileSize = null;
        $originalName = null;

        if ($file instanceof UploadedFile) {
            $filePath = $this->storePublicUpload($file, 'dtrs-documents', $number);
            $fileSize = $this->humanFileSize($file->getSize());
            $originalName = $file->getClientOriginalName();
        }

        $doc = Document::query()->create([
            'document_number' => $number,
            'title' => $data['title'],
            'type' => $data['type'],
            'reference_number' => $data['referenceNumber'] ?? $po?->po_number,
            'supplier' => $supplier?->company_name ?? ($data['supplier'] ?? null),
            'issue_date' => $data['issueDate'] ?? now()->toDateString(),
            'expiration_date' => $data['expirationDate'] ?? null,
            'status' => 'Active',
            'category' => $data['category'] ?? $item?->category,
            'file_size' => $fileSize,
            'file_path' => $filePath,
            'original_filename' => $originalName,
            'source' => $data['source'] ?? 'manual',
            'warranty_months' => WarrantyDuration::months($data['warrantyMonths'] ?? null, null),
            'inventory_item_id' => $item?->id,
            'purchase_order_id' => $po?->id,
            'quotation_id' => $data['quotationId'] ?? null,
            'supplier_id' => $supplier?->id,
        ]);

        $this->notifications->create(
            'Document Archived',
            "Document \"{$doc->title}\" uploaded into DTRS.",
            'document',
            'info'
        );

        return $doc->fresh(['inventoryItem', 'purchaseOrder', 'supplierAccount']);
    }

    private function resolveSupplier(mixed $supplierId = null, ?string $name = null): ?Supplier
    {
        if (filled($supplierId)) {
            $match = Supplier::query()
                ->where('code', $supplierId)
                ->when(is_numeric($supplierId), fn ($query) => $query->orWhere('id', $supplierId))
                ->first();
            if ($match) {
                return $match;
            }
        }

        if (! filled($name)) {
            return null;
        }

        return Supplier::query()
            ->where('company_name', $name)
            ->orWhere('code', $name)
            ->first();
    }

    private function applyReceivedWarranty(InventoryItem $item, ?PurchaseOrder $po): void
    {
        if (! $po) {
            return;
        }

        $months = WarrantyDuration::months($po->warranty_months, $po->warranty);
        if ($months) {
            $item->warranty_expires_on = now()->addMonths($months)->toDateString();
        }

        if (filled($po->warranty)) {
            $item->warranty = $po->warranty;
        }

        $already = Document::query()
            ->where('purchase_order_id', $po->id)
            ->where('inventory_item_id', $item->id)
            ->where('type', 'Warranty')
            ->exists();

        if ($already) {
            return;
        }

        $number = DocumentCode::next('documents', 'document_number', 'DOC');
        $filePath = null;
        $fileSize = null;
        $originalName = null;

        if ($po->warranty_file_path && Storage::disk('public')->exists($po->warranty_file_path)) {
            $extension = pathinfo($po->warranty_file_path, PATHINFO_EXTENSION) ?: 'pdf';
            $filePath = 'dtrs-documents/'.$number.'.'.$extension;
            Storage::disk('public')->copy($po->warranty_file_path, $filePath);
            $fileSize = $this->humanFileSize((int) Storage::disk('public')->size($filePath));
            $originalName = basename($po->warranty_file_path);
        }

        Document::query()->create([
            'document_number' => $number,
            'title' => $item->description.' warranty',
            'type' => 'Warranty',
            'reference_number' => $po->po_number,
            'supplier' => $po->supplier,
            'issue_date' => now()->toDateString(),
            'expiration_date' => $item->warranty_expires_on,
            'status' => 'Active',
            'category' => $item->category,
            'file_size' => $fileSize,
            'file_path' => $filePath,
            'original_filename' => $originalName,
            'source' => 'receiving',
            'warranty_months' => $months,
            'inventory_item_id' => $item->id,
            'purchase_order_id' => $po->id,
            'supplier_id' => $po->supplier_id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveQuotedDocument(
        array $data,
        User $actor,
        string $fileKey,
        string $tokenKey,
        string $base64Key,
        string $nameKey
    ): ?UploadedFile {
        $file = $data[$fileKey] ?? null;

        if (! $file instanceof UploadedFile && ! empty($data[$tokenKey])) {
            $file = app(QuotationUploadService::class)->toUploadedFile($data[$tokenKey], $actor, $fileKey);
        }

        if (! $file instanceof UploadedFile) {
            $file = $this->uploadedFileFromBase64($data[$base64Key] ?? null, $data[$nameKey] ?? null, $fileKey);
        }

        return $file instanceof UploadedFile ? $file : null;
    }

    private function uploadedFileFromBase64(mixed $base64, mixed $filename, string $errorKey = 'warrantyFile'): ?UploadedFile
    {
        $prefix = $errorKey === 'manualFile' ? 'manual_' : 'warranty_';

        return Base64Upload::file(
            $base64,
            $filename,
            $errorKey,
            10 * 1024 * 1024,
            ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
            'pdf',
            $prefix
        );
    }

    private function storeWarrantyFile(Quotation $quote, UploadedFile $file): void
    {
        $this->storeQuotationDocument($quote, $file, 'quotation-warranties', 'warranty_file_path');
    }

    private function storeManualFile(Quotation $quote, UploadedFile $file): void
    {
        $this->storeQuotationDocument($quote, $file, 'quotation-manuals', 'manual_file_path');
    }

    private function storeQuotationDocument(Quotation $quote, UploadedFile $file, string $directory, string $column): void
    {
        $oldPath = $quote->{$column};
        $path = $this->storePublicUpload($file, $directory, $quote->quote_number);

        if ($oldPath && $oldPath !== $path && Storage::disk('public')->exists($oldPath)) {
            Storage::disk('public')->delete($oldPath);
        }

        $quote->forceFill([$column => $path])->save();
    }

    /**
     * @return list<UploadedFile>
     */
    private function uploadedPhotos(mixed $photos): array
    {
        if (! is_array($photos)) {
            return [];
        }

        return array_values(array_filter($photos, fn ($photo) => $photo instanceof UploadedFile));
    }

    /**
     * Reconciles the vendor photo set: keeps the requested existing photos, adds the new
     * uploads, and removes any file that is no longer referenced.
     *
     * @param  list<UploadedFile>  $newPhotos
     * @param  list<string>|null  $keepPaths  Null keeps every photo already on file.
     */
    private function syncQuotationItemPhotos(Quotation $quote, array $newPhotos, ?array $keepPaths): void
    {
        $existing = $quote->itemPhotoPaths();

        $kept = $keepPaths === null
            ? $existing
            : array_values(array_intersect($existing, $this->normalizeItemPhotoPaths($keepPaths)));

        $total = count($kept) + count($newPhotos);

        if ($total < 1) {
            throw ValidationException::withMessages([
                'itemPhotos' => ['Attach 1 to 3 photos of the actual item you are offering.'],
            ]);
        }

        if ($total > self::MAX_QUOTATION_ITEM_PHOTOS) {
            throw ValidationException::withMessages([
                'itemPhotos' => ['You can attach a maximum of '.self::MAX_QUOTATION_ITEM_PHOTOS.' item photos.'],
            ]);
        }

        $paths = $kept;
        foreach ($newPhotos as $photo) {
            $paths[] = $this->storeQuotationItemPhoto($quote, $photo, $paths);
        }

        foreach (array_diff($existing, $paths) as $orphan) {
            $this->deletePublicFile($orphan);
        }

        $quote->forceFill(['item_photo_paths' => array_values($paths)])->save();
    }

    /**
     * @param  list<string>  $usedPaths  Paths already taken by this quotation.
     */
    private function storeQuotationItemPhoto(Quotation $quote, UploadedFile $photo, array $usedPaths): string
    {
        $extension = strtolower($photo->guessExtension() ?: $photo->getClientOriginalExtension() ?: 'jpg');
        if (! in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)) {
            $extension = 'jpg';
        }

        $usedSlots = [];
        foreach ($usedPaths as $path) {
            if (preg_match('/-(\d+)\.[A-Za-z0-9]+$/', basename($path), $matches)) {
                $usedSlots[] = (int) $matches[1];
            }
        }

        $slot = 1;
        while (in_array($slot, $usedSlots, true)) {
            $slot++;
        }

        return $photo->storeAs(
            'quotation-item-photos',
            $quote->quote_number.'-'.$slot.'.'.$extension,
            'public'
        );
    }

    /**
     * Accepts either stored paths or the `/storage/...` URLs echoed back by the client.
     *
     * @param  list<mixed>  $paths
     * @return list<string>
     */
    private function normalizeItemPhotoPaths(array $paths): array
    {
        $normalized = [];

        foreach ($paths as $path) {
            if (! is_string($path) || trim($path) === '') {
                continue;
            }

            $normalized[] = ltrim(preg_replace('#^/?storage/#', '', trim($path)) ?? '', '/');
        }

        return array_values(array_unique($normalized));
    }

    private function storePublicUpload(UploadedFile $file, string $directory, string $basename): string
    {
        $extension = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension() ?: 'pdf');
        $allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
        if (! in_array($extension, $allowed, true)) {
            $extension = 'pdf';
        }

        return $file->storeAs($directory, $basename.'.'.$extension, 'public');
    }

    private function humanFileSize(int $bytes): string
    {
        if ($bytes < 1024) {
            return $bytes.' B';
        }

        if ($bytes < 1048576) {
            return round($bytes / 1024, 1).' KB';
        }

        return round($bytes / 1048576, 1).' MB';
    }

    private function nextItemCode(string $category): string
    {
        $normalized = strtolower($category);
        $prefix = match (true) {
            str_contains($normalized, 'office') => 'OFF',
            str_contains($normalized, 'communication') => 'COM',
            str_contains($normalized, 'maintenance') => 'TL',
            str_contains($normalized, 'fleet') => 'FLT',
            default => 'ITEM',
        };

        return DocumentCode::next('inventory_items', 'item_code', $prefix, 3, false);
    }
}
