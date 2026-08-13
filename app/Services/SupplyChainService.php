<?php

namespace App\Services;

use App\Events\OpportunityPublished;
use App\Events\PurchaseOrderUpdated;
use App\Events\QuotationSubmitted;
use App\Events\StockStatusChanged;
use App\Http\Resources\InventoryItemResource;
use App\Http\Resources\PurchaseOrderResource;
use App\Http\Resources\QuotationResource;
use App\Models\Delivery;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderTimelineStep;
use App\Models\Quotation;
use App\Models\Release;
use App\Models\StockCount;
use App\Models\Supplier;
use App\Models\SupplierOpportunity;
use App\Models\SupplyRequest;
use App\Models\User;
use App\Support\DocumentCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SupplyChainService
{
    public function __construct(private NotificationService $notifications) {}

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
                'priority' => $data['priority'] ?? 'MEDIUM',
                'stock_availability' => $available >= $quantity ? 'Stock Available' : 'Insufficient Stock',
                'status' => 'Received',
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

                return $request->fresh(['logs']);
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
                'priority' => $request->priority,
                'status' => 'Quotation',
                'date_created' => now()->toDateString(),
                'estimated_cost' => ($item?->cost ?? 1000) * $request->quantity_requested,
            ]);

            $this->sendProcurementToVendors($pr);

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

            return $request->fresh(['logs']);
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
                'delivery_date' => now()->addDays($quote->delivery_time_days ?: 7)->toDateString(),
                'warranty' => $quote->warranty,
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
        return DB::transaction(function () use ($po, $status, $remarks, $actor) {
            $timestamp = now()->format('Y-m-d H:i');
            $poStatus = $po->po_status;

            $po->timeline->each(function (PurchaseOrderTimelineStep $step) use ($status, $timestamp) {
                if ($step->step !== 'Finance Approval Checkpoint') {
                    return;
                }

                if ($status === 'Finance Approved') {
                    $step->update(['step_date' => $timestamp, 'status' => 'completed']);
                } elseif ($status === 'Finance Rejected') {
                    $step->update(['step_date' => "{$timestamp} (REJECTED)", 'status' => 'rejected']);
                } else {
                    $step->update(['step_date' => "{$timestamp} (RETURNED)", 'status' => 'returned']);
                }
            });

            if ($status === 'Finance Approved') {
                $poStatus = 'Sent to Supplier';
                $po->timeline->firstWhere('step', 'Sent to Supplier')?->update([
                    'step_date' => $timestamp,
                    'status' => 'completed',
                ]);
                $po->timeline->firstWhere('step', 'Supplier Confirmation')?->update([
                    'step_date' => 'Awaiting Supplier Response',
                    'status' => 'in_progress',
                ]);
            } elseif ($status === 'Finance Rejected') {
                $poStatus = 'Finance Rejected';
            } else {
                $poStatus = 'Returned for Revision';
            }

            $po->update([
                'finance_approval_status' => $status,
                'po_status' => $poStatus,
                'approver' => $actor->name,
                'finance_remarks' => $remarks !== '' ? $remarks : ($status === 'Finance Approved' ? 'Approved by Finance Officer' : 'Decision recorded by Finance'),
            ]);

            if ($po->procurementRequest) {
                $po->procurementRequest->update([
                    'status' => $status === 'Finance Approved' ? 'Finance Approved' : ($status === 'Finance Rejected' ? 'Finance Rejected' : 'Quotation'),
                ]);
            }

            $this->notifications->create(
                "Finance Subsystem Decision: {$status}",
                "Purchase Order {$po->po_number} has been updated to \"{$status}\". Remarks: ".($remarks !== '' ? $remarks : 'None'),
                'finance',
                $status === 'Finance Approved' ? 'success' : ($status === 'Finance Rejected' ? 'danger' : 'warning')
            );

            $fresh = $po->fresh(['items', 'timeline', 'procurementRequest', 'supplierAccount']);
            $this->broadcastPO($fresh);

            return $fresh;
        });
    }

    public function supplierConfirmPO(PurchaseOrder $po): PurchaseOrder
    {
        return DB::transaction(function () use ($po) {
            $timestamp = now()->format('Y-m-d H:i');
            $po->timeline->firstWhere('step', 'Supplier Confirmation')?->update([
                'step_date' => $timestamp,
                'status' => 'completed',
            ]);
            $po->timeline->firstWhere('step', 'Delivery & Inspection')?->update([
                'step_date' => 'In Transit',
                'status' => 'in_progress',
            ]);
            $po->update(['po_status' => 'Confirmed']);
            $po->loadMissing('items');
            $this->createInboundDeliveryFromPO($po);

            $this->notifications->create(
                'Supplier Confirmed PO',
                "Supplier has confirmed PO {$po->po_number}. Inbound delivery created for Receiving and Inspection.",
                'po',
                'success'
            );

            $fresh = $po->fresh(['items', 'timeline', 'procurementRequest', 'supplierAccount']);
            $this->broadcastPO($fresh);

            return $fresh;
        });
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
                    $item->save();
                    $this->broadcastStock($item);
                }

                InventoryMovement::query()->create([
                    'movement_number' => DocumentCode::next('inventory_movements', 'movement_number', 'MOV'),
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

            $this->notifications->create(
                "Delivery Inspection Completed ({$inspectionResult})",
                "Delivery {$delivery->delivery_number} inspected. ".($inspectionResult === 'Passed' ? 'Stock updated in inventory.' : 'Partial/Failed inspection logged.'),
                'delivery',
                $inspectionResult === 'Passed' ? 'success' : 'warning'
            );

            return $delivery->fresh(['items', 'purchaseOrder']);
        });
    }

    public function releaseSupplyRequest(SupplyRequest $request, string $releasedTo, User $actor): Release
    {
        return DB::transaction(function () use ($request, $releasedTo, $actor) {
            $timestamp = now()->format('Y-m-d H:i');
            $releaseNumber = DocumentCode::next('releases', 'release_number', 'REL');

            $item = InventoryItem::query()->where('item_code', $request->item_code)->first();
            if ($item) {
                $item->quantity = max(0, $item->quantity - $request->quantity_requested);
                $item->save();
                $this->broadcastStock($item);
            }

            $request->update(['status' => 'Released']);
            $request->logs()->create([
                'logged_at' => $timestamp,
                'note' => "Item released to {$releasedTo}. Release ID: {$releaseNumber}",
            ]);

            $release = Release::query()->create([
                'release_number' => $releaseNumber,
                'supply_request_id' => $request->id,
                'request_id' => $request->request_number,
                'requesting_department' => $request->requesting_department,
                'item_code' => $request->item_code,
                'item_name' => $request->item_name,
                'quantity_released' => $request->quantity_requested,
                'approval_status' => 'Approved by Dept & Stock Verified',
                'stock_status' => 'Deducted from Inventory',
                'release_date' => $timestamp,
                'released_to' => $releasedTo ?: 'Department Representative',
                'dispatched_by' => $actor->name,
            ]);

            InventoryMovement::query()->create([
                'movement_number' => DocumentCode::next('inventory_movements', 'movement_number', 'MOV'),
                'inventory_item_id' => $item?->id,
                'item_code' => $request->item_code,
                'item_name' => $request->item_name,
                'movement_type' => 'Releasing',
                'quantity' => $request->quantity_requested,
                'moved_at' => $timestamp,
                'location' => 'Dispatch Area',
                'reference' => "{$releaseNumber} / {$request->request_number}",
                'remarks' => "Issued to {$request->requesting_department} rep: {$releasedTo}",
                'recorded_by' => $actor->name,
            ]);

            $this->notifications->create(
                'Stock Released to Department',
                "Supply Request {$request->request_number} ({$request->item_name} x{$request->quantity_requested}) has been released and deducted from stock.",
                'stock',
                'success'
            );

            return $release;
        });
    }

    public function saveInventoryItem(array $data, ?InventoryItem $existing = null): InventoryItem
    {
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
            'serial_number' => $data['serialNumber'] ?? 'N/A',
            'warranty' => $data['warranty'] ?? 'N/A',
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

        $this->broadcastStock($item);

        return $item;
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

                InventoryMovement::query()->create([
                    'movement_number' => DocumentCode::next('inventory_movements', 'movement_number', 'MOV'),
                    'inventory_item_id' => $item?->id,
                    'item_code' => $line['itemCode'],
                    'item_name' => $line['itemName'] ?? $line['itemCode'],
                    'movement_type' => $variance < 0 ? 'Damaged' : 'Receiving',
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
            'delivery_time_days' => (int) ($data['deliveryTimeDays'] ?? 0),
            'quality_rating' => (float) ($data['qualityRating'] ?? ($supplier?->rating ?? 0)),
            'payment_terms' => $data['paymentTerms'] ?? '30 Days Net',
            'status' => 'Submitted',
            'notes' => $data['notes'] ?? null,
        ]);

        $pr->update(['status' => 'Evaluation']);

        if ($supplier) {
            SupplierOpportunity::query()
                ->where('procurement_request_id', $pr->id)
                ->where('supplier_id', $supplier->id)
                ->update(['status' => 'Quoted']);
        }

        $this->notifications->create(
            'New Quotation Received from Supplier',
            "{$quote->supplier_name} submitted a quotation (₱".number_format($quote->total_price, 2).") for {$quote->item}.",
            'procurement',
            'success'
        );

        $resource = (new QuotationResource($quote->load(['procurementRequest', 'supplier'])))->resolve();
        $this->broadcastSafely(new QuotationSubmitted($resource));

        return $quote->fresh(['procurementRequest', 'supplier']);
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

        $unitPrice = (float) $data['unitPrice'];
        $quote->update([
            'unit_price' => $unitPrice,
            'total_price' => $unitPrice * (int) $quote->quantity,
            'warranty' => $data['warranty'] ?? $quote->warranty,
            'delivery_time_days' => (int) ($data['deliveryTimeDays'] ?? $quote->delivery_time_days),
            'payment_terms' => $data['paymentTerms'] ?? $quote->payment_terms,
            'notes' => $data['notes'] ?? $quote->notes,
        ]);

        $quote = $quote->fresh(['procurementRequest', 'supplier']);

        $this->notifications->create(
            'Quotation Updated',
            "{$quote->supplier_name} updated their quotation (₱".number_format($quote->total_price, 2).") for {$quote->item}.",
            'procurement',
            'info'
        );

        $this->broadcastSafely(new QuotationSubmitted(
            (new QuotationResource($quote))->resolve()
        ));

        return $quote;
    }

    public function createManualProcurementRequest(InventoryItem $item, int $quantity, string $reason, string $priority): ProcurementRequest
    {
        $pr = ProcurementRequest::query()->create([
            'pr_number' => DocumentCode::next('procurement_requests', 'pr_number', 'PR'),
            'source_request' => 'MANUAL',
            'department' => 'Inventory Management',
            'item_code' => $item->item_code,
            'item_name' => $item->description,
            'quantity' => $quantity,
            'reason' => $reason,
            'priority' => $priority,
            'status' => 'For Procurement',
            'date_created' => now()->toDateString(),
            'estimated_cost' => ($item->cost ?: 1000) * $quantity,
        ]);

        $this->sendProcurementToVendors($pr);

        return $pr;
    }

    public function sendProcurementToVendors(ProcurementRequest $pr): int
    {
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
    }

    private function publishOpportunities(ProcurementRequest $pr, ?string $category): int
    {
        $suppliers = Supplier::query()
            ->where('status', 'Active')
            ->with('users')
            ->get();

        $invited = 0;
        $requirements = trim(implode(' ', array_filter([
            "Please submit a quotation for {$pr->quantity} units of {$pr->item_name} ({$pr->item_code}).",
            $pr->reason,
        ])));

        foreach ($suppliers as $supplier) {
            $alreadySent = SupplierOpportunity::query()
                ->where('procurement_request_id', $pr->id)
                ->where('supplier_id', $supplier->id)
                ->exists();

            if ($alreadySent) {
                continue;
            }

            SupplierOpportunity::query()->create([
                'opportunity_number' => DocumentCode::next('supplier_opportunities', 'opportunity_number', 'OPP'),
                'pr_number' => $pr->pr_number,
                'procurement_request_id' => $pr->id,
                'supplier_id' => $supplier->id,
                'title' => $pr->item_name,
                'category' => $category,
                'quantity' => $pr->quantity,
                'deadline' => now()->addDays(10)->toDateString(),
                'budget_range' => $pr->estimated_cost
                    ? '₱'.number_format((float) $pr->estimated_cost, 2)
                    : 'TBD',
                'status' => 'Open for Quotation',
                'requirements' => $requirements,
            ]);

            $invited++;

            foreach ($supplier->users as $vendorUser) {
                $this->notifications->create(
                    'New RFQ Available',
                    "{$pr->pr_number}: quote {$pr->quantity} units of {$pr->item_name} ({$pr->item_code}).",
                    'procurement',
                    'info',
                    $vendorUser->id
                );
            }
        }

        return $invited;
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

    private function broadcastSafely(object $event): void
    {
        try {
            broadcast($event)->toOthers();
        } catch (\Throwable) {
            // Broadcasting is optional during tests and local bootstrap.
        }
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
