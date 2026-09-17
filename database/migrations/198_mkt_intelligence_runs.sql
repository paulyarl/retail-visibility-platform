-- Migration 198: Intelligence Run Tracking
--
-- Creates mkt_intelligence_runs for tracking each Intelligence Seek execution
-- (spec §41). A run captures the full resolution context: which profile was
-- active, which focus was used, which prompt version produced the discovery,
-- and links to the execution that holds the raw output.
--
-- Run records are immutable historical artifacts — they reference the exact
-- profile version used (not the profile id alone), so reproducibility is
-- guaranteed even after the profile is updated or retired.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate
--
-- See docs/LocalBiz/marketing_ops_seek_intelligence_scope_sprint_plan.md §4 (Migration 198)

BEGIN;

CREATE TABLE IF NOT EXISTS mkt_intelligence_runs (
  id                    VARCHAR(64)  NOT NULL,
  campaign_id           VARCHAR(255) NOT NULL,
  execution_id          VARCHAR(255),
  profile_id            VARCHAR(64),
  profile_version       INT,
  intelligence_mode     VARCHAR(20)  NOT NULL DEFAULT 'none',
  focus                 VARCHAR(20)  NOT NULL DEFAULT 'emerging',
  prompt_version        INT,
  prompt_body_hash      VARCHAR(64),
  candidate_count       INT          NOT NULL DEFAULT 0,
  qualifying_count      INT          NOT NULL DEFAULT 0,
  hold_count            INT          NOT NULL DEFAULT 0,
  metadata              JSONB,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_mkt_intelligence_runs PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_intel_runs_campaign
  ON mkt_intelligence_runs (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mkt_intel_runs_profile
  ON mkt_intelligence_runs (profile_id, profile_version)
  WHERE profile_id IS NOT NULL;

-- Verification query (run manually after applying):
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'mkt_intelligence_runs' ORDER BY ordinal_position;

COMMIT;
