<?php

namespace Database\Seeders;

use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ClearDemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $demoSupplierCodes = ['SUP-001', 'SUP-002', 'SUP-003', 'SUP-004', 'SUP-005', 'SUP-006'];
        $demoSupplierEmails = [
            'sales@navitrack.ph',
            'contact@techcomms.com.ph',
            'sales@omnitech.ph',
            'orders@petrolube.com.ph',
            'info@autotechtools.ph',
            'corp@papercorp.ph',
        ];

        DB::statement('TRUNCATE TABLE
            supplier_opportunities,
            supply_notifications,
            documents,
            stock_count_items,
            stock_counts,
            inventory_movements,
            releases,
            delivery_items,
            deliveries,
            purchase_order_timeline_steps,
            purchase_order_items,
            purchase_orders,
            quotations,
            procurement_requests,
            supply_request_logs,
            supply_requests,
            inventory_items,
            storage_locations,
            personal_access_tokens,
            password_reset_tokens,
            sessions,
            cache,
            cache_locks,
            jobs,
            job_batches,
            failed_jobs
            RESTART IDENTITY CASCADE');

        User::query()->whereIn('email', $demoSupplierEmails)->delete();
        Supplier::withTrashed()->whereIn('code', $demoSupplierCodes)->forceDelete();
    }
}
