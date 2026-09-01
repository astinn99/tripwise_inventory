<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Document;
use App\Models\InventoryItem;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\Quotation;
use App\Models\StorageLocation;
use App\Models\Supplier;
use App\Models\SupplierOpportunity;
use App\Models\SupplyRequest;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\DocumentCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SupplyChainApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_index_returns_items(): void
    {
        $user = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-100',
            'company_name' => 'Test Supplier',
            'contact_person' => 'Pat Lee',
            'status' => 'Active',
            'categories' => ['Office Supplies'],
        ]);
        $location = StorageLocation::query()->create([
            'rack' => 'Rack A',
            'shelf' => 'Shelf 01',
            'bin' => 'Bin 01',
            'category' => 'Office Supplies',
            'max_capacity' => 50,
        ]);
        InventoryItem::query()->create([
            'code' => 'INV-100',
            'item_code' => 'OFF-100',
            'description' => 'Copy Paper',
            'category' => 'Office Supplies',
            'quantity' => 20,
            'min_stock_level' => 5,
            'unit' => 'Boxes',
            'supplier_id' => $supplier->id,
            'cost' => 100,
            'storage_location_id' => $location->id,
        ]);

        $this->actingAs($user)
            ->getJson('/api/inventory-items')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.itemCode', 'OFF-100')
            ->assertJsonPath('data.0.imageUrl', null);
    }

    public function test_bootstrap_returns_internal_collections_in_one_request(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'inventory',
                    'supplyRequests',
                    'notifications',
                    'movementTrend',
                    'lowStockTrend',
                ],
            ]);
    }

    public function test_bootstrap_core_does_not_n_plus_one_documents_and_purchase_orders(): void
    {
        $user = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-BOOT',
            'company_name' => 'Bootstrap Supplier',
            'contact_person' => 'Pat Lee',
            'status' => 'Active',
            'categories' => ['Office Supplies'],
        ]);

        foreach (range(1, 8) as $i) {
            Document::query()->create([
                'document_number' => 'DOC-BOOT-'.$i,
                'title' => 'Policy '.$i,
                'type' => 'Insurance',
                'expiration_date' => now()->addDays(40)->toDateString(),
                'status' => 'Active',
                'supplier_id' => $supplier->id,
            ]);
            PurchaseOrder::query()->create([
                'po_number' => 'PO-BOOT-'.$i,
                'supplier_id' => $supplier->id,
                'supplier' => 'Bootstrap Supplier',
                'total_cost' => 1000,
                'finance_approval_status' => 'Pending Finance Approval',
                'po_status' => 'Pending Finance Approval',
                'created_date' => now()->toDateString(),
            ]);
        }

        DB::enableQueryLog();

        $this->actingAs($user)
            ->getJson('/api/bootstrap')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertLessThan(
            40,
            count(DB::getQueryLog()),
            'Bootstrap core should not lazy-load document or purchase order relations.'
        );
    }

    public function test_bootstrap_more_returns_deferred_collections(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/bootstrap?phase=more')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'storageLocations',
                    'releases',
                    'movements',
                    'stockCounts',
                ],
            ]);
    }

    public function test_live_sync_returns_stamp_until_data_changes(): void
    {
        $user = User::factory()->create();

        $stamp = $this->actingAs($user)
            ->getJson('/api/live')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => ['stamp'],
            ])
            ->json('data.stamp');

        $this->assertNotEmpty($stamp);
        $this->assertArrayNotHasKey('quotations', $this->actingAs($user)->getJson('/api/live')->json('data'));

        $this->actingAs($user)
            ->getJson('/api/live?stamp=stale')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'stamp',
                    'stamps',
                    'quotations',
                    'notifications',
                    'procurementRequests',
                    'inventory',
                    'deliveries',
                    'movements',
                    'supplyRequests',
                    'releases',
                ],
            ]);
    }

    public function test_check_stock_marks_request_ready_when_stock_is_available(): void
    {
        $user = User::factory()->create();
        $item = InventoryItem::query()->create([
            'code' => 'INV-200',
            'item_code' => 'COM-200',
            'description' => 'Radio',
            'category' => 'Communication Devices',
            'quantity' => 10,
            'min_stock_level' => 2,
            'unit' => 'Units',
            'cost' => 1000,
        ]);
        $request = SupplyRequest::query()->create([
            'request_number' => 'REQ-2026-200',
            'requesting_department' => 'Dispatch',
            'inventory_item_id' => $item->id,
            'item_code' => $item->item_code,
            'item_name' => $item->description,
            'category' => $item->category,
            'quantity_requested' => 4,
            'priority' => 'MEDIUM',
            'status' => 'Pending',
            'requested_by' => 'Elena Rostova',
        ]);

        $this->actingAs($user)
            ->postJson("/api/supply-requests/{$request->request_number}/check-stock")
            ->assertOk()
            ->assertJsonPath('data.status', 'Ready for Release');
    }

    public function test_release_deducts_stock_once_and_is_idempotent(): void
    {
        $user = User::factory()->create(['name' => 'J. Perez']);
        $item = InventoryItem::query()->create([
            'code' => 'INV-205',
            'item_code' => 'COM-205',
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 20,
            'min_stock_level' => 2,
            'unit' => 'Units',
            'cost' => 1000,
        ]);
        $request = SupplyRequest::query()->create([
            'request_number' => 'REQ-2026-205',
            'requesting_department' => 'Maintenance & Workshop',
            'inventory_item_id' => $item->id,
            'item_code' => $item->item_code,
            'item_name' => $item->description,
            'category' => $item->category,
            'quantity_requested' => 5,
            'priority' => 'MEDIUM',
            'status' => 'Ready for Release',
            'requested_by' => 'Engr. J. Perez',
        ]);

        $first = $this->actingAs($user)
            ->postJson("/api/supply-requests/{$request->request_number}/release", [
                'releasedTo' => 'Engr. J. Perez',
            ])
            ->assertOk()
            ->assertJsonPath('data.requestId', 'REQ-2026-205')
            ->assertJsonPath('data.updatedSupplyRequest.status', 'Released')
            ->assertJsonPath('data.updatedInventory.0.quantity', 15)
            ->assertJsonPath('data.createdMovements.0.movementType', 'Releasing')
            ->assertJsonPath('data.createdMovements.0.quantity', 5);

        $releaseId = $first->json('data.id');

        $this->actingAs($user)
            ->postJson("/api/supply-requests/{$request->request_number}/release", [
                'releasedTo' => 'Engr. J. Perez',
            ])
            ->assertOk()
            ->assertJsonPath('data.id', $releaseId)
            ->assertJsonPath('data.updatedSupplyRequest.status', 'Released')
            ->assertJsonPath('data.updatedInventory.0.quantity', 15);

        $this->assertSame(15, $item->fresh()->quantity);
        $this->assertSame('Released', $request->fresh()->status);
        $this->assertDatabaseCount('releases', 1);
        $this->assertDatabaseCount('inventory_movements', 1);
    }

    public function test_supply_request_index_handles_pending_manual_rows(): void
    {
        $user = User::factory()->create();
        SupplyRequest::query()->create([
            'request_number' => 'REQ-2026-201',
            'requesting_department' => 'Fleet Operations',
            'item_code' => 'COM-201',
            'item_name' => 'Dashcam',
            'quantity_requested' => 2,
            'stock_availability' => null,
            'status' => 'Pending',
        ]);

        $this->actingAs($user)
            ->getJson('/api/supply-requests')
            ->assertOk()
            ->assertJsonPath('data.0.id', 'REQ-2026-201')
            ->assertJsonPath('data.0.stockAvailability', 'Pending')
            ->assertJsonPath('data.0.status', 'Pending');
    }

    public function test_item_create_validates_required_fields(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/inventory-items', [])
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_inventory_item_can_store_replace_and_remove_photo(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $fields = [
            'description' => 'Handheld Radio',
            'category' => 'Communication Devices',
            'quantity' => 8,
            'minStockLevel' => 3,
            'unit' => 'Units',
            'cost' => 500,
        ];

        $created = $this->actingAs($user)
            ->post('/api/inventory-items', [
                ...$fields,
                'image' => UploadedFile::fake()->image('radio.jpg', 80, 80),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('success', true);

        $itemId = $created->json('data.id');
        $imageUrl = $created->json('data.imageUrl');
        $this->assertIsString($imageUrl);
        $this->assertStringContainsString('/storage/inventory-items/', $imageUrl);

        $item = InventoryItem::query()->where('code', $itemId)->first();
        $this->assertNotNull($item?->image_path);
        Storage::disk('public')->assertExists($item->image_path);
        $originalPath = $item->image_path;

        $this->actingAs($user)
            ->post("/api/inventory-items/{$itemId}", [
                ...$fields,
                'image' => UploadedFile::fake()->image('radio.png', 80, 80),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('success', true);

        $replaced = $item->fresh();
        $this->assertNotSame($originalPath, $replaced->image_path);
        Storage::disk('public')->assertMissing($originalPath);
        Storage::disk('public')->assertExists($replaced->image_path);

        $this->actingAs($user)
            ->post("/api/inventory-items/{$itemId}", [
                ...$fields,
                'removeImage' => '1',
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.imageUrl', null);

        Storage::disk('public')->assertMissing($replaced->image_path);
        $this->assertNull($item->fresh()->image_path);
    }

    public function test_inventory_item_rejects_non_image_uploads(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post('/api/inventory-items', [
                'description' => 'Handheld Radio',
                'category' => 'Communication Devices',
                'quantity' => 8,
                'minStockLevel' => 3,
                'unit' => 'Units',
                'cost' => 500,
                'image' => UploadedFile::fake()->create('notes.pdf', 20, 'application/pdf'),
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_supplier_cannot_access_internal_inventory(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_SUPPLIER]);

        $this->actingAs($user)
            ->getJson('/api/inventory-items')
            ->assertForbidden();
    }

    public function test_supplier_only_sees_own_opportunities(): void
    {
        $ours = Supplier::query()->create([
            'code' => 'SUP-200',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Fleet Consumables'],
        ]);
        $theirs = Supplier::query()->create([
            'code' => 'SUP-201',
            'company_name' => 'NaviTrack Philippines',
            'contact_person' => 'Marco Villanueva',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);

        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $ours->id,
        ]);

        SupplierOpportunity::query()->create([
            'opportunity_number' => 'OPP-2026-200',
            'pr_number' => 'PR-2026-200',
            'supplier_id' => $ours->id,
            'title' => 'Our RFQ',
            'category' => 'Fleet Consumables',
            'quantity' => 10,
            'status' => 'Open for Quotation',
        ]);
        SupplierOpportunity::query()->create([
            'opportunity_number' => 'OPP-2026-201',
            'pr_number' => 'PR-2026-201',
            'supplier_id' => $theirs->id,
            'title' => 'Other vendor RFQ',
            'category' => 'Communication Devices',
            'quantity' => 20,
            'status' => 'Open for Quotation',
        ]);

        $this->actingAs($vendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', 'OPP-2026-200');
    }

    public function test_manual_procurement_is_sent_to_every_active_vendor(): void
    {
        $staff = User::factory()->create();
        $officeSupplier = Supplier::query()->create([
            'code' => 'SUP-210',
            'company_name' => 'PaperCorp Philippines',
            'contact_person' => 'James Ocampo',
            'status' => 'Active',
            'categories' => ['Office Supplies'],
        ]);
        $commsSupplier = Supplier::query()->create([
            'code' => 'SUP-211',
            'company_name' => 'TechComms Global Inc.',
            'contact_person' => 'Lina Mendoza',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        $officeVendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $officeSupplier->id,
        ]);
        $commsVendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $commsSupplier->id,
        ]);

        InventoryItem::query()->create([
            'code' => 'INV-210',
            'item_code' => 'COM-210',
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 2,
            'min_stock_level' => 5,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-210',
                'quantity' => 10,
                'reason' => 'Restock handheld radios',
                'priority' => 'HIGH',
            ])
            ->assertCreated()
            ->assertJsonPath('data.itemCode', 'COM-210')
            ->assertJsonPath('data.vendorInviteCount', 0)
            ->assertJsonPath('data.status', 'For Procurement')
            ->assertJsonPath('data.canEdit', true)
            ->json('data.id');

        $this->actingAs($officeVendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk()
            ->assertJsonPath('data.vendorInviteCount', 2)
            ->assertJsonPath('data.canEdit', false);

        $this->actingAs($officeVendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.itemCode', 'COM-210')
            ->assertJsonPath('data.0.itemName', 'toktok');

        $this->actingAs($commsVendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.itemName', 'toktok');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk()
            ->assertJsonPath('data.vendorInviteCount', 2);
    }

    public function test_notification_numbers_skip_existing_sequential_and_hex_ids(): void
    {
        AppNotification::query()->create([
            'notification_number' => 'NOTIF-027',
            'title' => 'Existing sequential',
            'message' => 'Already used',
            'logged_at' => now()->format('Y-m-d H:i'),
        ]);
        AppNotification::query()->create([
            'notification_number' => 'NOTIF-AABBCCDD',
            'title' => 'Random hex',
            'message' => 'Latest row by id',
            'logged_at' => now()->format('Y-m-d H:i'),
        ]);

        $this->assertSame(
            ['NOTIF-028', 'NOTIF-029'],
            DocumentCode::nextMany('supply_notifications', 'notification_number', 'NOTIF', 2, 3, false)
        );

        app(NotificationService::class)->createMany([
            [
                'title' => 'New RFQ Available',
                'message' => 'PR-2026-010: quote 10 units of toktok (COM-001).',
                'type' => 'procurement',
            ],
        ]);

        $this->assertDatabaseHas('supply_notifications', [
            'notification_number' => 'NOTIF-028',
            'title' => 'New RFQ Available',
        ]);
        $this->assertDatabaseMissing('supply_notifications', [
            'notification_number' => 'NOTIF-027',
            'title' => 'New RFQ Available',
        ]);
    }

    public function test_send_to_vendors_succeeds_when_legacy_notification_numbers_exist(): void
    {
        $staff = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-270',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);
        InventoryItem::query()->create([
            'code' => 'INV-270',
            'item_code' => 'COM-270',
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 1,
            'min_stock_level' => 5,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        AppNotification::query()->create([
            'notification_number' => 'NOTIF-027',
            'title' => 'Legacy',
            'message' => 'Taken',
            'logged_at' => now()->format('Y-m-d H:i'),
        ]);
        AppNotification::query()->create([
            'notification_number' => 'NOTIF-6A8B6C08',
            'title' => 'Hex',
            'message' => 'Latest',
            'logged_at' => now()->format('Y-m-d H:i'),
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-270',
                'quantity' => 10,
                'reason' => 'Restock handheld radios',
                'priority' => 'HIGH',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk()
            ->assertJsonPath('data.status', 'Quotation')
            ->assertJsonPath('data.vendorInviteCount', 1)
            ->assertJsonPath('data.sentToVendors', true);
    }

    public function test_manual_restock_is_allowed_when_stock_is_normal(): void
    {
        $staff = User::factory()->create();
        InventoryItem::query()->create([
            'code' => 'INV-240',
            'item_code' => 'OFF-240',
            'description' => 'Copy Paper',
            'category' => 'Office Supplies',
            'quantity' => 40,
            'min_stock_level' => 5,
            'unit' => 'Boxes',
            'cost' => 100,
        ]);

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'OFF-240',
                'quantity' => 20,
                'reason' => 'Proactive restock while stock is still above minimum.',
                'priority' => 'NORMAL',
            ])
            ->assertCreated()
            ->assertJsonPath('data.itemCode', 'OFF-240')
            ->assertJsonPath('data.quantity', 20)
            ->assertJsonPath('data.sourceRequest', 'MANUAL')
            ->assertJsonPath('data.vendorInviteCount', 0);
    }

    public function test_procurement_request_can_be_edited_until_sent_to_vendors(): void
    {
        $staff = User::factory()->create();
        InventoryItem::query()->create([
            'code' => 'INV-241',
            'item_code' => 'OFF-241',
            'description' => 'Copy Paper',
            'category' => 'Office Supplies',
            'quantity' => 40,
            'min_stock_level' => 5,
            'unit' => 'Boxes',
            'cost' => 100,
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'OFF-241',
                'quantity' => 8,
                'reason' => 'Initial restock plan',
                'priority' => 'NORMAL',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($staff)
            ->putJson('/api/procurement-requests/'.$prNumber, [
                'quantity' => 12,
                'reason' => 'Updated restock quantity',
                'priority' => 'HIGH',
            ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 12)
            ->assertJsonPath('data.priority', 'HIGH')
            ->assertJsonPath('data.neededInDays', 7)
            ->assertJsonPath('data.quoteWindowDays', 5)
            ->assertJsonPath('data.reason', 'Updated restock quantity')
            ->assertJsonPath('data.canEdit', true);

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk()
            ->assertJsonPath('data.canEdit', false);

        $this->actingAs($staff)
            ->putJson('/api/procurement-requests/'.$prNumber, [
                'quantity' => 20,
                'reason' => 'Too late to edit',
                'priority' => 'URGENT',
            ])
            ->assertStatus(422);
    }

    public function test_vendor_quote_leaves_opportunities_and_can_be_edited_until_selected(): void
    {
        Storage::fake('public');

        $staff = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-220',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Fleet Consumables'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);

        InventoryItem::query()->create([
            'code' => 'INV-220',
            'item_code' => 'COM-220',
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 2,
            'min_stock_level' => 5,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-220',
                'quantity' => 10,
                'reason' => 'low stock',
                'priority' => 'HIGH',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk();

        $quoteNumber = $this->actingAs($vendor)
            ->post('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'warranty' => '1 year',
                'deliveryTimeDays' => 2,
                'itemPhotos' => [UploadedFile::fake()->image('unit.jpg', 60, 60)],
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.canEdit', true)
            ->assertJsonCount(1, 'data.itemPhotoUrls')
            ->json('data.id');

        $this->actingAs($vendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($vendor)
            ->putJson('/api/quotations/'.$quoteNumber, [
                'unitPrice' => 1200,
                'warranty' => '2 years',
                'deliveryTimeDays' => 3,
            ])
            ->assertOk()
            ->assertJsonPath('data.unitPrice', 1200)
            ->assertJsonPath('data.totalPrice', 12000)
            ->assertJsonPath('data.canEdit', true)
            ->assertJsonCount(1, 'data.itemPhotoUrls');
    }

    public function test_vendor_can_submit_quotation_with_base64_warranty_file(): void
    {
        Storage::fake('public');

        $staff = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-221',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Fleet Consumables'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);

        InventoryItem::query()->create([
            'code' => 'INV-221',
            'item_code' => 'COM-221',
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 2,
            'min_stock_level' => 5,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-221',
                'quantity' => 10,
                'reason' => 'low stock',
                'priority' => 'HIGH',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk();

        $this->actingAs($vendor)
            ->post('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'warranty' => '1 year',
                'warrantyFileBase64' => base64_encode('%PDF-1.4 warranty'),
                'warrantyFileName' => 'warranty.pdf',
                'deliveryTimeDays' => 2,
                'itemPhotos' => [UploadedFile::fake()->image('unit.jpg', 60, 60)],
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.canEdit', true);

        $this->assertNotNull(
            Quotation::query()->where('item', 'toktok')->value('warranty_file_path')
        );
    }

    public function test_vendor_can_submit_quotation_without_warranty_and_with_optional_manual(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-241', 'COM-241', 'INV-241');

        $response = $this->actingAs($vendor)
            ->post('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'deliveryTimeDays' => 2,
                'itemPhotos' => [UploadedFile::fake()->image('unit.jpg', 60, 60)],
                'manualFileBase64' => base64_encode('%PDF-1.4 item manual'),
                'manualFileName' => 'manual.pdf',
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.warranty', null)
            ->assertJsonPath('data.warrantyMonths', null)
            ->assertJsonPath('data.warrantyFileUrl', null);

        $quote = Quotation::query()->where('quote_number', $response->json('data.id'))->firstOrFail();
        $this->assertNull($quote->warranty);
        $this->assertNull($quote->warranty_months);
        $this->assertNull($quote->warranty_file_path);
        $this->assertNotNull($quote->manual_file_path);
        Storage::disk('public')->assertExists($quote->manual_file_path);
        $this->assertSame('/storage/'.$quote->manual_file_path, $response->json('data.manualFileUrl'));
    }

    public function test_vendor_can_clear_warranty_when_editing_a_quotation(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-242', 'COM-242', 'INV-242');

        $quoteNumber = $this->actingAs($vendor)
            ->post('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'warranty' => '1 year',
                'warrantyMonths' => 12,
                'deliveryTimeDays' => 2,
                'itemPhotos' => [UploadedFile::fake()->image('unit.jpg', 60, 60)],
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.warrantyMonths', 12)
            ->json('data.id');

        $this->actingAs($vendor)
            ->putJson('/api/quotations/'.$quoteNumber, [
                'unitPrice' => 1000,
                'warranty' => '',
                'warrantyMonths' => null,
                'deliveryTimeDays' => 2,
            ])
            ->assertOk()
            ->assertJsonPath('data.warranty', null)
            ->assertJsonPath('data.warrantyMonths', null);
    }

    public function test_vendor_can_submit_quotation_with_chunked_manual_token(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-243', 'COM-243', 'INV-243');

        $photo = UploadedFile::fake()->image('unit.jpg', 40, 40);
        $photoToken = $this->chunkUpload(
            $vendor,
            'photo',
            'unit.jpg',
            (string) file_get_contents($photo->getRealPath())
        );
        $manualToken = $this->chunkUpload($vendor, 'manual', 'manual.pdf', '%PDF-1.4 item manual');

        $this->actingAs($vendor)
            ->postJson('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'deliveryTimeDays' => 2,
                'itemPhotoTokens' => [$photoToken],
                'manualToken' => $manualToken,
            ])
            ->assertCreated()
            ->assertJsonPath('data.warrantyMonths', null);

        $quote = Quotation::query()->where('item', 'toktok')->firstOrFail();
        $this->assertNotNull($quote->manual_file_path);
        Storage::disk('public')->assertExists($quote->manual_file_path);
    }

    public function test_vendor_can_submit_quotation_with_base64_item_photos(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-236', 'COM-236', 'INV-236');

        $photo = UploadedFile::fake()->image('unit.jpg', 40, 40);

        $this->actingAs($vendor)
            ->postJson('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'deliveryTimeDays' => 2,
                'itemPhotosBase64' => [base64_encode((string) file_get_contents($photo->getRealPath()))],
                'itemPhotoNames' => ['unit.jpg'],
            ])
            ->assertCreated()
            ->assertJsonCount(1, 'data.itemPhotoUrls');

        $quote = Quotation::query()->where('item', 'toktok')->firstOrFail();
        $this->assertCount(1, $quote->itemPhotoPaths());
        Storage::disk('public')->assertExists($quote->itemPhotoPaths()[0]);
    }

    public function test_vendor_can_submit_quotation_with_complete_upload_token(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-238', 'COM-238', 'INV-238');

        $photo = UploadedFile::fake()->image('unit.jpg', 40, 40);
        $photoToken = $this->actingAs($vendor)
            ->post('/api/quotation-uploads', [
                'step' => 'complete',
                'kind' => 'photo',
                'fileName' => 'unit.jpg',
                'file' => $photo,
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->json('data.token');

        $this->actingAs($vendor)
            ->postJson('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 500,
                'totalPrice' => 5000,
                'deliveryTimeDays' => 2,
                'itemPhotoTokens' => [$photoToken],
            ])
            ->assertCreated()
            ->assertJsonCount(1, 'data.itemPhotoUrls');

        $quote = Quotation::query()->where('item', 'toktok')->firstOrFail();
        $this->assertCount(1, $quote->itemPhotoPaths());
        Storage::disk('public')->assertExists($quote->itemPhotoPaths()[0]);
    }

    public function test_vendor_can_submit_quotation_with_chunked_photo_and_warranty_tokens(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-237', 'COM-237', 'INV-237');

        $photo = UploadedFile::fake()->image('unit.jpg', 40, 40);
        $photoToken = $this->chunkUpload(
            $vendor,
            'photo',
            'unit.jpg',
            (string) file_get_contents($photo->getRealPath())
        );
        $warrantyToken = $this->chunkUpload($vendor, 'warranty', 'warranty.pdf', '%PDF-1.4 warranty');

        $this->actingAs($vendor)
            ->postJson('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'deliveryTimeDays' => 2,
                'itemPhotoTokens' => [$photoToken],
                'warrantyToken' => $warrantyToken,
            ])
            ->assertCreated()
            ->assertJsonCount(1, 'data.itemPhotoUrls')
            ->assertJsonPath('data.canEdit', true);

        $quote = Quotation::query()->where('item', 'toktok')->firstOrFail();
        $this->assertCount(1, $quote->itemPhotoPaths());
        $this->assertNotNull($quote->warranty_file_path);
        Storage::disk('public')->assertExists($quote->itemPhotoPaths()[0]);
        Storage::disk('public')->assertExists($quote->warranty_file_path);
    }

    public function test_vendor_quotation_stores_up_to_three_item_photos(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-230', 'COM-230', 'INV-230');

        $response = $this->actingAs($vendor)
            ->post('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'deliveryTimeDays' => 2,
                'itemPhotos' => [
                    UploadedFile::fake()->image('front.jpg', 60, 60),
                    UploadedFile::fake()->image('side.png', 60, 60),
                    UploadedFile::fake()->image('label.webp', 60, 60),
                ],
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonCount(3, 'data.itemPhotoUrls');

        $quote = Quotation::query()->where('quote_number', $response->json('data.id'))->firstOrFail();
        $paths = $quote->itemPhotoPaths();

        $this->assertCount(3, $paths);
        foreach ($paths as $index => $path) {
            $this->assertStringStartsWith('quotation-item-photos/'.$quote->quote_number.'-'.($index + 1).'.', $path);
            Storage::disk('public')->assertExists($path);
        }

        $this->assertSame(
            array_map(fn (string $path) => '/storage/'.$path, $paths),
            $response->json('data.itemPhotoUrls')
        );
    }

    public function test_vendor_quotation_rejects_invalid_item_photo_sets(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-231', 'COM-231', 'INV-231');

        $base = [
            'procurementId' => $prNumber,
            'item' => 'toktok',
            'quantity' => 10,
            'unitPrice' => 1000,
            'totalPrice' => 10000,
            'deliveryTimeDays' => 2,
        ];

        $this->actingAs($vendor)
            ->postJson('/api/quotations', $base)
            ->assertStatus(422)
            ->assertJsonValidationErrors('itemPhotos');

        $this->actingAs($vendor)
            ->post('/api/quotations', [
                ...$base,
                'itemPhotos' => [
                    UploadedFile::fake()->image('a.jpg', 40, 40),
                    UploadedFile::fake()->image('b.jpg', 40, 40),
                    UploadedFile::fake()->image('c.jpg', 40, 40),
                    UploadedFile::fake()->image('d.jpg', 40, 40),
                ],
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('itemPhotos');

        $this->actingAs($vendor)
            ->post('/api/quotations', [
                ...$base,
                'itemPhotos' => [UploadedFile::fake()->create('spec.pdf', 20, 'application/pdf')],
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('itemPhotos.0');

        $this->actingAs($vendor)
            ->post('/api/quotations', [
                ...$base,
                'itemPhotos' => [UploadedFile::fake()->image('huge.jpg')->size(6144)],
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('itemPhotos.0');

        $this->assertSame(0, Quotation::query()->count());
    }

    public function test_vendor_can_keep_add_and_remove_item_photos_when_editing(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-232', 'COM-232', 'INV-232');

        $created = $this->actingAs($vendor)
            ->post('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'deliveryTimeDays' => 2,
                'itemPhotos' => [
                    UploadedFile::fake()->image('front.jpg', 60, 60),
                    UploadedFile::fake()->image('side.jpg', 60, 60),
                ],
            ], ['Accept' => 'application/json'])
            ->assertCreated();

        $quoteNumber = $created->json('data.id');
        [$keptUrl, $droppedUrl] = $created->json('data.itemPhotoUrls');
        $droppedPath = ltrim(str_replace('/storage/', '', $droppedUrl), '/');

        $updated = $this->actingAs($vendor)
            ->post('/api/quotations/'.$quoteNumber, [
                'unitPrice' => 1200,
                'keepItemPhotos' => json_encode([$keptUrl]),
                'itemPhotos' => [UploadedFile::fake()->image('replacement.png', 60, 60)],
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.unitPrice', 1200)
            ->assertJsonCount(2, 'data.itemPhotoUrls');

        $this->assertContains($keptUrl, $updated->json('data.itemPhotoUrls'));
        $this->assertNotContains($droppedUrl, $updated->json('data.itemPhotoUrls'));
        Storage::disk('public')->assertMissing($droppedPath);

        foreach ($updated->json('data.itemPhotoUrls') as $url) {
            Storage::disk('public')->assertExists(ltrim(str_replace('/storage/', '', $url), '/'));
        }
    }

    public function test_vendor_cannot_remove_every_item_photo_when_editing(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-233', 'COM-233', 'INV-233');

        $quoteNumber = $this->actingAs($vendor)
            ->post('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'deliveryTimeDays' => 2,
                'itemPhotos' => [UploadedFile::fake()->image('front.jpg', 60, 60)],
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($vendor)
            ->post('/api/quotations/'.$quoteNumber, [
                'unitPrice' => 1200,
                'keepItemPhotos' => json_encode([]),
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('itemPhotos');

        $quote = Quotation::query()->where('quote_number', $quoteNumber)->firstOrFail();
        $this->assertCount(1, $quote->itemPhotoPaths());
        $this->assertSame(1000.0, (float) $quote->unit_price);
        Storage::disk('public')->assertExists($quote->itemPhotoPaths()[0]);
    }

    public function test_vendor_cannot_change_item_photos_on_another_suppliers_quotation(): void
    {
        Storage::fake('public');

        [, $vendor, $prNumber] = $this->openRfqForVendor('SUP-234', 'COM-234', 'INV-234');

        $quoteNumber = $this->actingAs($vendor)
            ->post('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'toktok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'deliveryTimeDays' => 2,
                'itemPhotos' => [UploadedFile::fake()->image('front.jpg', 60, 60)],
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data.id');

        $rival = Supplier::query()->create([
            'code' => 'SUP-235',
            'company_name' => 'NaviTrack Philippines',
            'contact_person' => 'Marco Villanueva',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        $rivalUser = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $rival->id,
        ]);

        $this->actingAs($rivalUser)
            ->post('/api/quotations/'.$quoteNumber, [
                'unitPrice' => 1,
                'keepItemPhotos' => json_encode([]),
                'itemPhotos' => [UploadedFile::fake()->image('rival.jpg', 60, 60)],
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('quotation');

        $quote = Quotation::query()->where('quote_number', $quoteNumber)->firstOrFail();
        $this->assertCount(1, $quote->itemPhotoPaths());
        $this->assertSame(1000.0, (float) $quote->unit_price);
    }

    private function chunkUpload(User $vendor, string $kind, string $fileName, string $contents): string
    {
        $uploadId = $this->actingAs($vendor)
            ->getJson('/api/quotation-uploads?'.http_build_query([
                'step' => 'start',
                'kind' => $kind,
                'fileName' => $fileName,
            ]))
            ->assertOk()
            ->json('data.uploadId');

        $this->actingAs($vendor)
            ->getJson('/api/quotation-uploads?'.http_build_query([
                'step' => 'chunk',
                'uploadId' => $uploadId,
                'chunk' => base64_encode($contents),
            ]))
            ->assertOk();

        return $this->actingAs($vendor)
            ->getJson('/api/quotation-uploads?'.http_build_query([
                'step' => 'finish',
                'uploadId' => $uploadId,
            ]))
            ->assertOk()
            ->json('data.token');
    }

    /**
     * Creates staff, a vendor, and an RFQ already published to that vendor's portal.
     *
     * @return array{0: User, 1: User, 2: string}
     */
    private function openRfqForVendor(string $supplierCode, string $itemCode, string $inventoryCode): array
    {
        $staff = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => $supplierCode,
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Fleet Consumables'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);

        InventoryItem::query()->create([
            'code' => $inventoryCode,
            'item_code' => $itemCode,
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 2,
            'min_stock_level' => 5,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => $itemCode,
                'quantity' => 10,
                'reason' => 'low stock',
                'priority' => 'HIGH',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk();

        return [$staff, $vendor, $prNumber];
    }

    public function test_finance_approval_updates_purchase_order_status(): void
    {
        $user = User::factory()->create();
        $pr = ProcurementRequest::query()->create([
            'pr_number' => 'PR-2026-401',
            'department' => 'Operations',
            'item_code' => 'COM-401',
            'item_name' => 'Radio',
            'quantity' => 2,
            'status' => 'Pending Finance Approval',
        ]);
        $po = PurchaseOrder::query()->create([
            'po_number' => 'PO-2026-401',
            'procurement_request_id' => $pr->id,
            'supplier' => 'Metro Parts Trading',
            'total_cost' => 5000,
            'budget_reference' => 'BUD-2026-OPS-01',
            'payment_terms' => '30 Days Net',
            'finance_approval_status' => 'Pending Finance Approval',
            'po_status' => 'Pending Finance Approval',
            'created_date' => now()->toDateString(),
        ]);
        $po->timeline()->create([
            'sort_order' => 1,
            'step' => 'Finance Approval Checkpoint',
            'step_date' => '—',
            'status' => 'in_progress',
        ]);
        $po->timeline()->create([
            'sort_order' => 2,
            'step' => 'Sent to Supplier',
            'step_date' => '—',
            'status' => 'pending',
        ]);
        $po->timeline()->create([
            'sort_order' => 3,
            'step' => 'Supplier Confirmation',
            'step_date' => '—',
            'status' => 'pending',
        ]);

        $this->actingAs($user)
            ->postJson('/api/purchase-orders/PO-2026-401/finance-decision', [
                'status' => 'Finance Approved',
                'remarks' => 'Budget verified',
            ])
            ->assertOk()
            ->assertJsonPath('data.poNumber', 'PO-2026-401')
            ->assertJsonPath('data.financeApprovalStatus', 'Finance Approved')
            ->assertJsonPath('data.poStatus', 'Sent to Supplier')
            ->assertJsonPath('data.priority', 'NORMAL')
            ->assertJsonPath('data.confirmBy', now()->addDays(3)->toDateString());

        $this->assertDatabaseHas('purchase_orders', [
            'po_number' => 'PO-2026-401',
            'po_status' => 'Sent to Supplier',
        ]);
        $this->assertDatabaseHas('procurement_requests', [
            'pr_number' => 'PR-2026-401',
            'status' => 'Finance Approved',
        ]);
        $this->assertDatabaseHas('purchase_order_timeline_steps', [
            'purchase_order_id' => $po->id,
            'step' => 'Sent to Supplier',
            'status' => 'completed',
        ]);
    }

    public function test_vendor_confirm_creates_inbound_delivery(): void
    {
        $staff = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-230',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);

        $po = PurchaseOrder::query()->create([
            'po_number' => 'PO-2026-300',
            'supplier_id' => $supplier->id,
            'supplier' => $supplier->company_name,
            'contact_person' => 'Ana Reyes',
            'total_cost' => 10000,
            'budget_reference' => 'BUD-2026-INV-64',
            'payment_terms' => '30 Days Net',
            'delivery_date' => '2026-08-15',
            'finance_approval_status' => 'Finance Approved',
            'po_status' => 'Sent to Supplier',
            'created_date' => now()->toDateString(),
        ]);
        $po->items()->create([
            'item_code' => 'COM-001',
            'description' => 'toktok',
            'quantity' => 10,
            'unit_price' => 1000,
            'total' => 10000,
            'delivered_qty' => 0,
        ]);

        $this->actingAs($vendor)
            ->postJson('/api/purchase-orders/PO-2026-300/confirm')
            ->assertOk()
            ->assertJsonPath('data.poStatus', 'Confirmed');

        $this->actingAs($staff)
            ->getJson('/api/deliveries')
            ->assertOk()
            ->assertJsonPath('data.0.poNumber', 'PO-2026-300')
            ->assertJsonPath('data.0.supplier', 'Metro Parts Trading')
            ->assertJsonPath('data.0.status', 'In Transit')
            ->assertJsonPath('data.0.itemsDelivered.0.description', 'toktok');

        $live = $this->actingAs($staff)
            ->getJson('/api/live?stamp=stale')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->json('data');

        $this->assertNotEmpty($live['deliveries'] ?? []);
        $this->assertSame('PO-2026-300', $live['deliveries'][0]['poNumber']);
        $this->assertSame('In Transit', $live['deliveries'][0]['status']);
        $this->assertSame('toktok', $live['deliveries'][0]['itemsDelivered'][0]['description']);
    }

    public function test_inspection_returns_created_movements_and_live_syncs_audit_trail(): void
    {
        $user = User::factory()->create(['name' => 'J. Perez']);
        InventoryItem::query()->create([
            'code' => 'INV-310',
            'item_code' => 'COM-001',
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 2,
            'min_stock_level' => 1,
            'unit' => 'Units',
            'cost' => 1000,
        ]);

        $po = PurchaseOrder::query()->create([
            'po_number' => 'PO-2026-310',
            'supplier' => 'Metro Parts Trading',
            'total_cost' => 10000,
            'finance_approval_status' => 'Finance Approved',
            'po_status' => 'Confirmed',
            'created_date' => now()->toDateString(),
        ]);
        $po->items()->create([
            'item_code' => 'COM-001',
            'description' => 'toktok',
            'quantity' => 10,
            'unit_price' => 1000,
            'total' => 10000,
            'delivered_qty' => 0,
        ]);

        $this->actingAs($user)
            ->getJson('/api/deliveries')
            ->assertOk()
            ->assertJsonPath('data.0.poNumber', 'PO-2026-310');

        $deliveryId = $this->actingAs($user)
            ->getJson('/api/deliveries')
            ->json('data.0.id');

        $this->actingAs($user)
            ->postJson("/api/deliveries/{$deliveryId}/inspect", [
                'inspectionResult' => 'Passed',
                'remarks' => 'Accepted',
                'itemsDelivered' => [[
                    'itemCode' => 'COM-001',
                    'description' => 'toktok',
                    'deliveredQuantity' => 10,
                    'condition' => 'Good',
                    'result' => 'Passed',
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.createdMovements.0.movementType', 'Receiving')
            ->assertJsonPath('data.createdMovements.0.itemCode', 'COM-001')
            ->assertJsonPath('data.createdMovements.0.quantity', 10)
            ->assertJsonPath('data.createdMovements.0.recordedBy', 'J. Perez');

        $live = $this->actingAs($user)
            ->getJson('/api/live?stamp=stale')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($live['movements'] ?? []);
        $this->assertSame('Receiving', $live['movements'][0]['movementType']);
        $this->assertSame('COM-001', $live['movements'][0]['itemCode']);
        $this->assertSame(10, $live['movements'][0]['quantity']);
    }

    public function test_rfq_deadline_notification_and_vendor_queue_follow_priority(): void
    {
        \Illuminate\Support\Carbon::setTestNow('2026-09-01 08:00:00');

        $staff = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-PRI',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);

        foreach ([
            ['code' => 'INV-PRI-N', 'item' => 'OFF-PRI-N', 'name' => 'Copy Paper', 'priority' => 'NORMAL'],
            ['code' => 'INV-PRI-H', 'item' => 'COM-PRI-H', 'name' => 'Handheld Radio', 'priority' => 'HIGH'],
            ['code' => 'INV-PRI-U', 'item' => 'COM-PRI-U', 'name' => 'TokTok', 'priority' => 'URGENT'],
        ] as $row) {
            InventoryItem::query()->create([
                'code' => $row['code'],
                'item_code' => $row['item'],
                'description' => $row['name'],
                'category' => 'Communication Devices',
                'quantity' => 0,
                'min_stock_level' => 5,
                'unit' => 'Units',
                'cost' => 500,
            ]);

            $prNumber = $this->actingAs($staff)
                ->postJson('/api/procurement-requests', [
                    'itemCode' => $row['item'],
                    'quantity' => 10,
                    'reason' => 'Restock '.$row['name'],
                    'priority' => $row['priority'],
                ])
                ->assertCreated()
                ->json('data.id');

            $this->actingAs($staff)
                ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
                ->assertOk();
        }

        $opportunities = $this->actingAs($vendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->json('data');

        $this->assertSame(['URGENT', 'HIGH', 'NORMAL'], array_column($opportunities, 'priority'));
        $this->assertSame('TokTok', $opportunities[0]['itemName']);
        $this->assertSame('2026-09-03', $opportunities[0]['deadline']);
        $this->assertSame('2026-09-04', $opportunities[0]['neededBy']);
        $this->assertSame(2, $opportunities[0]['quoteWindowDays']);
        $this->assertSame(3, $opportunities[0]['neededInDays']);
        $this->assertSame('2026-09-06', $opportunities[1]['deadline']);
        $this->assertSame('2026-09-08', $opportunities[1]['neededBy']);
        $this->assertSame('2026-09-11', $opportunities[2]['deadline']);
        $this->assertSame('2026-09-15', $opportunities[2]['neededBy']);

        $this->assertDatabaseHas('supply_notifications', [
            'user_id' => $vendor->id,
            'severity' => 'danger',
        ]);
        $this->assertTrue(
            AppNotification::query()
                ->where('user_id', $vendor->id)
                ->where('severity', 'danger')
                ->where('title', 'like', 'URGENT RFQ:%')
                ->exists()
        );

        \Illuminate\Support\Carbon::setTestNow();
    }

    public function test_urgent_purchase_order_gets_a_one_day_confirm_window(): void
    {
        \Illuminate\Support\Carbon::setTestNow('2026-09-01 08:00:00');

        $user = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-URG',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);
        $pr = ProcurementRequest::query()->create([
            'pr_number' => 'PR-2026-URG',
            'department' => 'Operations',
            'item_code' => 'COM-URG',
            'item_name' => 'TokTok',
            'quantity' => 8,
            'priority' => 'URGENT',
            'status' => 'Pending Finance Approval',
        ]);
        $po = PurchaseOrder::query()->create([
            'po_number' => 'PO-2026-URG',
            'procurement_request_id' => $pr->id,
            'supplier_id' => $supplier->id,
            'supplier' => 'Metro Parts Trading',
            'total_cost' => 5000,
            'budget_reference' => 'BUD-2026-OPS-09',
            'payment_terms' => '30 Days Net',
            'priority' => 'URGENT',
            'finance_approval_status' => 'Pending Finance Approval',
            'po_status' => 'Pending Finance Approval',
            'created_date' => now()->toDateString(),
        ]);
        $po->timeline()->create([
            'sort_order' => 1,
            'step' => 'Finance Approval Checkpoint',
            'step_date' => '—',
            'status' => 'in_progress',
        ]);
        $po->timeline()->create([
            'sort_order' => 2,
            'step' => 'Sent to Supplier',
            'step_date' => '—',
            'status' => 'pending',
        ]);
        $po->timeline()->create([
            'sort_order' => 3,
            'step' => 'Supplier Confirmation',
            'step_date' => '—',
            'status' => 'pending',
        ]);

        $this->actingAs($user)
            ->postJson('/api/purchase-orders/PO-2026-URG/finance-decision', [
                'status' => 'Finance Approved',
                'remarks' => 'Need TokTok immediately',
            ])
            ->assertOk()
            ->assertJsonPath('data.priority', 'URGENT')
            ->assertJsonPath('data.confirmBy', '2026-09-02')
            ->assertJsonPath('data.poStatus', 'Sent to Supplier');

        $this->assertTrue(
            AppNotification::query()
                ->where('user_id', $vendor->id)
                ->where('title', 'URGENT PO: confirm PO-2026-URG')
                ->exists()
        );

        \Illuminate\Support\Carbon::setTestNow();
    }

    public function test_staff_can_set_needed_in_days_without_changing_rfq_quote_window(): void
    {
        \Illuminate\Support\Carbon::setTestNow('2026-09-01 08:00:00');

        $staff = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-NEED',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);
        InventoryItem::query()->create([
            'code' => 'INV-NEED',
            'item_code' => 'COM-NEED',
            'description' => 'TokTok',
            'category' => 'Communication Devices',
            'quantity' => 0,
            'min_stock_level' => 5,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-NEED',
                'quantity' => 10,
                'reason' => 'Need TokTok in 3 days',
                'priority' => 'URGENT',
                'neededInDays' => 3,
            ])
            ->assertCreated()
            ->assertJsonPath('data.priority', 'URGENT')
            ->assertJsonPath('data.neededInDays', 3)
            ->assertJsonPath('data.quoteWindowDays', 2)
            ->json('data.id');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk();

        $this->actingAs($vendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonPath('data.0.deadline', '2026-09-03')
            ->assertJsonPath('data.0.neededBy', '2026-09-04')
            ->assertJsonPath('data.0.quoteWindowDays', 2)
            ->assertJsonPath('data.0.neededInDays', 3);

        \Illuminate\Support\Carbon::setTestNow();
    }

    public function test_overdue_rfq_with_no_quotes_alerts_staff_but_still_accepts_a_late_quote(): void
    {
        \Illuminate\Support\Carbon::setTestNow('2026-09-01 08:00:00');

        $staff = User::factory()->create();
        $supplier = Supplier::query()->create([
            'code' => 'SUP-LATE',
            'company_name' => 'Metro Parts Trading',
            'contact_person' => 'Ana Reyes',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);
        InventoryItem::query()->create([
            'code' => 'INV-LATE',
            'item_code' => 'COM-LATE',
            'description' => 'TokTok',
            'category' => 'Communication Devices',
            'quantity' => 0,
            'min_stock_level' => 5,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        $prNumber = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-LATE',
                'quantity' => 10,
                'reason' => 'Urgent TokTok',
                'priority' => 'URGENT',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$prNumber.'/send-to-vendors')
            ->assertOk();

        \Illuminate\Support\Carbon::setTestNow('2026-09-04 09:00:00');

        $this->actingAs($staff)
            ->getJson('/api/procurement-requests')
            ->assertOk()
            ->assertJsonPath('data.0.rfqOverdue', true)
            ->assertJsonPath('data.0.quoteCount', 0)
            ->assertJsonPath('data.0.quoteDeadline', '2026-09-03');

        $this->assertTrue(
            AppNotification::query()
                ->whereNull('user_id')
                ->where('title', 'RFQ deadline passed with no quotes')
                ->exists()
        );

        $this->actingAs($vendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonPath('data.0.isOverdue', true);

        Storage::fake('public');

        $this->actingAs($vendor)
            ->post('/api/quotations', [
                'procurementId' => $prNumber,
                'item' => 'TokTok',
                'quantity' => 10,
                'unitPrice' => 1000,
                'totalPrice' => 10000,
                'deliveryTimeDays' => 2,
                'itemPhotos' => [UploadedFile::fake()->image('unit.jpg', 60, 60)],
            ], ['Accept' => 'application/json'])
            ->assertCreated();

        \Illuminate\Support\Carbon::setTestNow();
    }
}
