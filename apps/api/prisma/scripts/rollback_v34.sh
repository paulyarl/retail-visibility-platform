#!/usr/bin/env bash
set -euo pipefail
: "${DB_URL:?Set DB_URL to your Postgres connection string}"

echo "[v3.4] Rolling back views & triggers..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DROP VIEW IF EXISTS swis_feed_quality_report;" || true
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DROP VIEW IF EXISTS swis_feed_view;" || true
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DROP TRIGGER IF EXISTS trg_inventory_item_qty_avail ON inventory_item;" || true
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DROP TRIGGER IF EXISTS trg_inventory_item_touch ON inventory_item;" || true
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DROP FUNCTION IF EXISTS derive_availability_from_qty();" || true
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "DROP FUNCTION IF EXISTS touch_updated_at();" || true

echo "[v3.4] Dropping concurrent indexes..."
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP INDEX CONCURRENTLY IF EXISTS uniq_inventory_item_tenant_sku;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_item_availability;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_item_updated_at;
DROP INDEX CONCURRENTLY IF EXISTS gin_inventory_item_category_path;
SQL

echo "[v3.4] Reverting table & constraints..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE inventory_item DROP CONSTRAINT IF EXISTS price_nonnegative;" || true
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE inventory_item DROP CONSTRAINT IF EXISTS qty_nonnegative;" || true
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE inventory_item DROP CONSTRAINT IF EXISTS currency_len;" || true
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE inventory_item DROP COLUMN IF EXISTS audit_log_id, DROP COLUMN IF EXISTS synced_at, DROP COLUMN IF EXISTS sync_status, DROP COLUMN IF EXISTS visibility, DROP COLUMN IF EXISTS location_id, DROP COLUMN IF EXISTS merchant_name, DROP COLUMN IF EXISTS mpn, DROP COLUMN IF EXISTS gtin, DROP COLUMN IF EXISTS condition, DROP COLUMN IF EXISTS image_url, DROP COLUMN IF EXISTS quantity, DROP COLUMN IF EXISTS availability, DROP COLUMN IF EXISTS currency, DROP COLUMN IF EXISTS price, DROP COLUMN IF EXISTS category_path, DROP COLUMN IF EXISTS description, DROP COLUMN IF EXISTS brand, DROP COLUMN IF EXISTS title, DROP COLUMN IF EXISTS sku, DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS updated_at;" || true

echo "[v3.4] Rollback complete."
