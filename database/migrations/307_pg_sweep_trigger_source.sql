-- Migration 307: pg_sweep trigger_source
--
-- ProvingGroundShelfSweepService writes directory_category_enrichment rows
-- (market rows, per-city '__location__' rows, and the national
-- ('__location__','__all__','__all__') refresh) and
-- directory_listing_enrichment_log rows (the listing fan-out inside
-- enrichMarket) with trigger_source='pg_sweep'. Migration 279 resynced both
-- CHECK constraints to the app-layer enum but predates the sweep lane, so
-- every sweep write fails 23514 — the national refresh errors on every run
-- and any market/location fill is rejected outright.
--
-- Adds 'pg_sweep' to both constraints. Idempotent.

BEGIN;

ALTER TABLE directory_category_enrichment
  DROP CONSTRAINT IF EXISTS chk_category_enrichment_trigger_source;
ALTER TABLE directory_category_enrichment
  ADD CONSTRAINT chk_category_enrichment_trigger_source
  CHECK (trigger_source IN (
    'manual', 'profile_activated', 'on_demand', 'campaign_run', 'pg_sweep'
  ));

ALTER TABLE directory_listing_enrichment_log
  DROP CONSTRAINT IF EXISTS chk_listing_enrichment_log_trigger_source;
ALTER TABLE directory_listing_enrichment_log
  ADD CONSTRAINT chk_listing_enrichment_log_trigger_source
  CHECK (trigger_source IN (
    'manual', 'profile_activated', 'operator_override', 'operator_reset',
    'owner_edit', 'on_demand', 'campaign_run', 'pg_sweep'
  ));

COMMIT;

-- Rollback:
--   ALTER TABLE directory_category_enrichment
--     DROP CONSTRAINT IF EXISTS chk_category_enrichment_trigger_source;
--   ALTER TABLE directory_category_enrichment
--     ADD CONSTRAINT chk_category_enrichment_trigger_source
--     CHECK (trigger_source IN ('manual','profile_activated','on_demand','campaign_run'));
--   ALTER TABLE directory_listing_enrichment_log
--     DROP CONSTRAINT IF EXISTS chk_listing_enrichment_log_trigger_source;
--   ALTER TABLE directory_listing_enrichment_log
--     ADD CONSTRAINT chk_listing_enrichment_log_trigger_source
--     CHECK (trigger_source IN ('manual','profile_activated','operator_override','operator_reset','owner_edit','on_demand','campaign_run'));
