<?php

namespace Tests\Feature;

use App\Mail\EmailOtpMail;
use App\Models\InventoryItem;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CompletesEmailOtp;
use Tests\TestCase;

class VendorRegistrationTest extends TestCase
{
    use CompletesEmailOtp;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    public function test_vendor_can_register_with_credentials(): void
    {
        Storage::fake('public');

        $response = $this->post('/api/vendor/register', $this->validPayload(), [
            'Accept' => 'application/json',
        ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'Pending Approval')
            ->assertJsonPath('data.email', 'vendor@acme.test')
            ->assertJsonPath('data.requiresOtp', true)
            ->assertJsonPath('data.emailMasked', 'v***@acme.test');

        $this->assertDatabaseHas('users', [
            'email' => 'vendor@acme.test',
            'role' => User::ROLE_SUPPLIER,
        ]);
        $this->assertNull(User::query()->where('email', 'vendor@acme.test')->value('email_verified_at'));
        Mail::assertSent(EmailOtpMail::class, fn (EmailOtpMail $mail) => $mail->hasTo('vendor@acme.test'));

        $supplier = Supplier::query()->where('email', 'vendor@acme.test')->first();
        $this->assertNotNull($supplier);
        $this->assertSame('Pending Approval', $supplier->status);
        $this->assertSame('123-456-789-000', $supplier->tax_id);
        $this->assertSame('SEC123456', $supplier->sec_registration);
        $this->assertStringContainsString('BDO', (string) $supplier->bank_details);
        $this->assertCount(2, $supplier->documents);
        $this->assertTrue($supplier->documents->contains('type', 'Business Permit'));
        $this->assertTrue($supplier->documents->contains('type', 'SEC/DTI Registration'));

        foreach ($supplier->documents as $document) {
            $this->assertNotNull($document->file_path);
            Storage::disk('public')->assertExists($document->file_path);
        }
    }

    public function test_registered_vendor_can_sign_in_to_vendor_portal(): void
    {
        Storage::fake('public');

        $this->registerAndVerifyVendor($this->validPayload())->assertOk();

        $this->loginWithOtp([
            'email' => 'vendor@acme.test',
            'password' => 'password1',
            'portal' => 'vendor',
        ])->assertOk()
            ->assertJsonPath('data.role', 'supplier')
            ->assertJsonPath('data.supplierStatus', 'Pending Approval');
    }

    public function test_vendor_login_accepts_mixed_case_email(): void
    {
        Storage::fake('public');

        $this->registerAndVerifyVendor($this->validPayload())->assertOk();

        $this->loginWithOtp([
            'email' => 'Vendor@Acme.TEST',
            'password' => 'password1',
            'portal' => 'vendor',
        ])->assertOk()
            ->assertJsonPath('data.email', 'vendor@acme.test');
    }

    public function test_registered_vendor_cannot_sign_in_to_inventory(): void
    {
        Storage::fake('public');

        $this->post('/api/vendor/register', $this->validPayload(), [
            'Accept' => 'application/json',
        ])->assertCreated();

        $this->postJson('/api/login', [
            'email' => 'vendor@acme.test',
            'password' => 'password1',
            'portal' => 'internal',
        ])->assertForbidden();
    }

    public function test_duplicate_email_is_rejected(): void
    {
        Storage::fake('public');
        User::factory()->create(['email' => 'vendor@acme.test']);

        $this->post('/api/vendor/register', $this->validPayload(), [
            'Accept' => 'application/json',
        ])->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_vendor_can_view_registered_profile(): void
    {
        Storage::fake('public');

        $this->post('/api/vendor/register', $this->validPayload(), [
            'Accept' => 'application/json',
        ])->assertCreated();

        $vendor = User::query()->where('email', 'vendor@acme.test')->first();

        $this->actingAs($vendor)
            ->getJson('/api/vendor/profile')
            ->assertOk()
            ->assertJsonPath('data.companyName', 'Acme Fleet Parts')
            ->assertJsonPath('data.taxId', '123-456-789-000')
            ->assertJsonPath('data.status', 'Pending Approval')
            ->assertJsonCount(2, 'data.credentials');
    }

    public function test_staff_can_approve_a_pending_vendor(): void
    {
        Storage::fake('public');

        $this->post('/api/vendor/register', $this->validPayload(), [
            'Accept' => 'application/json',
        ])->assertCreated();

        $supplier = Supplier::query()->where('email', 'vendor@acme.test')->first();
        $staff = User::factory()->create();

        $this->actingAs($staff)
            ->getJson('/api/suppliers/'.$supplier->code)
            ->assertOk()
            ->assertJsonPath('data.status', 'Pending Approval')
            ->assertJsonCount(2, 'data.credentials');

        $this->actingAs($staff)
            ->get('/api/documents/'.$supplier->documents()->first()->document_number.'/download')
            ->assertOk();

        $this->actingAs($staff)
            ->postJson('/api/suppliers/'.$supplier->code.'/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'Active');

        $this->assertSame('Active', $supplier->fresh()->status);
    }

    public function test_approving_a_vendor_invites_them_to_open_rfqs(): void
    {
        Storage::fake('public');

        $staff = User::factory()->create();
        $existingSupplier = Supplier::query()->create([
            'code' => 'SUP-300',
            'company_name' => 'Existing Vendor Co',
            'contact_person' => 'Old Vendor',
            'status' => 'Active',
            'categories' => ['Communication Devices'],
        ]);
        $existingVendor = User::factory()->create([
            'role' => User::ROLE_SUPPLIER,
            'supplier_id' => $existingSupplier->id,
        ]);

        InventoryItem::query()->create([
            'code' => 'INV-300',
            'item_code' => 'COM-300',
            'description' => 'toktok',
            'category' => 'Communication Devices',
            'quantity' => 2,
            'min_stock_level' => 5,
            'unit' => 'Units',
            'cost' => 500,
        ]);

        $openPr = $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-300',
                'quantity' => 10,
                'reason' => 'Restock handheld radios',
                'priority' => 'HIGH',
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests', [
                'itemCode' => 'COM-300',
                'quantity' => 4,
                'reason' => 'Draft request not sent yet',
                'priority' => 'NORMAL',
            ])
            ->assertCreated();

        $this->actingAs($staff)
            ->postJson('/api/procurement-requests/'.$openPr.'/send-to-vendors')
            ->assertOk();

        $this->actingAs($existingVendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.prNumber', $openPr);

        $this->post('/api/vendor/register', $this->validPayload(), [
            'Accept' => 'application/json',
        ])->assertCreated();

        $newVendor = User::query()->where('email', 'vendor@acme.test')->first();
        $supplier = Supplier::query()->where('email', 'vendor@acme.test')->first();

        $this->actingAs($newVendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($staff)
            ->postJson('/api/suppliers/'.$supplier->code.'/approve')
            ->assertOk()
            ->assertJsonPath('data.status', 'Active');

        $this->actingAs($newVendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.prNumber', $openPr)
            ->assertJsonPath('data.0.itemCode', 'COM-300')
            ->assertJsonPath('data.0.itemName', 'toktok');

        $this->actingAs($existingVendor)
            ->getJson('/api/opportunities')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.prNumber', $openPr);
    }

    public function test_registration_requires_permit_and_sec_files(): void
    {
        $payload = $this->validPayload();
        unset($payload['businessPermitFile'], $payload['secCertificateFile']);

        $this->post('/api/vendor/register', $payload, [
            'Accept' => 'application/json',
        ])->assertStatus(422);
    }

    public function test_vendor_can_register_with_others_category(): void
    {
        Storage::fake('public');

        $payload = $this->validPayload();
        $payload['email'] = 'others-vendor@acme.test';
        $payload['categories'] = ['Others'];

        $this->post('/api/vendor/register', $payload, [
            'Accept' => 'application/json',
        ])->assertCreated();

        $supplier = Supplier::query()->where('email', 'others-vendor@acme.test')->first();
        $this->assertNotNull($supplier);
        $this->assertSame(['Others'], $supplier->categories);
    }

    /**
     * @return array<string, mixed>
     */
    private function validPayload(): array
    {
        return [
            'companyName' => 'Acme Fleet Parts',
            'address' => '12 Supply Road, Quezon City',
            'categories' => ['Fleet Consumables', 'Communication Devices'],
            'contactPerson' => 'Ana Reyes',
            'phone' => '09171234567',
            'email' => 'vendor@acme.test',
            'taxId' => '123-456-789-000',
            'secRegistration' => 'SEC123456',
            'bankName' => 'BDO',
            'accountName' => 'Acme Fleet Parts Inc.',
            'accountNumber' => '1234-5678-90',
            'password' => 'password1',
            'password_confirmation' => 'password1',
            'businessPermitExpiresOn' => now()->addYear()->toDateString(),
            'businessPermitFile' => UploadedFile::fake()->create('permit.pdf', 80, 'application/pdf'),
            'secCertificateFile' => UploadedFile::fake()->create('sec.pdf', 80, 'application/pdf'),
        ];
    }
}
