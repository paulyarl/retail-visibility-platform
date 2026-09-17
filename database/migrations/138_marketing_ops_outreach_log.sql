-- ============================================================
-- Migration 138: Marketing Ops — Outreach Log & Follow-Up Rollups
-- ============================================================
-- Description:
--   - Creates mkt_outreach_log table for per-campaign contact attempts
--     during preview_built/shown stages, with message + fresh-data
--     snapshots so historical contacts are reviewable in Ops.
--   - Adds rollup columns (last_contacted_at, next_follow_up_at,
--     last_contact_channel) to mkt_campaigns_list for at-a-glance
--     visibility on the list view and pipeline.
-- Prerequisite: 137_marketing_ops_contact_fields.sql applied
-- Date: 2026-07-30
-- ============================================================

-- ============================================================
-- STEP 1: Outreach log table
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_outreach_log (
  id                      VARCHAR(255)  PRIMARY KEY,          -- mol-{nanoid}
  campaign_id             VARCHAR(255)  NOT NULL,
  stage_at_time           VARCHAR(50)   NOT NULL,             -- 'preview_built' | 'shown'
  contact_channel         VARCHAR(20)   NOT NULL,             -- 'phone' | 'email' | 'website' | 'social' | 'in_person' | 'other'
  contact_date            DATE          NOT NULL,
  outcome                 VARCHAR(30)   NOT NULL,             -- 'reached' | 'no_answer' | 'left_message' | 'interested' | 'not_interested' | 'callback_scheduled' | 'other'
  follow_up_date          DATE,                               -- nullable: scheduled follow-up
  follow_up_completed_at  TIMESTAMPTZ,                        -- nullable: set when a later log entry fulfills this follow-up
  notes                   TEXT,
  contacted_by            VARCHAR(255),
  -- Message + fresh-data snapshot (so historical contacts are reviewable in Ops)
  message_snapshot        TEXT,                               -- the rendered message/preview body sent to the prospect
  message_subject         VARCHAR(255),                       -- for email channel
  data_snapshot           JSONB,                              -- fresh audit data used at contact time: {review_count, average_rating, unaddressed_reviews, ...}
  data_fresh_at           TIMESTAMPTZ,                        -- when the snapshot data was fetched (proves freshness)
  preview_token           VARCHAR(255),                       -- optional: link to the mkt_deliverable_preview_tokens row if a preview URL was sent
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_outreach_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_outreach_campaign ON mkt_outreach_log(campaign_id, contact_date DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_outreach_followup ON mkt_outreach_log(follow_up_date) WHERE follow_up_date IS NOT NULL AND follow_up_completed_at IS NULL;

-- ============================================================
-- STEP 2: Rollup columns on campaign
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS last_contacted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_follow_up_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contact_channel  VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_next_followup ON mkt_campaigns_list(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_last_contacted ON mkt_campaigns_list(last_contacted_at DESC) WHERE last_contacted_at IS NOT NULL;

-- ============================================================
-- STEP 3: Backfill rollups from any future log data
-- ============================================================
-- Rollups are maintained by the service on every log write; no historical
-- backfill needed because no outreach log rows exist before this sprint.

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP TABLE IF EXISTS mkt_outreach_log;
-- ALTER TABLE mkt_campaigns_list
--   DROP COLUMN IF EXISTS last_contacted_at,
--   DROP COLUMN IF EXISTS next_follow_up_at,
--   DROP COLUMN IF EXISTS last_contact_channel;
-- DROP INDEX IF EXISTS idx_mkt_campaigns_next_followup;
-- DROP INDEX IF EXISTS idx_mkt_campaigns_last_contacted;
