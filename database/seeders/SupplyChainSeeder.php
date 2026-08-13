<?php

namespace Database\Seeders;

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
use App\Support\DocumentCode;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SupplyChainSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('SEED_USER_PASSWORD', 'password');

        $suppliers = $this->seedSuppliers();
        $locations = $this->seedLocations();
        $this->seedUsers($password, $suppliers);
        $items = $this->seedInventory($suppliers, $locations);
        $this->seedSupplyRequests($items);
        $this->seedProcurement();
        $this->seedQuotations($suppliers);
        $this->seedPurchaseOrders($suppliers);
        $this->seedDeliveries();
        $this->seedReleases();
        $this->seedMovements($items);
        $this->seedStockCounts();
        $this->seedDocuments();
        $this->seedNotifications();
        $this->seedOpportunities();
    }

    private function seedSuppliers(): array
    {
        $rows = [
            ['SUP-001', 'NaviTrack Philippines', 'Engr. Marco Villanueva', '+63 917 555 0192', 'sales@navitrack.ph', 'Unit 1204 Telematics Tower, Ortigas Center, Pasig City', 4.8, 96, 94, 98, 90, 94.5, ['Communication Devices', 'Fleet Telematics'], 'TIN-889-102-441-000', 'CS201948821', 'BDO Unibank #008810294811', 1],
            ['SUP-002', 'TechComms Global Inc.', 'Lina Mendoza', '+63 918 444 8812', 'contact@techcomms.com.ph', 'Building 4, Cyberpark 1, Araneta City, Quezon City', 4.2, 88, 85, 82, 95, 87.5, ['Communication Devices'], 'TIN-442-109-881-000', 'CS201822910', 'BPI #3391-0024-19', 0],
            ['SUP-003', 'OmniTech Solutions', 'Carlos Rivera', '+63 917 000 0000', 'sales@omnitech.ph', 'Makati City', 4.9, 95, 90, 92, 85, 90.5, ['Communication Devices'], 'TIN-000-000-000-000', 'CS202000000', 'BDO #0000', 0],
            ['SUP-004', 'PetroLube Trading', 'Dennis Tan', '+63 920 111 3344', 'orders@petrolube.com.ph', 'Subic Logistics Hub, Bldg B, Subic Bay Freeport Zone', 4.7, 98, 92, 95, 91, 94.0, ['Fleet Consumables', 'Lubricants'], 'TIN-991-002-331-000', 'CS201509182', 'Metrobank #602-7-602998-1', 1],
            ['SUP-005', 'AutoTech Tools Corp', 'Arlene Cruz', '+63 917 882 1044', 'info@autotechtools.ph', '15 Industrial Road, Karuhatan, Valenzuela City', 4.9, 99, 96, 97, 88, 95.0, ['Maintenance Tools', 'Automotive Equipment'], 'TIN-112-887-440-000', 'CS202011928', 'Security Bank #0000-4881-22', 1],
            ['SUP-006', 'PaperCorp Philippines', 'James Ocampo', '+63 922 998 7766', 'corp@papercorp.ph', '22 Printing Press Way, Binondo, Manila', 4.5, 92, 90, 93, 96, 92.7, ['Office Supplies'], 'TIN-301-449-001-000', 'CS201200192', 'UnionBank #1029-4481-9921', 0],
        ];

        $map = [];
        foreach ($rows as $row) {
            $map[$row[0]] = Supplier::query()->create([
                'code' => $row[0],
                'company_name' => $row[1],
                'contact_person' => $row[2],
                'phone' => $row[3],
                'email' => $row[4],
                'address' => $row[5],
                'status' => 'Active',
                'rating' => $row[6],
                'quality_score' => $row[7],
                'responsiveness_score' => $row[8],
                'delivery_performance' => $row[9],
                'pricing_score' => $row[10],
                'overall_score' => $row[11],
                'categories' => $row[12],
                'tax_id' => $row[13],
                'sec_registration' => $row[14],
                'bank_details' => $row[15],
                'active_orders' => $row[16],
            ]);
        }

        return $map;
    }

    private function seedLocations(): array
    {
        $rows = [
            ['Rack A', 'Shelf 01', 'Bin 02', 'Office Supplies', 100],
            ['Rack A', 'Shelf 02', 'Bin 01', 'Office Supplies', 60],
            ['Rack B', 'Shelf 01', 'Bin 04', 'Communication Devices', 30],
            ['Rack B', 'Shelf 02', 'Bin 05', 'Communication Devices', 20],
            ['Rack B', 'Shelf 03', 'Bin 01', 'Communication Devices', 30],
            ['Rack C', 'Shelf 01', 'Bin 01', 'Maintenance Tools', 10],
            ['Rack C', 'Shelf 02', 'Bin 04', 'Maintenance Tools', 10],
            ['Rack C', 'Shelf 03', 'Bin 02', 'Maintenance Tools', 10],
            ['Rack D', 'Shelf 01', 'Bin 03', 'Fleet Consumables', 50],
            ['Rack D', 'Shelf 02', 'Bin 01', 'Fleet Consumables', 50],
        ];

        $map = [];
        foreach ($rows as $row) {
            $location = StorageLocation::query()->create([
                'rack' => $row[0],
                'shelf' => $row[1],
                'bin' => $row[2],
                'category' => $row[3],
                'max_capacity' => $row[4],
            ]);
            $map["{$row[0]} -> {$row[1]} -> {$row[2]}"] = $location;
        }

        return $map;
    }

    private function seedUsers(string $password, array $suppliers): void
    {
        User::query()->create([
            'name' => 'J. Perez',
            'email' => env('SEED_SUPPLY_CHAIN_EMAIL', 'jperez@pureride.test'),
            'password' => Hash::make($password),
            'role' => User::ROLE_SUPPLY_CHAIN,
            'email_verified_at' => now(),
        ]);

        foreach ($suppliers as $supplier) {
            User::query()->create([
                'name' => $supplier->contact_person,
                'email' => $supplier->email,
                'password' => Hash::make($password),
                'role' => User::ROLE_SUPPLIER,
                'supplier_id' => $supplier->id,
                'email_verified_at' => now(),
            ]);
        }
    }

    private function seedInventory(array $suppliers, array $locations): array
    {
        $rows = [
            ['INV-001', 'OFF-001', 'A4 Multipurpose Copy Paper 80gsm (Box of 5 reams)', 'Office Supplies', 45, 20, 'Boxes', 'SUP-006', 1250.00, 'Rack A -> Shelf 01 -> Bin 02', 'N/A', 'N/A', 'New'],
            ['INV-002', 'COM-101', 'Heavy Duty Two-Way Handheld Radio (VHF/UHF)', 'Communication Devices', 6, 10, 'Units', 'SUP-002', 4500.00, 'Rack B -> Shelf 02 -> Bin 05', 'TC-2026-8891', '2027-08-15 (1 Year)', 'New'],
            ['INV-003', 'TL-301', 'Professional OBD2 Fleet Diagnostic Scanner Tool', 'Maintenance Tools', 2, 5, 'Units', 'SUP-005', 18500.00, 'Rack C -> Shelf 01 -> Bin 01', 'OBD-9982-X', '2027-12-31 (2 Years)', 'Good'],
            ['INV-004', 'COM-102', 'TNVS Vehicle GPS Tracking Terminal (4G LTE + Telematics)', 'Communication Devices', 0, 15, 'Units', 'SUP-001', 6200.00, 'Rack B -> Shelf 03 -> Bin 01', 'N/A', '2027-06-30 (1 Year)', 'N/A'],
            ['INV-005', 'TL-302', '3-Ton Hydraulic Floor Jack (Heavy Duty Automotive)', 'Maintenance Tools', 8, 4, 'Units', 'SUP-005', 8200.00, 'Rack C -> Shelf 02 -> Bin 04', 'HJ-5541', '2027-01-20 (1 Year)', 'Good'],
            ['INV-006', 'OFF-002', 'Thermal Receipt Paper Rolls 80mm (Box of 50)', 'Office Supplies', 30, 15, 'Boxes', 'SUP-006', 1800.00, 'Rack A -> Shelf 02 -> Bin 01', 'N/A', 'N/A', 'New'],
            ['INV-007', 'FLT-401', 'Fully Synthetic Engine Oil 5W-30 (4 Liter Canister)', 'Fleet Consumables', 4, 12, 'Canisters', 'SUP-004', 2100.00, 'Rack D -> Shelf 01 -> Bin 03', 'LOT-2026-04', '2028-05-10', 'New'],
            ['INV-008', 'FLT-402', 'Automotive First Aid Response Kit (Standard TNVS Spec)', 'Fleet Consumables', 25, 10, 'Kits', 'SUP-004', 850.00, 'Rack D -> Shelf 02 -> Bin 01', 'N/A', '2027-10-15', 'New'],
            ['INV-009', 'COM-103', 'HD Dual-Camera Fleet Dashcam with Night Vision (128GB)', 'Communication Devices', 14, 10, 'Units', 'SUP-001', 4800.00, 'Rack B -> Shelf 01 -> Bin 04', 'DC-8812-B', '2027-04-01 (1 Year)', 'New'],
            ['INV-010', 'TL-303', 'Portable 2000A Peak Vehicle Battery Jump Starter', 'Maintenance Tools', 1, 5, 'Units', 'SUP-005', 5400.00, 'Rack C -> Shelf 03 -> Bin 02', 'JS-1092', '2027-03-15', 'Fair'],
        ];

        $map = [];
        foreach ($rows as $row) {
            $map[$row[1]] = InventoryItem::query()->create([
                'code' => $row[0],
                'item_code' => $row[1],
                'description' => $row[2],
                'category' => $row[3],
                'quantity' => $row[4],
                'min_stock_level' => $row[5],
                'unit' => $row[6],
                'supplier_id' => $suppliers[$row[7]]->id,
                'cost' => $row[8],
                'storage_location_id' => $locations[$row[9]]->id ?? null,
                'serial_number' => $row[10],
                'warranty' => $row[11],
                'condition' => $row[12],
            ]);
        }

        return $map;
    }

    private function seedSupplyRequests(array $items): void
    {
        $requests = [
            ['REQ-2026-081', 'Fleet Operations', 'COM-102', 15, '2026-08-15', 'HIGH', 'Insufficient Stock', 'For Procurement', 'Capt. Mark Santos (Fleet Supervisor)', 'Restocking trackers for newly onboarded TNVS fleet vehicles.', '2026-08-06', [
                ['2026-08-06 09:30', 'Approved request received from Department Subsystem.'],
                ['2026-08-06 10:15', 'Stock verification conducted: Current Stock = 0. Insufficient stock.'],
                ['2026-08-06 10:20', 'Automated Procurement Request generated: PR-2026-042.'],
            ]],
            ['REQ-2026-082', 'Dispatch & Safety', 'COM-101', 4, '2026-08-12', 'MEDIUM', 'Stock Available', 'Ready for Release', 'Elena Rostova (Dispatch Manager)', 'Dispatch team field communication upgrade.', '2026-08-07', [
                ['2026-08-07 08:45', 'Approved request received from Department Subsystem.'],
                ['2026-08-07 09:00', 'Stock verification conducted: Current Stock = 6. Stock Available.'],
                ['2026-08-07 09:05', 'Reserved 4 units. Status changed to Ready for Release.'],
            ]],
            ['REQ-2026-083', 'Administration', 'OFF-001', 10, '2026-08-10', 'LOW', 'Stock Available', 'Released', 'Sarah Jenkins (Admin Assistant)', 'Quarterly admin paper supply replenishment.', '2026-08-05', [
                ['2026-08-05 11:00', 'Approved request received from Department Subsystem.'],
                ['2026-08-05 11:30', 'Stock verified and approved.'],
                ['2026-08-05 14:20', '10 Boxes released to Admin rep (Receipt # REL-9912).'],
            ]],
            ['REQ-2026-084', 'Maintenance & Workshop', 'FLT-401', 20, '2026-08-18', 'URGENT', 'Insufficient Stock', 'For Procurement', 'Engr. Ramon Garcia (Chief Mechanic)', 'Routine 10,000km PMS maintenance for 20 active TNVS sedans.', '2026-08-07', [
                ['2026-08-07 11:10', 'Approved request received from Department Subsystem.'],
                ['2026-08-07 11:40', 'Stock check: 4 canisters in stock, 20 needed. Insufficient.'],
                ['2026-08-07 11:45', 'Procurement process initiated (PR-2026-045).'],
            ]],
        ];

        foreach ($requests as $row) {
            $item = $items[$row[2]];
            $request = SupplyRequest::query()->create([
                'request_number' => $row[0],
                'requesting_department' => $row[1],
                'inventory_item_id' => $item->id,
                'item_code' => $item->item_code,
                'item_name' => $item->description,
                'category' => $item->category,
                'quantity_requested' => $row[3],
                'required_date' => $row[4],
                'priority' => $row[5],
                'stock_availability' => $row[6],
                'status' => $row[7],
                'requested_by' => $row[8],
                'purpose' => $row[9],
                'date_received' => $row[10],
            ]);
            foreach ($row[11] as $log) {
                $request->logs()->create(['logged_at' => $log[0], 'note' => $log[1]]);
            }
        }
    }

    private function seedProcurement(): void
    {
        $rows = [
            ['PR-2026-042', 'REQ-2026-081', 'REQ-2026-081', 'Fleet Operations', 'COM-102', 'TNVS Vehicle GPS Tracking Terminal (4G LTE + Telematics)', 20, 'Zero current stock; 15 units requested by Fleet + 5 buffer stock.', 'HIGH', 'Quotation Comparison', '2026-08-06', 124000.00, null, 'PO-2026-104'],
            ['PR-2026-045', 'REQ-2026-084', 'REQ-2026-084', 'Maintenance & Workshop', 'FLT-401', 'Fully Synthetic Engine Oil 5W-30 (4 Liter Canister)', 25, 'Low stock alert (4 remaining, min 12). PMS cycle approaching.', 'URGENT', 'Pending Finance Approval', '2026-08-07', 52500.00, 'PetroLube Trading', 'PO-2026-105'],
            ['PR-2026-039', 'MANUAL-RESTOCK', null, 'Supply Chain & Warehouse', 'TL-301', 'Professional OBD2 Fleet Diagnostic Scanner Tool', 5, 'Restocking diagnostic tools due to low inventory level.', 'MEDIUM', 'Finance Approved', '2026-08-02', 92500.00, 'AutoTech Tools Corp', 'PO-2026-101'],
            ['PR-2026-030', 'MANUAL-RESTOCK', null, 'Administration', 'OFF-001', 'A4 Multipurpose Copy Paper 80gsm', 50, 'Quarterly Office Supply Bulk Order', 'LOW', 'Completed', '2026-07-25', 62500.00, 'PaperCorp Philippines', 'PO-2026-098'],
        ];

        foreach ($rows as $row) {
            ProcurementRequest::query()->create([
                'pr_number' => $row[0],
                'source_request' => $row[1],
                'supply_request_id' => $row[2] ? SupplyRequest::query()->where('request_number', $row[2])->value('id') : null,
                'department' => $row[3],
                'item_code' => $row[4],
                'item_name' => $row[5],
                'quantity' => $row[6],
                'reason' => $row[7],
                'priority' => $row[8],
                'status' => $row[9],
                'date_created' => $row[10],
                'estimated_cost' => $row[11],
                'selected_supplier' => $row[12],
                'po_number' => $row[13],
            ]);
        }
    }

    private function seedQuotations(array $suppliers): void
    {
        $rows = [
            ['QT-2026-001', 'PR-2026-042', 'SUP-001', 'TNVS Vehicle GPS Tracking Terminal (4G LTE)', 20, 6200.00, 124000.00, '1 Year Replacement Warranty', 5, 4.8, '30 Days Net', 'Submitted', 'Includes free SIM cards and 6 months telematics subscription.'],
            ['QT-2026-002', 'PR-2026-042', 'SUP-002', 'TNVS Vehicle GPS Tracking Terminal (4G LTE)', 20, 5950.00, 119000.00, '6 Months Limited Warranty', 8, 4.2, '15 Days Net', 'Submitted', 'Lower unit price but shorter warranty and longer lead time.'],
            ['QT-2026-003', 'PR-2026-042', 'SUP-003', 'TNVS Vehicle GPS Tracking Terminal (4G LTE)', 20, 6500.00, 130000.00, '2 Years Full Warranty', 3, 4.9, '30 Days Net', 'Submitted', 'Premium tier tracker with OBD pass-through.'],
            ['QT-2026-010', 'PR-2026-045', 'SUP-004', 'Fully Synthetic Engine Oil 5W-30 (4L)', 25, 2100.00, 52500.00, 'Manufacturer Guarantee', 2, 4.7, '30 Days Net', 'Selected', 'Official distributor price discount applied.'],
        ];

        foreach ($rows as $row) {
            $supplier = $suppliers[$row[2]];
            $pr = ProcurementRequest::query()->where('pr_number', $row[1])->first();
            Quotation::query()->create([
                'quote_number' => $row[0],
                'procurement_request_id' => $pr->id,
                'supplier_id' => $supplier->id,
                'supplier_name' => $supplier->company_name,
                'item' => $row[3],
                'quantity' => $row[4],
                'unit_price' => $row[5],
                'total_price' => $row[6],
                'warranty' => $row[7],
                'delivery_time_days' => $row[8],
                'quality_rating' => $row[9],
                'payment_terms' => $row[10],
                'status' => $row[11],
                'notes' => $row[12],
            ]);
        }
    }

    private function seedPurchaseOrders(array $suppliers): void
    {
        $this->createPurchaseOrder($suppliers['SUP-004'], [
            'po_number' => 'PO-2026-105',
            'pr' => 'PR-2026-045',
            'contact' => 'Dennis Tan (Sales Director)',
            'items' => [['FLT-401', 'Fully Synthetic Engine Oil 5W-30 (4 Liter Canister)', 25, 2100.00, 52500.00, 0]],
            'total' => 52500.00,
            'budget' => 'BUD-2026-FLT-08',
            'terms' => '30 Days Net',
            'reason' => 'PMS Maintenance Oil Restocking for 20 TNVS Sedans',
            'delivery' => '2026-08-14',
            'warranty' => 'Manufacturer Sealed Guarantee',
            'finance' => 'Pending Finance Approval',
            'status' => 'Pending Finance Approval',
            'created' => '2026-08-07',
            'approver' => 'Finance Department',
            'remarks' => '',
            'timeline' => [
                ['Procurement Completed', '2026-08-07 11:45', 'completed'],
                ['Supplier Selected', '2026-08-07 13:00', 'completed'],
                ['PO Created', '2026-08-07 14:15', 'completed'],
                ['Finance Approval Checkpoint', '2026-08-07 14:20', 'in_progress'],
                ['Sent to Supplier', '—', 'pending'],
                ['Supplier Confirmation', '—', 'pending'],
                ['Delivery & Inspection', '—', 'pending'],
                ['Inventory Updated', '—', 'pending'],
            ],
        ]);

        $this->createPurchaseOrder($suppliers['SUP-005'], [
            'po_number' => 'PO-2026-101',
            'pr' => 'PR-2026-039',
            'contact' => 'Arlene Cruz (Account Manager)',
            'items' => [['TL-301', 'Professional OBD2 Fleet Diagnostic Scanner Tool', 5, 18500.00, 92500.00, 3]],
            'total' => 92500.00,
            'budget' => 'BUD-2026-MAINT-04',
            'terms' => '15 Days Net',
            'reason' => 'Workshop Diagnostic Equipment Expansion',
            'delivery' => '2026-08-10',
            'warranty' => '2 Years Full Warranty',
            'finance' => 'Finance Approved',
            'status' => 'Partially Delivered',
            'created' => '2026-08-02',
            'approver' => 'Atty. VP Finance (Finance Subsystem)',
            'remarks' => 'Approved under Capex budget allocation line #402.',
            'timeline' => [
                ['Procurement Completed', '2026-08-02 09:00', 'completed'],
                ['Supplier Selected', '2026-08-02 10:30', 'completed'],
                ['PO Created', '2026-08-02 11:00', 'completed'],
                ['Finance Approval Checkpoint', '2026-08-02 15:45', 'completed'],
                ['Sent to Supplier', '2026-08-02 16:00', 'completed'],
                ['Supplier Confirmation', '2026-08-03 08:30', 'completed'],
                ['Delivery & Inspection', '2026-08-06 14:00 (Partial: 3/5)', 'in_progress'],
                ['Inventory Updated', '2026-08-06 15:00', 'in_progress'],
            ],
        ]);

        $this->createPurchaseOrder($suppliers['SUP-006'], [
            'po_number' => 'PO-2026-098',
            'pr' => 'PR-2026-030',
            'contact' => 'James Ocampo',
            'items' => [['OFF-001', 'A4 Multipurpose Copy Paper 80gsm', 50, 1250.00, 62500.00, 50]],
            'total' => 62500.00,
            'budget' => 'BUD-2026-ADM-01',
            'terms' => '30 Days Net',
            'reason' => 'Quarterly Office Supply Bulk Order',
            'delivery' => '2026-08-01',
            'warranty' => 'N/A',
            'finance' => 'Finance Approved',
            'status' => 'Fully Delivered',
            'created' => '2026-07-25',
            'approver' => 'Finance Subsystem',
            'remarks' => 'Approved regular operational expenditure.',
            'timeline' => [
                ['Procurement Completed', '2026-07-25', 'completed'],
                ['Supplier Selected', '2026-07-25', 'completed'],
                ['PO Created', '2026-07-25', 'completed'],
                ['Finance Approval Checkpoint', '2026-07-26', 'completed'],
                ['Sent to Supplier', '2026-07-26', 'completed'],
                ['Supplier Confirmation', '2026-07-27', 'completed'],
                ['Delivery & Inspection', '2026-08-01', 'completed'],
                ['Inventory Updated', '2026-08-01', 'completed'],
            ],
        ]);
    }

    private function createPurchaseOrder(Supplier $supplier, array $data): void
    {
        $pr = ProcurementRequest::query()->where('pr_number', $data['pr'])->first();
        $po = PurchaseOrder::query()->create([
            'po_number' => $data['po_number'],
            'procurement_request_id' => $pr?->id,
            'supplier_id' => $supplier->id,
            'supplier' => $supplier->company_name,
            'contact_person' => $data['contact'],
            'total_cost' => $data['total'],
            'budget_reference' => $data['budget'],
            'payment_terms' => $data['terms'],
            'procurement_reason' => $data['reason'],
            'delivery_date' => $data['delivery'],
            'warranty' => $data['warranty'],
            'finance_approval_status' => $data['finance'],
            'po_status' => $data['status'],
            'created_date' => $data['created'],
            'approver' => $data['approver'],
            'finance_remarks' => $data['remarks'],
        ]);

        foreach ($data['items'] as $item) {
            $po->items()->create([
                'item_code' => $item[0],
                'description' => $item[1],
                'quantity' => $item[2],
                'unit_price' => $item[3],
                'total' => $item[4],
                'delivered_qty' => $item[5],
            ]);
        }

        foreach ($data['timeline'] as $index => $step) {
            $po->timeline()->create([
                'sort_order' => $index + 1,
                'step' => $step[0],
                'step_date' => $step[1],
                'status' => $step[2],
            ]);
        }
    }

    private function seedDeliveries(): void
    {
        $rows = [
            ['DEL-2026-051', 'PO-2026-101', '2026-08-06', 1, 'Partially Accepted', 'Lalamove Heavy Fleet', 'TRK-90182', 'Partial', 'Received 3 units out of 5 ordered. 2 units pending backorder delivery.', [
                ['TL-301', 'Professional OBD2 Fleet Diagnostic Scanner Tool', 5, 3, 'Good', 'Passed', 'Tested and verified.'],
            ]],
            ['DEL-2026-048', 'PO-2026-098', '2026-08-01', 1, 'Accepted', 'In-house Delivery', 'TRK-77182', 'Passed', '50 boxes of paper delivered in mint condition.', [
                ['OFF-001', 'A4 Multipurpose Copy Paper 80gsm', 50, 50, 'New', 'Passed', 'All boxes sealed.'],
            ]],
            ['DEL-2026-055', 'PO-2026-105', '2026-08-14 (Scheduled)', 1, 'Expected', 'PetroLube Logistics', 'PL-LOG-4491', 'Pending', 'Awaiting Finance Approval and Supplier dispatch.', [
                ['FLT-401', 'Fully Synthetic Engine Oil 5W-30 (4 Liter Canister)', 25, 0, 'Pending', 'Pending', 'Expected arrival on Aug 14.'],
            ]],
        ];

        foreach ($rows as $row) {
            $po = PurchaseOrder::query()->where('po_number', $row[1])->first();
            $delivery = Delivery::query()->create([
                'delivery_number' => $row[0],
                'purchase_order_id' => $po?->id,
                'po_number' => $row[1],
                'supplier' => $po?->supplier,
                'delivery_date' => $row[2],
                'items_count' => $row[3],
                'status' => $row[4],
                'carrier' => $row[5],
                'tracking_number' => $row[6],
                'inspection_result' => $row[7],
                'inspection_notes' => $row[8],
            ]);
            foreach ($row[9] as $item) {
                $delivery->items()->create([
                    'item_code' => $item[0],
                    'description' => $item[1],
                    'po_quantity' => $item[2],
                    'delivered_quantity' => $item[3],
                    'condition' => $item[4],
                    'result' => $item[5],
                    'remarks' => $item[6],
                ]);
            }
        }
    }

    private function seedReleases(): void
    {
        $rows = [
            ['REL-2026-091', 'REQ-2026-083', 'Administration', 'OFF-001', 'A4 Multipurpose Copy Paper 80gsm', 10, 'Approved by Dept & Stock Verified', 'Deducted from Inventory', '2026-08-05 14:20', 'Sarah Jenkins (Admin Assistant)', 'Warehouse Custodian J. Perez'],
            ['REL-2026-092', 'REQ-2026-082', 'Dispatch & Safety', 'COM-101', 'Heavy Duty Two-Way Handheld Radio', 4, 'Approved by Dept & Stock Verified', 'Reserved - Ready for Pickup', 'Pending Pickup', 'Elena Rostova (Dispatch Manager)', 'Warehouse Custodian J. Perez'],
        ];

        foreach ($rows as $row) {
            Release::query()->create([
                'release_number' => $row[0],
                'supply_request_id' => SupplyRequest::query()->where('request_number', $row[1])->value('id'),
                'request_id' => $row[1],
                'requesting_department' => $row[2],
                'item_code' => $row[3],
                'item_name' => $row[4],
                'quantity_released' => $row[5],
                'approval_status' => $row[6],
                'stock_status' => $row[7],
                'release_date' => $row[8],
                'released_to' => $row[9],
                'dispatched_by' => $row[10],
            ]);
        }
    }

    private function seedMovements(array $items): void
    {
        $rows = [
            ['MOV-2026-110', 'TL-301', 'Receiving', 3, '2026-08-06 14:15', 'Rack C -> Shelf 01 -> Bin 01', 'DEL-2026-051 / PO-2026-101', 'Partial delivery received from AutoTech Tools.', 'Warehouse Inspector R. Cruz'],
            ['MOV-2026-109', 'OFF-001', 'Releasing', 10, '2026-08-05 14:20', 'Rack A -> Shelf 01 -> Bin 02', 'REL-2026-091 / REQ-2026-083', 'Issued 10 boxes to Admin department.', 'Warehouse Custodian J. Perez'],
            ['MOV-2026-108', 'FLT-401', 'Damaged', 1, '2026-08-04 10:00', 'Rack D -> Shelf 01 -> Bin 03', 'INC-2026-004', 'Canister seal ruptured during pallet handling.', 'Quality Inspector M. Reyes'],
            ['MOV-2026-107', 'OFF-001', 'Receiving', 50, '2026-08-01 09:30', 'Rack A -> Shelf 01 -> Bin 02', 'DEL-2026-048 / PO-2026-098', 'Bulk delivery received from PaperCorp.', 'Warehouse Custodian J. Perez'],
        ];

        foreach ($rows as $row) {
            $item = $items[$row[1]];
            InventoryMovement::query()->create([
                'movement_number' => $row[0],
                'inventory_item_id' => $item->id,
                'item_code' => $item->item_code,
                'item_name' => $item->description,
                'movement_type' => $row[2],
                'quantity' => $row[3],
                'moved_at' => $row[4],
                'location' => $row[5],
                'reference' => $row[6],
                'remarks' => $row[7],
                'recorded_by' => $row[8],
            ]);
        }
    }

    private function seedStockCounts(): void
    {
        $q3 = StockCount::query()->create([
            'count_number' => 'SC-2026-Q3',
            'title' => 'Q3 2026 Comprehensive Fleet & Office Inventory Audit',
            'count_date' => '2026-08-01',
            'location' => 'Main Warehouse - Pasig Depot',
            'status' => 'Completed',
            'total_items_audited' => 8,
            'discrepancy_count' => 1,
        ]);
        foreach ([
            ['OFF-001', 'A4 Copy Paper', 55, 55, 0, 'Matches system.'],
            ['COM-101', 'Handheld Radio', 6, 6, 0, 'Matches system.'],
            ['TL-302', '3-Ton Floor Jack', 8, 8, 0, 'Good condition.'],
            ['FLT-401', 'Synthetic Oil 5W-30', 5, 4, -1, '1 damaged canister removed from shelf.'],
        ] as $item) {
            $q3->items()->create([
                'item_code' => $item[0], 'item_name' => $item[1], 'system_qty' => $item[2],
                'actual_qty' => $item[3], 'variance' => $item[4], 'notes' => $item[5],
            ]);
        }

        $aug = StockCount::query()->create([
            'count_number' => 'SC-2026-AUG',
            'title' => 'August 2026 Communications Equipment Audit',
            'count_date' => '2026-08-07',
            'location' => 'Electronics Storage - Bay B',
            'status' => 'In Progress',
            'total_items_audited' => 3,
            'discrepancy_count' => 0,
        ]);
        foreach ([
            ['COM-101', 'Handheld Radio', 6, 6, 0, 'Verified'],
            ['COM-102', 'GPS Terminal', 0, 0, 0, 'Verified out of stock'],
            ['COM-103', 'Fleet Dashcam', 14, 14, 0, 'Verified'],
        ] as $item) {
            $aug->items()->create([
                'item_code' => $item[0], 'item_name' => $item[1], 'system_qty' => $item[2],
                'actual_qty' => $item[3], 'variance' => $item[4], 'notes' => $item[5],
            ]);
        }
    }

    private function seedDocuments(): void
    {
        $rows = [
            ['DOC-2026-881', 'GPS Terminal 1-Year Master Warranty Certificate', 'Warranty', 'WAR-NT-2026-01', 'NaviTrack Philippines', '2026-01-15', '2027-01-15', 'Active', 'Communication Equipment', '2.4 MB'],
            ['DOC-2026-882', 'Warehouse Fleet Liability Insurance Policy 2026', 'Insurance', 'INS-POL-88291', 'Malayan Insurance Co.', '2025-08-20', '2026-08-20', 'Expiring Soon', 'Logistics & Risk', '4.1 MB'],
            ['DOC-2026-883', 'AutoTech Diagnostic Tools Master Service Contract', 'Contract', 'CTR-AT-2024-99', 'AutoTech Tools Corp', '2024-08-10', '2026-08-10', 'Expiring Soon', 'Maintenance', '1.8 MB'],
            ['DOC-2026-884', 'PaperCorp 2025 Wholesale Supply Agreement', 'Contract', 'CTR-PC-2025-01', 'PaperCorp Philippines', '2025-01-01', '2026-01-01', 'Expired', 'Office Supplies', '3.2 MB'],
            ['DOC-2026-885', 'Purchase Order PO-2026-105 Signed Copy', 'Purchase Order', 'PO-2026-105', 'PetroLube Trading', '2026-08-07', '2026-12-31', 'Active', 'Procurement', '1.1 MB'],
        ];

        foreach ($rows as $row) {
            Document::query()->create([
                'document_number' => $row[0],
                'title' => $row[1],
                'type' => $row[2],
                'reference_number' => $row[3],
                'supplier' => $row[4],
                'issue_date' => $row[5],
                'expiration_date' => $row[6],
                'status' => $row[7],
                'category' => $row[8],
                'file_size' => $row[9],
            ]);
        }
    }

    private function seedNotifications(): void
    {
        $rows = [
            ['NOTIF-001', 'Out of Stock Alert', 'TNVS Vehicle GPS Tracking Terminal (COM-102) is currently OUT OF STOCK. Procurement request PR-2026-042 generated.', '2026-08-07 10:20', 'stock', 'danger', false],
            ['NOTIF-002', 'Finance Approval Required', 'Purchase Order PO-2026-105 for PetroLube Trading (₱52,500.00) requires Finance Subsystem approval.', '2026-08-07 14:20', 'finance', 'warning', false],
            ['NOTIF-003', 'Partial Delivery Received', 'PO-2026-101 received 3 of 5 units from AutoTech Tools Corp. Inspection status: Partial.', '2026-08-06 14:15', 'delivery', 'info', true],
            ['NOTIF-004', 'Document Expiring Soon', 'Warehouse Fleet Liability Insurance Policy 2026 expires in 12 days (2026-08-20).', '2026-08-05 08:00', 'document', 'warning', false],
            ['NOTIF-005', 'New Quotations Submitted', '3 vendors submitted quotations for PR-2026-042 (GPS Terminals). Ready for evaluation.', '2026-08-06 16:30', 'procurement', 'success', false],
        ];

        foreach ($rows as $row) {
            AppNotification::query()->create([
                'notification_number' => $row[0],
                'title' => $row[1],
                'message' => $row[2],
                'logged_at' => $row[3],
                'type' => $row[4],
                'severity' => $row[5],
                'is_read' => $row[6],
            ]);
        }
    }

    private function seedOpportunities(): void
    {
        $rows = [
            ['OPP-2026-012', 'PR-2026-042', 'Supply of 20 Units TNVS Vehicle GPS Tracking Terminals (4G LTE)', 'Communication Devices', 20, '2026-08-12', '₱115,000 - ₱135,000', 'Open for Quotation', 'Must include SIM cards, telematics software API, and min 1-year replacement warranty.'],
            ['OPP-2026-015', 'PR-2026-048', 'Supply of 50 Automotive First Aid Response Kits', 'Fleet Consumables', 50, '2026-08-20', '₱40,000 - ₱45,000', 'Open for Quotation', 'Standard LTO/TNVS compliance emergency kit contents.'],
        ];

        foreach ($rows as $row) {
            $suppliers = Supplier::query()
                ->get()
                ->filter(fn (Supplier $supplier) => in_array($row[3], $supplier->categories ?? [], true))
                ->values();

            foreach ($suppliers as $index => $supplier) {
                SupplierOpportunity::query()->create([
                    'opportunity_number' => $index === 0 ? $row[0] : DocumentCode::next('supplier_opportunities', 'opportunity_number', 'OPP'),
                    'pr_number' => $row[1],
                    'procurement_request_id' => ProcurementRequest::query()->where('pr_number', $row[1])->value('id'),
                    'supplier_id' => $supplier->id,
                    'title' => $row[2],
                    'category' => $row[3],
                    'quantity' => $row[4],
                    'deadline' => $row[5],
                    'budget_range' => $row[6],
                    'status' => $row[7],
                    'requirements' => $row[8],
                ]);
            }
        }
    }
}
