<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->string('manual_file_path')->nullable()->after('warranty_file_path');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('manual_file_path')->nullable()->after('warranty_file_path');
        });
    }

    public function down(): void
    {
        Schema::table('quotations', function (Blueprint $table) {
            $table->dropColumn('manual_file_path');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('manual_file_path');
        });
    }
};
