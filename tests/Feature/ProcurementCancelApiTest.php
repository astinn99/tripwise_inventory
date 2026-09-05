<?php

namespace Tests\Feature;

use App\Models\InventoryItem;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\SupplierOpportunity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProcurementCancelApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_can_cancel_an_open_procurement_request(): void
    {
        $staff = User::factory()->create();
        $this->seedOpenPr();

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/PR-2026-900/cancel')
            ->assertOk()
            ->assertJsonPath('data.status', 'Cancelled')
            ->assertJsonPath('data.canCancel', false);

        $this->assertDatabaseHas('procurement_requests', [
            'pr_number' => 'PR-2026-900',
            'status' => 'Cancelled',
        ]);
        $this->assertDatabaseHas('supplier_opportunities', [
            'pr_number' => 'PR-2026-900',
            'status' => 'Cancelled',
        ]);
    }

    public function test_invited_vendor_can_cancel_an_open_rfq(): void
    {
        [$vendor] = $this->seedOpenPr();

        $this->actingAs($vendor)
            ->postJson('/api/procurement-requests/PR-2026-900/cancel')
            ->assertOk()
            ->assertJsonPath('data.status', 'Cancelled');

        $this->actingAs($vendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_uninvited_vendor_cannot_cancel_a_procurement_request(): void
    {
        $this->seedOpenPr();
        $other = Supplier::query()->create([
            'code' => 'SUP-901',
            'company_name' => 'Other Vendor',
            'contact_person' => 'Other',
            'status' => 'Active',
            'categories' => ['Fleet Consumables'],
        ]);
        $outsider = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $other->id,
        ]);

        $this->actingAs($outsider)
            ->postJson('/api/procurement-requests/PR-2026-900/cancel')
            ->assertForbidden();
    }

    public function test_fully_delivered_procurement_cannot_be_cancelled(): void
    {
        $staff = User::factory()->create();
        $pr = ProcurementRequest::query()->create([
            'pr_number' => 'PR-2026-901',
            'source_request' => 'MANUAL',
            'department' => 'Inventory Management',
            'item_code' => 'FLT-DEL',
            'item_name' => 'Brake Fluid',
            'quantity' => 4,
            'reason' => 'restock',
            'priority' => 'NORMAL',
            'status' => 'Finance Approved',
            'date_created' => now()->toDateString(),
            'estimated_cost' => 1000,
            'po_number' => 'PO-2026-901',
        ]);
        PurchaseOrder::query()->create([
            'po_number' => 'PO-2026-901',
            'procurement_request_id' => $pr->id,
            'supplier' => 'Acme Parts',
            'total_cost' => 1000,
            'finance_approval_status' => 'Finance Approved',
            'po_status' => 'Fully Delivered',
            'created_date' => now()->toDateString(),
        ]);

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/PR-2026-901/cancel')
            ->assertStatus(422);
    }

    public function test_unauthenticated_pr_cancel_is_rejected(): void
    {
        $this->postJson('/api/procurement-requests/PR-2026-900/cancel')->assertUnauthorized();
    }

    /**
     * @return array{0: User, 1: Supplier}
     */
    private function seedOpenPr(): array
    {
        InventoryItem::query()->create([
            'code' => 'INV-900',
            'item_code' => 'FLT-900',
            'description' => 'Brake Fluid',
            'category' => 'Fleet Consumables',
            'quantity' => 2,
            'min_stock_level' => 1,
            'unit' => 'Bottles',
            'cost' => 250,
        ]);
        $supplier = Supplier::query()->create([
            'code' => 'SUP-900',
            'company_name' => 'Acme Parts',
            'contact_person' => 'Maria Santos',
            'status' => 'Active',
            'categories' => ['Fleet Consumables'],
        ]);
        $vendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);
        $pr = ProcurementRequest::query()->create([
            'pr_number' => 'PR-2026-900',
            'source_request' => 'MANUAL',
            'department' => 'Inventory Management',
            'item_code' => 'FLT-900',
            'item_name' => 'Brake Fluid',
            'quantity' => 8,
            'reason' => 'restock',
            'priority' => 'NORMAL',
            'status' => 'Quotation',
            'date_created' => now()->toDateString(),
            'estimated_cost' => 2000,
        ]);
        SupplierOpportunity::query()->create([
            'opportunity_number' => 'OPP-2026-900',
            'pr_number' => $pr->pr_number,
            'procurement_request_id' => $pr->id,
            'supplier_id' => $supplier->id,
            'title' => 'Brake Fluid',
            'category' => 'Fleet Consumables',
            'quantity' => 8,
            'status' => 'Open for Quotation',
        ]);

        return [$vendor, $supplier];
    }
}
