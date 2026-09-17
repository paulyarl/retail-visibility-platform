-- 292_backfill_directory_seed_event_context.sql
--
-- Layer 2 of the directory presence traffic surface
-- (docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md §2, §4).
--
-- Tags historical `user_behavior_simple` directory_detail rows for seed
-- tenants with `context->>'listing_origin' = 'directory_seed'` and
-- `context->>'surface' = 'directory_seed'`, so the traffic readout can split
-- unclaimed-seed traffic from claimed-tenant traffic without joining
-- `directory_presence_seeds` on every query.
--
-- New events are tagged at the source: StoreViewTracker now stamps
-- `listing_origin` + `surface` on both /place (directory_seed) and /directory
-- (directory_claimed) call sites.
--
-- Idempotent: only rows where `context->>'surface' IS NULL` are touched, so
-- re-running is safe and already-tagged rows are preserved.
--
-- Apply against both `local` and `prd`:
--   psql "$DATABASE_URL" -f database/migrations/292_backfill_directory_seed_event_context.sql

UPDATE user_behavior_simple ub
SET context = COALESCE(ub.context, '{}'::jsonb) || jsonb_build_object(
  'listing_origin', 'directory_seed',
  'surface', 'directory_seed'
)
WHERE ub.entity_type = 'store'
  AND ub.page_type = 'directory_detail'
  AND (ub.context->>'surface') IS NULL
  AND EXISTS (
    SELECT 1
    FROM directory_presence_seeds s
    WHERE s.tenant_id = ub.entity_id
  );

-- Expression index for the readout's surface filter (the existing GIN index
-- on `context` does not accelerate `context->>'surface' = ...`). Partial to
-- the directory_detail/store rows the readout queries.
CREATE INDEX IF NOT EXISTS idx_ubs_directory_detail_surface
  ON user_behavior_simple ((context->>'surface'), timestamp DESC)
  WHERE entity_type = 'store' AND page_type = 'directory_detail';
