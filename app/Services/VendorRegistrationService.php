<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Supplier;
use App\Models\User;
use App\Support\DocumentCode;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class VendorRegistrationService
{
    public function __construct(private NotificationService $notifications) {}

    public function register(array $data): Supplier
    {
        return DB::transaction(function () use ($data) {
            $supplier = Supplier::query()->create([
                'code' => DocumentCode::next('suppliers', 'code', 'SUP'),
                'company_name' => $data['companyName'],
                'contact_person' => $data['contactPerson'],
                'phone' => $data['phone'],
                'email' => $data['email'],
                'address' => $data['address'],
                'status' => 'Pending Approval',
                'categories' => $data['categories'],
                'tax_id' => $data['taxId'],
                'sec_registration' => $data['secRegistration'],
                'bank_details' => $this->formatBankDetails($data),
            ]);

            $user = User::query()->create([
                'name' => $data['contactPerson'],
                'email' => $data['email'],
                'password' => $data['password'],
                'role' => User::ROLE_SUPPLIER,
                'supplier_id' => $supplier->id,
            ]);

            $user->forceFill(['email_verified_at' => null])->save();

            $this->storeCredential(
                $supplier,
                $data['businessPermitFile'],
                'Business Permit',
                $supplier->company_name.' Business Permit',
                $data['businessPermitExpiresOn'] ?? null,
            );

            $this->storeCredential(
                $supplier,
                $data['secCertificateFile'],
                'SEC/DTI Registration',
                $supplier->company_name.' SEC/DTI Registration',
                null,
                $data['secRegistration'],
            );

            $this->notifications->create(
                'New Vendor Registration',
                "{$supplier->company_name} submitted portal credentials for review ({$supplier->code}).",
                'document',
                'info'
            );

            return $supplier->fresh(['users', 'documents']);
        });
    }

    private function formatBankDetails(array $data): string
    {
        return implode(' · ', array_filter([
            $data['bankName'] ?? null,
            filled($data['accountName'] ?? null) ? 'Acct name: '.$data['accountName'] : null,
            filled($data['accountNumber'] ?? null) ? 'Acct no: '.$data['accountNumber'] : null,
        ]));
    }

    private function storeCredential(
        Supplier $supplier,
        UploadedFile $file,
        string $type,
        string $title,
        ?string $expirationDate = null,
        ?string $referenceNumber = null,
    ): Document {
        $number = DocumentCode::next('documents', 'document_number', 'DOC');
        $path = $this->storePublicUpload($file, $number);

        return Document::query()->create([
            'document_number' => $number,
            'title' => $title,
            'type' => $type,
            'reference_number' => $referenceNumber,
            'supplier' => $supplier->company_name,
            'issue_date' => now()->toDateString(),
            'expiration_date' => $expirationDate,
            'status' => 'Active',
            'category' => 'Vendor Credential',
            'file_size' => $this->humanFileSize((int) $file->getSize()),
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'source' => 'registration',
            'supplier_id' => $supplier->id,
        ]);
    }

    private function storePublicUpload(UploadedFile $file, string $basename): string
    {
        $extension = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension() ?: 'pdf');
        $allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
        if (! in_array($extension, $allowed, true)) {
            $extension = 'pdf';
        }

        return $file->storeAs('vendor-credentials', $basename.'.'.$extension, 'public');
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
}
