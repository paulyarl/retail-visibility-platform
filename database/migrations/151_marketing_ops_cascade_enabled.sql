-- ──────────────────────────────────────────────────────────────────────────
-- Migration 151: Add cascade_enabled + cascade_config to mkt_campaigns_list
--
-- Enables operators to opt-in a review campaign to the multi-channel
-- cascade (email → SMS → DM). When enabled, the ReviewCascadeService
-- takes over follow-ups and MarketingAutoFollowUpScheduler skips it.
--
-- cascade_config stores per-campaign step timing overrides as JSON:
--   { "steps": [{ "day": 1, "channel": "email" }, ...] }
-- NULL = use the default Day 1/2/4 sequence.
--
-- RLS: mkt_campaigns_list does NOT enable RLS (Marketing Ops namespace
-- exception — see .devin/skills/manual-sql-migration-policy.md §4).
--
-- Rollback:
--   ALTER TABLE mkt_campaigns_list DROP COLUMN IF EXISTS cascade_enabled;
--   ALTER TABLE mkt_campaigns_list DROP COLUMN IF EXISTS cascade_config;
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS cascade_enabled Boolean NOT NULL DEFAULT false;

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS cascade_config Json;

-- Index for the scheduler to quickly find cascade-enabled campaigns
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_cascade_enabled
  ON mkt_campaigns_list (cascade_enabled)
  WHERE cascade_enabled = true;

-- ──────────────────────────────────────────────────────────────────────────
-- Verification:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'mkt_campaigns_list'
--   AND column_name IN ('cascade_enabled', 'cascade_config');
-- ──────────────────────────────────────────────────────────────────────────
