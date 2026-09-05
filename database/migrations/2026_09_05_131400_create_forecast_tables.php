<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('forecast_runs', function (Blueprint $table) {
            $table->id();
            $table->string('item_code', 64)->index();
            $table->string('item_name');
            $table->unsignedSmallInteger('horizon_days');
            $table->string('model', 16);
            $table->unsignedSmallInteger('lead_time_days');
            $table->unsignedInteger('reorder_qty')->default(0);
            $table->date('stockout_on')->nullable();
            $table->string('procurement_pr_number', 32)->nullable();
            $table->integer('current_qty')->default(0);
            $table->integer('min_stock_level')->default(0);
            $table->timestamp('generated_at');
            $table->string('status', 16)->default('ready');
            $table->text('error')->nullable();
            $table->timestamps();

            $table->unique(['item_code', 'horizon_days']);
        });

        Schema::create('forecast_points', function (Blueprint $table) {
            $table->id();
            $table->foreignId('forecast_run_id')->constrained('forecast_runs')->cascadeOnDelete();
            $table->date('ds')->index();
            $table->integer('actual_demand')->nullable();
            $table->decimal('yhat', 12, 4)->nullable();
            $table->decimal('yhat_lower', 12, 4)->nullable();
            $table->decimal('yhat_upper', 12, 4)->nullable();
            $table->integer('on_hand_actual')->nullable();
            $table->integer('on_hand_projected')->nullable();
            $table->integer('inbound')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('forecast_points');
        Schema::dropIfExists('forecast_runs');
    }
};
