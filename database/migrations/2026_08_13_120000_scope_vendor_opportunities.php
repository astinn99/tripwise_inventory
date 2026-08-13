<?php

use App\Models\Quotation;
use App\Models\Supplier;
use App\Models\SupplierOpportunity;
use App\Support\DocumentCode;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('supplier_opportunities', function (Blueprint $table) {
            $table->foreignId('supplier_id')->nullable()->after('procurement_request_id')->constrained()->nullOnDelete();
        });

        $opportunities = SupplierOpportunity::query()->whereNull('supplier_id')->get();

        foreach ($opportunities as $opportunity) {
            $supplierIds = Quotation::query()
                ->whereNotNull('supplier_id')
                ->whereHas('procurementRequest', fn ($query) => $query->where('pr_number', $opportunity->pr_number))
                ->pluck('supplier_id')
                ->unique()
                ->values();

            if ($supplierIds->isEmpty()) {
                $supplierIds = Supplier::query()
                    ->where('created_at', '<=', $opportunity->created_at ?? now())
                    ->get()
                    ->filter(fn (Supplier $supplier) => in_array($opportunity->category, $supplier->categories ?? [], true))
                    ->pluck('id')
                    ->values();
            }

            if ($supplierIds->isEmpty()) {
                continue;
            }

            $opportunity->update(['supplier_id' => $supplierIds->first()]);

            foreach ($supplierIds->skip(1) as $supplierId) {
                $copy = $opportunity->replicate();
                $copy->opportunity_number = DocumentCode::next('supplier_opportunities', 'opportunity_number', 'OPP');
                $copy->supplier_id = $supplierId;
                $copy->save();
            }
        }
    }

    public function down(): void
    {
        Schema::table('supplier_opportunities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supplier_id');
        });
    }
};
