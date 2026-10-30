-- Migration 368: GBP post batches (DFY batch fan-out)
--
-- Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §6.2
-- Sprint: docs/LocalBiz/GBP_DFY_SPRINT_PLAN.md D6
--
-- One row = one batch definition; materialization fans it out into
-- per-location gbp_posts rows (batch_id links back). Audience v1 is
-- all_managed / explicit[] — metro/category audiences have no data source yet.

CREATE TABLE IF NOT EXISTS gbp_post_batches (
  id              VARCHAR(64) PRIMARY KEY,
  actor_user_id   VARCHAR,                    -- ops user who created the batch
  audience        JSONB        NOT NULL,      -- {type:'all_managed'|'explicit', gbpLocationIds?: varchar[]}
  template        JSONB        NOT NULL,      -- localPosts payload {summary, topicType, event, offer, callToAction, media}
  recurrence      JSONB,
  scheduled_for   TIMESTAMPTZ  NOT NULL,      -- base fan-out start; rows get staggered offsets
  status          VARCHAR(16)  NOT NULL DEFAULT 'draft', -- draft|materialized|cancelled
  materialized_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbp_post_batches_status ON gbp_post_batches (status, created_at DESC);
