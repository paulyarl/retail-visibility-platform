#!/usr/bin/env bash
set -euo pipefail

: "${DB_URL:?Set DB_URL to your Postgres connection string}"

echo "[v3.4] Starting migrations..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/v3.4/001_enums.up.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/v3.4/002_table_alter.up.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/v3.4/003_backfill_and_notnull.up.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/v3.4/004_triggers.up.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/v3.4/005_rls.up.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/v3.4/006_view_swis_feed.up.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/migrations/v3.4/007_diagnostics.up.sql

echo "[v3.4] Building large‑table indexes concurrently..."
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_item_updated_at ON inventory_item(updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_item_availability ON inventory_item(availability);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_inventory_item_tenant_sku ON inventory_item(tenant_id, sku);
CREATE INDEX CONCURRENTLY IF NOT EXISTS gin_inventory_item_category_path ON inventory_item USING GIN(category_path);
SQL

echo "[v3.4] Validating CHECK constraints..."
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE inventory_item VALIDATE CONSTRAINT price_nonnegative;
ALTER TABLE inventory_item VALIDATE CONSTRAINT qty_nonnegative;
ALTER TABLE inventory_item VALIDATE CONSTRAINT currency_len;
SQL

echo "[v3.4] Done. Remember to set FF_SCHEMA_V34_READY=true when ready."
