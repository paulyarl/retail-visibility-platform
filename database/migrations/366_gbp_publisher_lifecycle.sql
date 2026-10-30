-- Migration 366: GBP publisher lifecycle columns
--
-- Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §6.1/§6.3
-- Sprint: docs/LocalBiz/GBP_DFY_SPRINT_PLAN.md D2
--
-- gbp_posts gains the DFY publisher bookkeeping (extends the shipped
-- lifecycle columns — no parallel table):
--   batch_id              — gbp_post_batches.id for batch-materialized rows
--   created_by            — 'tenant' | 'admin' | 'autopilot'
--   recurrence            — jsonb series definition
--   approved_by/at        — approval-mode bookkeeping (gbp_approval_mode)
--   attempts / last_error — retry bookkeeping (max 3, backoff)
--   publishing_started_at — claim lease: a row stuck in PUBLISHING past the
--                           lease is reclaimed by the next scheduler pass
--
-- gbp_reviews gains the autopilot scheduling columns:
--   autopilot_due_at   — respond_after (detected + jitter, clamped to
--                        business_hours_list window)
--   autopilot_status   — autopilot lifecycle state
--
-- status vocabulary stays uppercase; PUBLISHING + CANCELLED join the existing
-- DRAFT | SCHEDULED | PUBLISHED | FAILED set (free varchar, no constraint).

ALTER TABLE gbp_posts
  ADD COLUMN IF NOT EXISTS batch_id              VARCHAR(64),
  ADD COLUMN IF NOT EXISTS created_by            VARCHAR(12) NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS recurrence            JSONB,
  ADD COLUMN IF NOT EXISTS approved_by           VARCHAR,
  ADD COLUMN IF NOT EXISTS approved_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempts              INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error            TEXT,
  ADD COLUMN IF NOT EXISTS publishing_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_gbp_posts_batch    ON gbp_posts (batch_id);
CREATE INDEX IF NOT EXISTS idx_gbp_posts_due      ON gbp_posts (status, scheduled_for);

ALTER TABLE gbp_reviews
  ADD COLUMN IF NOT EXISTS autopilot_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS autopilot_status VARCHAR(16) NOT NULL DEFAULT 'NONE';
