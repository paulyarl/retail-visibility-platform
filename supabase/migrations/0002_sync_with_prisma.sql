-- Idempotent sync to align existing tables with Prisma schema
-- Run this if 0001 was applied on a database that already had base tables

-- 1) Ensure Role enum exists and cast users.role to enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('ADMIN', 'STAFF', 'VIEWER');
  END IF;
END $$;

ALTER TABLE IF EXISTS users
  ALTER COLUMN role TYPE role USING role::role;

-- 2) inventory_items: add missing columns and indexes
ALTER TABLE IF EXISTS inventory_items
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_tenant_sku
  ON inventory_items(tenant_id, sku);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_updated
  ON inventory_items(tenant_id, updated_at);

-- 3) photo_assets: add missing columns and indexes
ALTER TABLE IF EXISTS photo_assets
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS bytes integer,
  ADD COLUMN IF NOT EXISTS exif_removed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_photo_assets_tenant_item
  ON photo_assets(tenant_id, inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_photo_assets_captured_at
  ON photo_assets(captured_at);

-- 4) sync_jobs table (create if missing) with indexes and RLS
CREATE TABLE IF NOT EXISTS sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  target text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  attempt integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_status_updated
  ON sync_jobs(tenant_id, status, updated_at);

ALTER TABLE IF EXISTS sync_jobs ENABLE ROW LEVEL SECURITY;
