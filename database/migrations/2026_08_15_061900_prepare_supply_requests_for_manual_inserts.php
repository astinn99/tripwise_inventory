<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement("ALTER TABLE supply_requests ALTER COLUMN request_number DROP NOT NULL");
        DB::statement("ALTER TABLE supply_requests ALTER COLUMN item_code DROP NOT NULL");
        DB::statement("ALTER TABLE supply_requests ALTER COLUMN item_name DROP NOT NULL");
        DB::statement("ALTER TABLE supply_requests ALTER COLUMN status SET DEFAULT 'Pending'");
        DB::statement("ALTER TABLE supply_requests ALTER COLUMN priority SET DEFAULT 'MEDIUM'");
        DB::statement("ALTER TABLE supply_requests ALTER COLUMN stock_availability SET DEFAULT 'Pending'");
        DB::statement("ALTER TABLE supply_requests ALTER COLUMN date_received SET DEFAULT CURRENT_DATE");
        DB::statement("ALTER TABLE supply_requests ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP");
        DB::statement("ALTER TABLE supply_requests ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP");

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION supply_requests_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    item RECORD;
    year_head text;
    next_n integer;
BEGIN
    IF NEW.inventory_item_id IS NOT NULL THEN
        SELECT * INTO item FROM inventory_items WHERE id = NEW.inventory_item_id AND deleted_at IS NULL;
    ELSIF NEW.item_code IS NOT NULL AND BTRIM(NEW.item_code) <> '' THEN
        SELECT * INTO item FROM inventory_items WHERE item_code = BTRIM(NEW.item_code) AND deleted_at IS NULL;
    END IF;

    IF item IS NOT NULL THEN
        NEW.inventory_item_id := COALESCE(NEW.inventory_item_id, item.id);
        IF NEW.item_code IS NULL OR BTRIM(NEW.item_code) = '' THEN
            NEW.item_code := item.item_code;
        END IF;
        IF NEW.item_name IS NULL OR BTRIM(NEW.item_name) = '' THEN
            NEW.item_name := item.description;
        END IF;
        IF NEW.category IS NULL OR BTRIM(NEW.category) = '' THEN
            NEW.category := item.category;
        END IF;
    END IF;

    IF NEW.request_number IS NULL OR BTRIM(NEW.request_number) = '' THEN
        year_head := 'REQ-' || to_char(CURRENT_DATE, 'YYYY') || '-';
        SELECT COALESCE(MAX(CAST(substring(request_number FROM '([0-9]+)$') AS integer)), 0) + 1
          INTO next_n
          FROM supply_requests
         WHERE request_number LIKE year_head || '%';
        NEW.request_number := year_head || lpad(next_n::text, 3, '0');
    END IF;

    IF NEW.status IS NULL OR BTRIM(NEW.status) = '' THEN
        NEW.status := 'Pending';
    END IF;
    IF NEW.priority IS NULL OR BTRIM(NEW.priority) = '' THEN
        NEW.priority := 'MEDIUM';
    END IF;
    IF NEW.stock_availability IS NULL OR BTRIM(NEW.stock_availability) = '' THEN
        NEW.stock_availability := 'Pending';
    END IF;

    NEW.date_received := COALESCE(NEW.date_received, CURRENT_DATE);
    NEW.created_at := COALESCE(NEW.created_at, CURRENT_TIMESTAMP);
    NEW.updated_at := COALESCE(NEW.updated_at, CURRENT_TIMESTAMP);

    RETURN NEW;
END;
$$;
SQL);

        DB::unprepared(<<<'SQL'
DROP TRIGGER IF EXISTS supply_requests_before_insert ON supply_requests;
CREATE TRIGGER supply_requests_before_insert
    BEFORE INSERT ON supply_requests
    FOR EACH ROW
    EXECUTE FUNCTION supply_requests_before_insert();
SQL);
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared('DROP TRIGGER IF EXISTS supply_requests_before_insert ON supply_requests');
        DB::unprepared('DROP FUNCTION IF EXISTS supply_requests_before_insert()');
        DB::statement('ALTER TABLE supply_requests ALTER COLUMN request_number SET NOT NULL');
        DB::statement('ALTER TABLE supply_requests ALTER COLUMN item_code SET NOT NULL');
        DB::statement('ALTER TABLE supply_requests ALTER COLUMN item_name SET NOT NULL');
        DB::statement('ALTER TABLE supply_requests ALTER COLUMN status SET DEFAULT \'Pending\'');
        DB::statement('ALTER TABLE supply_requests ALTER COLUMN priority SET DEFAULT \'MEDIUM\'');
        DB::statement('ALTER TABLE supply_requests ALTER COLUMN stock_availability DROP DEFAULT');
        DB::statement('ALTER TABLE supply_requests ALTER COLUMN date_received DROP DEFAULT');
        DB::statement('ALTER TABLE supply_requests ALTER COLUMN created_at DROP DEFAULT');
        DB::statement('ALTER TABLE supply_requests ALTER COLUMN updated_at DROP DEFAULT');
    }
};
