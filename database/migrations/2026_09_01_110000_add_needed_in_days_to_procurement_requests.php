<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('procurement_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('procurement_requests', 'needed_in_days')) {
                $table->unsignedSmallInteger('needed_in_days')->nullable()->after('priority');
            }
            if (! Schema::hasColumn('procurement_requests', 'rfq_overdue_notified_at')) {
                $table->timestamp('rfq_overdue_notified_at')->nullable()->after('po_number');
            }
        });

        foreach (DB::table('procurement_requests')->select('id', 'priority', 'needed_in_days')->get() as $row) {
            if ($row->needed_in_days) {
                continue;
            }

            $priority = strtoupper(trim((string) $row->priority));
            $days = match ($priority) {
                'URGENT' => 3,
                'HIGH' => 7,
                default => 14,
            };

            DB::table('procurement_requests')->where('id', $row->id)->update(['needed_in_days' => $days]);
        }
    }

    public function down(): void
    {
        Schema::table('procurement_requests', function (Blueprint $table) {
            if (Schema::hasColumn('procurement_requests', 'rfq_overdue_notified_at')) {
                $table->dropColumn('rfq_overdue_notified_at');
            }
            if (Schema::hasColumn('procurement_requests', 'needed_in_days')) {
                $table->dropColumn('needed_in_days');
            }
        });
    }
};
