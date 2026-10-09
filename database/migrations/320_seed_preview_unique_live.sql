-- 320_seed_preview_unique_live.sql
--
-- B-5 of the seed-preview-storefront spec
-- (docs/LocalBiz/SEED_PREVIEW_STOREFRONT_SPEC.md): at most one LIVE seed
-- preview per source seed tenant. The service serializes concurrent creates
-- with a per-seed advisory lock; this partial unique index is the DB-level
-- guarantee for any path that bypasses the service.
--
-- A closed/expired preview releases the slot (location_status != 'active'),
-- so Regenerate works after retirement.
--
-- Idempotent (IF NOT EXISTS). Apply manually via the Supabase SQL Editor,
-- staging then production, using plain Run (see manual-sql-migration-policy).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_live_seed_preview_per_source
  ON tenants (demo_source_tenant_id)
  WHERE is_demo IS TRUE
    AND demo_template = 'seed_preview'
    AND location_status = 'active';

COMMIT;
