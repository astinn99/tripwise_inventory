<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('file_path')->nullable()->after('file_size');
            $table->string('original_filename')->nullable()->after('file_path');
            $table->string('source', 32)->nullable()->after('original_filename');
            $table->unsignedInteger('warranty_months')->nullable()->after('source');
            $table->foreignId('inventory_item_id')->nullable()->after('warranty_months')->constrained()->nullOnDelete();
            $table->foreignId('purchase_order_id')->nullable()->after('inventory_item_id')->constrained()->nullOnDelete();
            $table->foreignId('quotation_id')->nullable()->after('purchase_order_id')->constrained()->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->after('quotation_id')->constrained()->nullOnDelete();
            $table->timestamp('last_alerted_at')->nullable()->after('supplier_id');
            $table->string('last_alert_window', 16)->nullable()->after('last_alerted_at');
        });

        Schema::table('quotations', function (Blueprint $table) {
            $table->unsignedInteger('warranty_months')->nullable()->after('warranty');
            $table->string('warranty_file_path')->nullable()->after('warranty_months');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->unsignedInteger('warranty_months')->nullable()->after('warranty');
            $table->string('warranty_file_path')->nullable()->after('warranty_months');
        });

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->date('warranty_expires_on')->nullable()->after('warranty');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('inventory_item_id');
            $table->dropConstrainedForeignId('purchase_order_id');
            $table->dropConstrainedForeignId('quotation_id');
            $table->dropConstrainedForeignId('supplier_id');
            $table->dropColumn([
                'file_path',
                'original_filename',
                'source',
                'warranty_months',
                'last_alerted_at',
                'last_alert_window',
            ]);
        });

        Schema::table('quotations', function (Blueprint $table) {
            $table->dropColumn(['warranty_months', 'warranty_file_path']);
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['warranty_months', 'warranty_file_path']);
        });

        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn('warranty_expires_on');
        });
    }
};
