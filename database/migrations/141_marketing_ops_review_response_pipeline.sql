-- ============================================================
-- Migration 141: Marketing Ops — Review Response Pipeline
-- ============================================================
-- Description:
--   Creates a platform-agnostic review-response pipeline that tracks
--   per-platform (Google / Yelp / Facebook) review-response work as a
--   gated progression: backlog -> responding -> follow_up -> closed ->
--   monitoring. Each (campaign_id, platform) pair is its own pipeline
--   row, enabling multiple dimensions of single-business engagement
--   toward a paid/delivered stage.
--
--   - mkt_review_response_pipeline: one row per (campaign, platform)
--     tracking stage, backlog counts, response rate, open follow-ups,
--     gate-met flag, and stale-thread cutoff.
--   - mkt_review_response_log: per-response log (first response,
--     follow-up, or acknowledgment) with customer-reply tracking so
--     the scheduler can detect open threads that need a second touch.
--
--   The gate logic (unanswered_count <= threshold AND follow_ups_open = 0
--   AND response_rate >= target) is enforced by ReviewResponseService
--   before a pipeline advances stage; this migration only provides the
--   storage shape.
-- Prerequisite: 140_marketing_ops_sync_report.sql applied
-- Date: 2026-07-31
-- ============================================================

-- ============================================================
-- STEP 1: Review response pipeline table (one row per campaign x platform)
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_review_response_pipeline (
  id                       VARCHAR(255)  PRIMARY KEY,             -- mrrp-{nanoid}
  campaign_id              VARCHAR(255)  NOT NULL,
  platform                 VARCHAR(50)   NOT NULL,                -- 'google' | 'yelp' | 'facebook' | 'other'
  stage                    VARCHAR(20)   NOT NULL DEFAULT 'backlog', -- 'backlog' | 'responding' | 'follow_up' | 'closed' | 'monitoring'
  priority                 INT           NOT NULL DEFAULT 0,      -- ordering for which platform to work first (lower = earlier)
  -- Snapshot of platform metrics (refreshed on each sync)
  total_reviews            INT           NOT NULL DEFAULT 0,
  unanswered_count         INT           NOT NULL DEFAULT 0,
  response_rate            INT           NOT NULL DEFAULT 0,      -- 0-100, owner response rate %
  average_rating           NUMERIC(2,1),                          -- nullable: platform rating (e.g., 4.7)
  -- Follow-up engagement tracking
  follow_ups_open          INT           NOT NULL DEFAULT 0,      -- open customer-reply threads awaiting a second touch
  follow_ups_completed     INT           NOT NULL DEFAULT 0,
  -- Gate state
  gate_met                 BOOLEAN       NOT NULL DEFAULT false,  -- true when gate criteria satisfied (service-enforced)
  gate_met_at              TIMESTAMPTZ,                           -- when the gate was first met
  -- Scheduling
  next_follow_up_at        TIMESTAMPTZ,                           -- when the next follow-up engagement is due
  last_activity_at         TIMESTAMPTZ,                           -- last response or follow-up action
  stale_thread_cutoff_at   TIMESTAMPTZ,                           -- threads older than this get a single acknowledgment, not active back-and-forth
  -- Platform-specific data (rating, reviews count snapshot, raw IDs, etc.)
  metadata                 JSONB,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_review_pipeline_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE,
  CONSTRAINT uq_mkt_review_pipeline_campaign_platform
    UNIQUE (campaign_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_mkt_review_pipeline_campaign
  ON mkt_review_response_pipeline(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_review_pipeline_stage
  ON mkt_review_response_pipeline(stage);
CREATE INDEX IF NOT EXISTS idx_mkt_review_pipeline_priority
  ON mkt_review_response_pipeline(priority, stage)
  WHERE stage IN ('backlog', 'responding', 'follow_up');
CREATE INDEX IF NOT EXISTS idx_mkt_review_pipeline_next_followup
  ON mkt_review_response_pipeline(next_follow_up_at)
  WHERE next_follow_up_at IS NOT NULL AND stage IN ('responding', 'follow_up');
CREATE INDEX IF NOT EXISTS idx_mkt_review_pipeline_gate
  ON mkt_review_response_pipeline(gate_met, stage)
  WHERE gate_met = false AND stage IN ('backlog', 'responding', 'follow_up');

-- ============================================================
-- STEP 2: Review response log table (per-response entries)
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_review_response_log (
  id                       VARCHAR(255)  PRIMARY KEY,             -- mrrl-{nanoid}
  pipeline_id              VARCHAR(255)  NOT NULL,
  platform_review_id       VARCHAR(255),                          -- platform's review ID (e.g., google_review_id); nullable for aggregated entries
  response_text            TEXT,
  response_type            VARCHAR(20)   NOT NULL,                -- 'first_response' | 'follow_up' | 'acknowledgment'
  responded_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  responded_by             VARCHAR(255),                          -- operator id or 'system'
  -- Customer-reply tracking (so scheduler can detect open threads)
  customer_replied         BOOLEAN       NOT NULL DEFAULT false,
  customer_reply_at        TIMESTAMPTZ,
  thread_closed            BOOLEAN       NOT NULL DEFAULT false,
  thread_closed_at         TIMESTAMPTZ,
  notes                    TEXT,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_review_log_pipeline
    FOREIGN KEY (pipeline_id) REFERENCES mkt_review_response_pipeline(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_review_log_pipeline
  ON mkt_review_response_log(pipeline_id, responded_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_review_log_open_threads
  ON mkt_review_response_log(pipeline_id)
  WHERE thread_closed = false AND customer_replied = true;
CREATE INDEX IF NOT EXISTS idx_mkt_review_log_platform_review
  ON mkt_review_response_log(platform_review_id)
  WHERE platform_review_id IS NOT NULL;

-- ============================================================
-- STEP 3: Backfill — none needed (new tables; pipelines are created
-- on demand by ReviewResponseService when a campaign enters
-- preview_built/shown stage with platform audit data).
-- ============================================================

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP TABLE IF EXISTS mkt_review_response_log;
-- DROP TABLE IF EXISTS mkt_review_response_pipeline;
-- DROP INDEX IF EXISTS idx_mkt_review_pipeline_campaign;
-- DROP INDEX IF EXISTS idx_mkt_review_pipeline_stage;
-- DROP INDEX IF EXISTS idx_mkt_review_pipeline_priority;
-- DROP INDEX IF EXISTS idx_mkt_review_pipeline_next_followup;
-- DROP INDEX IF EXISTS idx_mkt_review_pipeline_gate;
-- DROP INDEX IF EXISTS idx_mkt_review_log_pipeline;
-- DROP INDEX IF EXISTS idx_mkt_review_log_open_threads;
-- DROP INDEX IF EXISTS idx_mkt_review_log_platform_review;
