<?php

namespace Tests\Feature;

use App\Models\ProcurementRequest;
use App\Models\Quotation;
use App\Models\Supplier;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VendorMessageApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-09-05 10:51:00'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_unauthenticated_message_routes_are_rejected(): void
    {
        $this->getJson('/api/messages')->assertUnauthorized();
        $this->postJson('/api/messages', ['body' => 'Need help with the business permit.'])->assertUnauthorized();
        $this->postJson('/api/messages/read')->assertUnauthorized();
    }

    public function test_vendor_lists_an_empty_thread(): void
    {
        [$vendor] = $this->acmeVendor();

        $this->actingAs($vendor)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.unreadCount', 0)
            ->assertJsonPath('data.messages', []);
    }

    public function test_message_timestamps_use_philippine_time(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 9, 5, 2, 51, 0, 'UTC'));

        [$vendor] = $this->acmeVendor();

        $this->actingAs($vendor)
            ->postJson('/api/messages', ['body' => 'Need help with the business permit.'])
            ->assertCreated()
            ->assertJsonPath('data.createdAt', '2026-09-05 10:51');
    }

    public function test_vendor_can_post_and_see_their_message(): void
    {
        [$vendor] = $this->acmeVendor();

        $this->actingAs($vendor)
            ->postJson('/api/messages', ['body' => 'Need help with the business permit.'])
            ->assertCreated()
            ->assertJsonPath('data.body', 'Need help with the business permit.')
            ->assertJsonPath('data.mine', true)
            ->assertJsonPath('data.authorName', 'Maria Santos')
            ->assertJsonPath('data.system', false)
            ->assertJsonPath('data.createdAt', '2026-09-05 10:51');

        $this->actingAs($vendor)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.unreadCount', 0)
            ->assertJsonPath('data.messages.0.body', 'Need help with the business permit.')
            ->assertJsonPath('data.messages.0.mine', true)
            ->assertJsonPath('data.messages.0.authorName', 'Maria Santos');
    }

    public function test_vendor_cannot_read_or_write_another_vendor_thread(): void
    {
        [$acmeVendor] = $this->acmeVendor();
        [$bdoVendor] = $this->bdoVendor();

        $this->actingAs($acmeVendor)
            ->postJson('/api/messages', [
                'supplier' => 'SUP-002',
                'body' => 'Need help with the business permit.',
            ])
            ->assertCreated();

        $this->actingAs($acmeVendor)
            ->getJson('/api/messages?supplier=SUP-002')
            ->assertForbidden();

        $this->actingAs($bdoVendor)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.messages', [])
            ->assertJsonPath('data.unreadCount', 0);

        $this->actingAs($acmeVendor)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.messages.0.body', 'Need help with the business permit.');
    }

    public function test_staff_inbox_and_reply_appear_on_vendor_thread(): void
    {
        [$vendor] = $this->acmeVendor();
        $staff = $this->staff();

        $this->actingAs($vendor)
            ->postJson('/api/messages', ['body' => 'Need help with the business permit.'])
            ->assertCreated();

        $this->actingAs($staff)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.supplierId', 'SUP-001')
            ->assertJsonPath('data.0.companyName', 'Acme Parts')
            ->assertJsonPath('data.0.lastBody', 'Need help with the business permit.')
            ->assertJsonPath('data.0.lastAt', '2026-09-05 10:51')
            ->assertJsonPath('data.0.unreadCount', 1);

        $this->actingAs($staff)
            ->getJson('/api/messages?supplier=SUP-001')
            ->assertOk()
            ->assertJsonPath('data.messages.0.body', 'Need help with the business permit.')
            ->assertJsonPath('data.messages.0.mine', false);

        $this->actingAs($staff)
            ->postJson('/api/messages', [
                'supplier' => 'SUP-001',
                'body' => 'Upload a clearer scan.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.body', 'Upload a clearer scan.')
            ->assertJsonPath('data.mine', true)
            ->assertJsonPath('data.authorName', 'Justin Cruz');

        $this->actingAs($vendor)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.unreadCount', 1)
            ->assertJsonPath('data.messages.0.body', 'Need help with the business permit.')
            ->assertJsonPath('data.messages.1.body', 'Upload a clearer scan.')
            ->assertJsonPath('data.messages.1.mine', false)
            ->assertJsonPath('data.messages.1.authorName', 'Justin Cruz');
    }

    public function test_empty_and_overlong_bodies_are_rejected(): void
    {
        [$vendor] = $this->acmeVendor();
        $staff = $this->staff();

        $this->actingAs($vendor)
            ->postJson('/api/messages', ['body' => ''])
            ->assertStatus(422);

        $this->actingAs($vendor)
            ->postJson('/api/messages', ['body' => str_repeat('a', 2001)])
            ->assertStatus(422);

        $this->actingAs($staff)
            ->postJson('/api/messages', ['body' => 'Upload a clearer scan.'])
            ->assertStatus(422);

        $this->actingAs($staff)
            ->postJson('/api/messages/read')
            ->assertStatus(422);
    }

    public function test_mark_read_clears_unread_for_the_other_side_only(): void
    {
        [$vendor] = $this->acmeVendor();
        $staff = $this->staff();

        $this->actingAs($vendor)
            ->postJson('/api/messages', ['body' => 'Need help with the business permit.'])
            ->assertCreated();

        $this->actingAs($staff)
            ->postJson('/api/messages/read', ['supplier' => 'SUP-001'])
            ->assertOk();

        $this->actingAs($staff)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.0.unreadCount', 0);

        $this->actingAs($vendor)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.unreadCount', 0);

        $this->actingAs($staff)
            ->postJson('/api/messages', [
                'supplier' => 'SUP-001',
                'body' => 'Upload a clearer scan.',
            ])
            ->assertCreated();

        $this->actingAs($vendor)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.unreadCount', 1);

        $this->actingAs($vendor)
            ->postJson('/api/messages/read')
            ->assertOk();

        $this->actingAs($vendor)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.unreadCount', 0);
    }

    public function test_selecting_a_quotation_posts_a_system_message_to_the_winning_vendor_only(): void
    {
        [$winner] = $this->acmeVendor();
        [$loser] = $this->bdoVendor();
        $staff = $this->staff();
        $this->seedBrakePadQuotes($winner, $loser);

        $this->actingAs($staff)
            ->postJson('/api/quotations/QT-2026-001/select')
            ->assertOk();

        $expected = 'TripWise selected your company for Brake Pads (PR-2026-001). Purchase order PO-2026-001 was created and is awaiting finance approval.';

        $this->actingAs($winner)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.unreadCount', 1)
            ->assertJsonPath('data.messages.0.body', $expected)
            ->assertJsonPath('data.messages.0.mine', false)
            ->assertJsonPath('data.messages.0.authorName', 'TripWise')
            ->assertJsonPath('data.messages.0.system', true);

        $this->actingAs($loser)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.messages', [])
            ->assertJsonPath('data.unreadCount', 0);

        $this->actingAs($staff)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.0.supplierId', 'SUP-001')
            ->assertJsonPath('data.0.lastBody', $expected)
            ->assertJsonPath('data.0.unreadCount', 0);
    }

    public function test_po_activity_posts_system_messages_from_selection_through_delivery(): void
    {
        [$winner] = $this->acmeVendor();
        [$loser] = $this->bdoVendor();
        $staff = $this->staff();
        $this->seedBrakePadQuotes($winner, $loser);

        $selected = 'TripWise selected your company for Brake Pads (PR-2026-001). Purchase order PO-2026-001 was created and is awaiting finance approval.';
        $approved = 'Purchase order PO-2026-001 was approved by finance and sent to you for confirmation.';
        $confirmed = 'Purchase order PO-2026-001 was confirmed. The shipment is in transit for receiving and inspection.';
        $delivered = 'Supply for purchase order PO-2026-001 has been delivered and accepted (DEL-2026-001). Inventory has been updated.';

        $this->actingAs($staff)
            ->postJson('/api/quotations/QT-2026-001/select')
            ->assertOk();

        $this->actingAs($staff)
            ->postJson('/api/purchase-orders/PO-2026-001/finance-decision', [
                'status' => 'Finance Approved',
                'remarks' => 'Budget verified',
            ])
            ->assertOk();

        $this->actingAs($winner)
            ->postJson('/api/purchase-orders/PO-2026-001/confirm')
            ->assertOk();

        $deliveryId = $this->actingAs($staff)
            ->getJson('/api/deliveries')
            ->assertOk()
            ->assertJsonPath('data.0.id', 'DEL-2026-001')
            ->json('data.0.id');

        $this->actingAs($staff)
            ->postJson("/api/deliveries/{$deliveryId}/inspect", [
                'inspectionResult' => 'Passed',
                'remarks' => 'Accepted',
                'itemsDelivered' => [[
                    'itemCode' => 'FLT-001',
                    'description' => 'Brake Pads',
                    'deliveredQuantity' => 10,
                    'condition' => 'Good',
                    'result' => 'Passed',
                ]],
            ])
            ->assertOk();

        $this->actingAs($winner)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.messages.0.body', $selected)
            ->assertJsonPath('data.messages.0.system', true)
            ->assertJsonPath('data.messages.1.body', $approved)
            ->assertJsonPath('data.messages.1.system', true)
            ->assertJsonPath('data.messages.2.body', $confirmed)
            ->assertJsonPath('data.messages.2.system', true)
            ->assertJsonPath('data.messages.3.body', $delivered)
            ->assertJsonPath('data.messages.3.system', true)
            ->assertJsonPath('data.messages.3.authorName', 'TripWise');

        $this->actingAs($loser)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.messages', [])
            ->assertJsonPath('data.unreadCount', 0);
    }

    public function test_finance_reject_posts_a_system_message_to_the_winning_vendor(): void
    {
        [$winner] = $this->acmeVendor();
        [$loser] = $this->bdoVendor();
        $staff = $this->staff();
        $this->seedBrakePadQuotes($winner, $loser);

        $this->actingAs($staff)
            ->postJson('/api/quotations/QT-2026-001/select')
            ->assertOk();

        $this->actingAs($staff)
            ->postJson('/api/purchase-orders/PO-2026-001/finance-decision', [
                'status' => 'Finance Rejected',
                'remarks' => 'Over budget',
            ])
            ->assertOk();

        $this->actingAs($winner)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.messages.1.body', 'Purchase order PO-2026-001 was rejected by finance.')
            ->assertJsonPath('data.messages.1.system', true);

        $this->actingAs($loser)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.messages', []);
    }

    public function test_failed_inspection_posts_a_system_message_to_the_winning_vendor(): void
    {
        [$winner] = $this->acmeVendor();
        [$loser] = $this->bdoVendor();
        $staff = $this->staff();
        $this->seedBrakePadQuotes($winner, $loser);

        $this->actingAs($staff)
            ->postJson('/api/quotations/QT-2026-001/select')
            ->assertOk();

        $this->actingAs($staff)
            ->postJson('/api/purchase-orders/PO-2026-001/finance-decision', [
                'status' => 'Finance Approved',
                'remarks' => 'Budget verified',
            ])
            ->assertOk();

        $this->actingAs($winner)
            ->postJson('/api/purchase-orders/PO-2026-001/confirm')
            ->assertOk();

        $deliveryId = $this->actingAs($staff)
            ->getJson('/api/deliveries')
            ->assertOk()
            ->json('data.0.id');

        $this->actingAs($staff)
            ->postJson("/api/deliveries/{$deliveryId}/inspect", [
                'inspectionResult' => 'Failed',
                'remarks' => 'Damaged',
                'itemsDelivered' => [[
                    'itemCode' => 'FLT-001',
                    'description' => 'Brake Pads',
                    'deliveredQuantity' => 0,
                    'condition' => 'Damaged',
                    'result' => 'Failed',
                ]],
            ])
            ->assertOk();

        $this->actingAs($winner)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath(
                'data.messages.3.body',
                'Delivery DEL-2026-001 for purchase order PO-2026-001 failed inspection and was rejected.'
            )
            ->assertJsonPath('data.messages.3.system', true);

        $this->actingAs($loser)
            ->getJson('/api/messages')
            ->assertOk()
            ->assertJsonPath('data.messages', []);
    }

    private function seedBrakePadQuotes(User $winner, User $loser): void
    {
        $pr = ProcurementRequest::query()->create([
            'pr_number' => 'PR-2026-001',
            'source_request' => 'MANUAL',
            'department' => 'Inventory Management',
            'item_code' => 'FLT-001',
            'item_name' => 'Brake Pads',
            'quantity' => 10,
            'reason' => 'low stock',
            'priority' => 'NORMAL',
            'status' => 'Quotation',
            'date_created' => now()->toDateString(),
            'estimated_cost' => 10000,
        ]);

        Quotation::query()->create([
            'quote_number' => 'QT-2026-001',
            'procurement_request_id' => $pr->id,
            'supplier_id' => $winner->supplier_id,
            'supplier_name' => 'Acme Parts',
            'item' => 'Brake Pads',
            'quantity' => 10,
            'unit_price' => 1000,
            'total_price' => 10000,
            'status' => 'Submitted',
        ]);
        Quotation::query()->create([
            'quote_number' => 'QT-2026-002',
            'procurement_request_id' => $pr->id,
            'supplier_id' => $loser->supplier_id,
            'supplier_name' => 'BDO Supplies',
            'item' => 'Brake Pads',
            'quantity' => 10,
            'unit_price' => 1100,
            'total_price' => 11000,
            'status' => 'Submitted',
        ]);
    }

    /**
     * @return array{0: User, 1: Supplier}
     */
    private function acmeVendor(): array
    {
        $supplier = Supplier::query()->create([
            'code' => 'SUP-001',
            'company_name' => 'Acme Parts',
            'contact_person' => 'Maria Santos',
            'status' => 'Active',
            'categories' => ['Fleet Consumables'],
        ]);
        $vendor = User::factory()->create([
            'name' => 'Maria Santos',
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);

        return [$vendor, $supplier];
    }

    /**
     * @return array{0: User, 1: Supplier}
     */
    private function bdoVendor(): array
    {
        $supplier = Supplier::query()->create([
            'code' => 'SUP-002',
            'company_name' => 'BDO Supplies',
            'contact_person' => 'Lina Mendoza',
            'status' => 'Active',
            'categories' => ['Fleet Consumables'],
        ]);
        $vendor = User::factory()->create([
            'name' => 'Lina Mendoza',
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $supplier->id,
        ]);

        return [$vendor, $supplier];
    }

    private function staff(): User
    {
        return User::factory()->create([
            'name' => 'Justin Cruz',
            'role' => User::ROLE_SUPPLY_CHAIN,
        ]);
    }
}
