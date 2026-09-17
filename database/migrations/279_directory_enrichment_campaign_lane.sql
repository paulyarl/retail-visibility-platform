-- Migration 279: Directory Enrichment Campaign Lane
--
-- Supports enrichment-as-a-campaign (see
-- docs/LocalBiz/DIRECTORY_ENRICHMENT_CAMPAIGNS_SPRINT_PLAN.md):
--
--   1. Resync directory_category_enrichment.trigger_source CHECK with the
--      app-layer enum. Adds:
--        - 'on_demand'    — fixes a live bug: LocationMarketEnrichmentService
--                          .getLocation() already writes 'on_demand' on lazy
--                          public reads (GET /api/public/directory/location-
--                          enrichment); the 265 CHECK rejects it (23514 →
--                          500 on the public route).
--        - 'campaign_run' — rows produced by a directory_enrichment campaign
--                          execution (internal AI or external import).
--   2. Resync directory_listing_enrichment_log.trigger_source CHECK with the
--      full set including 'on_demand' (defensive symmetry) and 'campaign_run'
--      (the campaign fan-out writes listing log rows with this source).
--   3. Adds campaign lineage columns to directory_category_enrichment:
--        - source_campaign_id   — the directory_enrichment campaign
--        - source_execution_id  — the mkt_prompt_executions_list row
--   4. Adds body_copy — visible on-page copy produced by AI enrichment runs,
--      distinct from the ≤155-char meta `description`.
--
-- The 265 CHECKs were inline column constraints; Postgres auto-named them
-- <table>_trigger_source_check. We drop those and re-add under chk_* names
-- matching the codebase convention (migrations 256/264/270 pattern).
--
-- Idempotent (DROP CONSTRAINT IF EXISTS / ADD COLUMN IF NOT EXISTS).

BEGIN;

-- ── 1. directory_category_enrichment.trigger_source ──────────────────────────

ALTER TABLE directory_category_enrichment
  DROP CONSTRAINT IF EXISTS directory_category_enrichment_trigger_source_check;
ALTER TABLE directory_category_enrichment
  DROP CONSTRAINT IF EXISTS chk_category_enrichment_trigger_source;
ALTER TABLE directory_category_enrichment
  ADD CONSTRAINT chk_category_enrichment_trigger_source
  CHECK (trigger_source IN (
    'manual', 'profile_activated', 'on_demand', 'campaign_run'
  ));

-- ── 2. directory_listing_enrichment_log.trigger_source ───────────────────────

ALTER TABLE directory_listing_enrichment_log
  DROP CONSTRAINT IF EXISTS directory_listing_enrichment_log_trigger_source_check;
ALTER TABLE directory_listing_enrichment_log
  DROP CONSTRAINT IF EXISTS chk_listing_enrichment_log_trigger_source;
ALTER TABLE directory_listing_enrichment_log
  ADD CONSTRAINT chk_listing_enrichment_log_trigger_source
  CHECK (trigger_source IN (
    'manual', 'profile_activated', 'operator_override', 'operator_reset',
    'owner_edit', 'on_demand', 'campaign_run'
  ));

-- ── 3. Campaign lineage columns ──────────────────────────────────────────────

ALTER TABLE directory_category_enrichment
  ADD COLUMN IF NOT EXISTS source_campaign_id VARCHAR(255);
ALTER TABLE directory_category_enrichment
  ADD COLUMN IF NOT EXISTS source_execution_id VARCHAR(255);
ALTER TABLE directory_category_enrichment
  ADD COLUMN IF NOT EXISTS body_copy TEXT;

CREATE INDEX IF NOT EXISTS idx_category_enrichment_source_campaign
  ON directory_category_enrichment (source_campaign_id)
  WHERE source_campaign_id IS NOT NULL;

COMMIT;

-- Rollback:
--   ALTER TABLE directory_category_enrichment
--     DROP CONSTRAINT IF EXISTS chk_category_enrichment_trigger_source;
--   ALTER TABLE directory_category_enrichment
--     ADD CONSTRAINT chk_category_enrichment_trigger_source
--     CHECK (trigger_source IN ('manual', 'profile_activated'));
--   ALTER TABLE directory_listing_enrichment_log
--     DROP CONSTRAINT IF EXISTS chk_listing_enrichment_log_trigger_source;
--   ALTER TABLE directory_listing_enrichment_log
--     ADD CONSTRAINT chk_listing_enrichment_log_trigger_source
--     CHECK (trigger_source IN ('manual','profile_activated','operator_override','operator_reset','owner_edit'));
--   DROP INDEX IF EXISTS idx_category_enrichment_source_campaign;
--   ALTER TABLE directory_category_enrichment
--     DROP COLUMN IF EXISTS source_execution_id,
--     DROP COLUMN IF EXISTS source_campaign_id;
