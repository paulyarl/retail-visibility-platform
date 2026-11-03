-- Migration 374: Inventory import log — per-import watermark + result summary
--
-- Spec: docs/LocalBiz/POS_INGESTION_PARTNER_PATH_SPEC.md §4/§9
-- The CSV path is a full-snapshot sync; the log gives the UI a last-import
-- freshness label and gives future "no changes since last upload" fast-paths
-- a watermark to compare against.

CREATE TABLE IF NOT EXISTS public.inventory_imports (
  id            text PRIMARY KEY,
  tenant_id     text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  format        text NOT NULL,
  row_count     integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  unchanged_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  absent_count  integer NOT NULL DEFAULT 0,
  errors        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_imports_tenant
  ON public.inventory_imports (tenant_id, created_at DESC);
