<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('company_name');
            $table->string('contact_person');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('status', 32)->default('Active')->index();
            $table->decimal('rating', 3, 1)->default(0);
            $table->unsignedTinyInteger('quality_score')->default(0);
            $table->unsignedTinyInteger('responsiveness_score')->default(0);
            $table->unsignedTinyInteger('delivery_performance')->default(0);
            $table->unsignedTinyInteger('pricing_score')->default(0);
            $table->decimal('overall_score', 4, 1)->default(0);
            $table->json('categories')->nullable();
            $table->string('tax_id')->nullable();
            $table->string('sec_registration')->nullable();
            $table->string('bank_details')->nullable();
            $table->unsignedInteger('active_orders')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 32)->default('supply_chain')->index();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
        });

        Schema::create('storage_locations', function (Blueprint $table) {
            $table->id();
            $table->string('rack', 64);
            $table->string('shelf', 64);
            $table->string('bin', 64);
            $table->string('category')->nullable();
            $table->unsignedInteger('max_capacity')->default(0);
            $table->timestamps();

            $table->unique(['rack', 'shelf', 'bin']);
            $table->index('rack');
        });

        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('item_code', 64)->unique();
            $table->string('description');
            $table->string('category')->index();
            $table->unsignedInteger('quantity')->default(0);
            $table->unsignedInteger('min_stock_level')->default(0);
            $table->string('unit', 64)->default('Units');
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('cost', 12, 2)->default(0);
            $table->foreignId('storage_location_id')->nullable()->constrained()->nullOnDelete();
            $table->string('serial_number')->nullable();
            $table->string('warranty')->nullable();
            $table->string('condition', 64)->nullable();
            $table->string('status', 32)->default('NORMAL')->index();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('supply_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_number', 32)->unique();
            $table->string('requesting_department');
            $table->foreignId('inventory_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('item_code', 64)->index();
            $table->string('item_name');
            $table->string('category')->nullable();
            $table->unsignedInteger('quantity_requested');
            $table->date('required_date')->nullable();
            $table->string('priority', 32)->default('MEDIUM')->index();
            $table->string('stock_availability', 64)->nullable();
            $table->string('status', 64)->default('Received')->index();
            $table->string('requested_by')->nullable();
            $table->text('purpose')->nullable();
            $table->date('date_received')->nullable();
            $table->timestamps();
        });

        Schema::create('supply_request_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('supply_request_id')->constrained()->cascadeOnDelete();
            $table->string('logged_at', 32);
            $table->text('note');
            $table->timestamps();
        });

        Schema::create('procurement_requests', function (Blueprint $table) {
            $table->id();
            $table->string('pr_number', 32)->unique();
            $table->string('source_request')->nullable();
            $table->foreignId('supply_request_id')->nullable()->constrained()->nullOnDelete();
            $table->string('department');
            $table->string('item_code', 64)->index();
            $table->string('item_name');
            $table->unsignedInteger('quantity');
            $table->text('reason')->nullable();
            $table->string('priority', 32)->default('MEDIUM')->index();
            $table->string('status', 64)->default('For Procurement')->index();
            $table->date('date_created')->nullable();
            $table->decimal('estimated_cost', 12, 2)->default(0);
            $table->string('selected_supplier')->nullable();
            $table->string('po_number', 32)->nullable()->index();
            $table->timestamps();
        });

        Schema::create('quotations', function (Blueprint $table) {
            $table->id();
            $table->string('quote_number', 32)->unique();
            $table->foreignId('procurement_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->string('supplier_name');
            $table->string('item');
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('total_price', 12, 2);
            $table->string('warranty')->nullable();
            $table->unsignedInteger('delivery_time_days')->default(0);
            $table->decimal('quality_rating', 3, 1)->default(0);
            $table->string('payment_terms')->nullable();
            $table->string('status', 32)->default('Submitted')->index();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_number', 32)->unique();
            $table->foreignId('procurement_request_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->string('supplier');
            $table->string('contact_person')->nullable();
            $table->decimal('total_cost', 12, 2)->default(0);
            $table->string('budget_reference')->nullable();
            $table->string('payment_terms')->nullable();
            $table->text('procurement_reason')->nullable();
            $table->string('delivery_date')->nullable();
            $table->string('warranty')->nullable();
            $table->string('finance_approval_status', 64)->default('Pending Finance Approval')->index();
            $table->string('po_status', 64)->default('Pending Finance Approval')->index();
            $table->date('created_date')->nullable();
            $table->string('approver')->nullable();
            $table->text('finance_remarks')->nullable();
            $table->timestamps();
        });

        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->string('item_code', 64)->index();
            $table->string('description');
            $table->unsignedInteger('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('total', 12, 2);
            $table->unsignedInteger('delivered_qty')->default(0);
            $table->timestamps();
        });

        Schema::create('purchase_order_timeline_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->string('step');
            $table->string('step_date')->nullable();
            $table->string('status', 32)->default('pending');
            $table->timestamps();
        });

        Schema::create('deliveries', function (Blueprint $table) {
            $table->id();
            $table->string('delivery_number', 32)->unique();
            $table->foreignId('purchase_order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('po_number', 32)->index();
            $table->string('supplier');
            $table->string('delivery_date')->nullable();
            $table->unsignedInteger('items_count')->default(0);
            $table->string('status', 64)->default('Expected')->index();
            $table->string('carrier')->nullable();
            $table->string('tracking_number')->nullable();
            $table->string('inspection_result', 64)->nullable();
            $table->text('inspection_notes')->nullable();
            $table->timestamps();
        });

        Schema::create('delivery_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_id')->constrained()->cascadeOnDelete();
            $table->string('item_code', 64)->index();
            $table->string('description');
            $table->unsignedInteger('po_quantity')->default(0);
            $table->unsignedInteger('delivered_quantity')->default(0);
            $table->string('condition', 64)->nullable();
            $table->string('result', 64)->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
        });

        Schema::create('releases', function (Blueprint $table) {
            $table->id();
            $table->string('release_number', 32)->unique();
            $table->foreignId('supply_request_id')->nullable()->constrained()->nullOnDelete();
            $table->string('request_id', 32)->index();
            $table->string('requesting_department');
            $table->string('item_code', 64)->index();
            $table->string('item_name');
            $table->unsignedInteger('quantity_released');
            $table->string('approval_status')->nullable();
            $table->string('stock_status')->nullable();
            $table->string('release_date')->nullable();
            $table->string('released_to')->nullable();
            $table->string('dispatched_by')->nullable();
            $table->timestamps();
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->id();
            $table->string('movement_number', 32)->unique();
            $table->foreignId('inventory_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('item_code', 64)->index();
            $table->string('item_name');
            $table->string('movement_type', 64)->index();
            $table->unsignedInteger('quantity');
            $table->string('moved_at', 32);
            $table->string('location')->nullable();
            $table->string('reference')->nullable();
            $table->text('remarks')->nullable();
            $table->string('recorded_by')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_counts', function (Blueprint $table) {
            $table->id();
            $table->string('count_number', 32)->unique();
            $table->string('title');
            $table->date('count_date')->nullable();
            $table->string('location')->nullable();
            $table->string('status', 32)->default('In Progress')->index();
            $table->unsignedInteger('total_items_audited')->default(0);
            $table->unsignedInteger('discrepancy_count')->default(0);
            $table->timestamps();
        });

        Schema::create('stock_count_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_count_id')->constrained()->cascadeOnDelete();
            $table->string('item_code', 64)->index();
            $table->string('item_name');
            $table->unsignedInteger('system_qty')->default(0);
            $table->unsignedInteger('actual_qty')->default(0);
            $table->integer('variance')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('document_number', 32)->unique();
            $table->string('title');
            $table->string('type', 64)->index();
            $table->string('reference_number')->nullable();
            $table->string('supplier')->nullable();
            $table->date('issue_date')->nullable();
            $table->date('expiration_date')->nullable()->index();
            $table->string('status', 32)->default('Active')->index();
            $table->string('category')->nullable();
            $table->string('file_size', 32)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('supply_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('notification_number', 32)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->text('message');
            $table->string('logged_at', 32);
            $table->string('type', 32)->default('info')->index();
            $table->string('severity', 32)->default('info')->index();
            $table->boolean('is_read')->default(false)->index();
            $table->timestamps();
        });

        Schema::create('supplier_opportunities', function (Blueprint $table) {
            $table->id();
            $table->string('opportunity_number', 32)->unique();
            $table->string('pr_number', 32)->index();
            $table->foreignId('procurement_request_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->string('category')->nullable();
            $table->unsignedInteger('quantity')->default(0);
            $table->date('deadline')->nullable();
            $table->string('budget_range')->nullable();
            $table->string('status', 64)->default('Open for Quotation')->index();
            $table->text('requirements')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_opportunities');
        Schema::dropIfExists('supply_notifications');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('stock_count_items');
        Schema::dropIfExists('stock_counts');
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('releases');
        Schema::dropIfExists('delivery_items');
        Schema::dropIfExists('deliveries');
        Schema::dropIfExists('purchase_order_timeline_steps');
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('quotations');
        Schema::dropIfExists('procurement_requests');
        Schema::dropIfExists('supply_request_logs');
        Schema::dropIfExists('supply_requests');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('storage_locations');

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supplier_id');
            $table->dropColumn('role');
        });

        Schema::dropIfExists('suppliers');
    }
};
