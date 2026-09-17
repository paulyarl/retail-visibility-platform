-- Migration 239: GBP Posts Lifecycle
--
-- Extends gbp_posts with lifecycle columns for the post scheduler (Phase 3):
--   1. location_id — FK to gbp_locations_list for location-scoped queries.
--   2. post_name — Google resource ID (accounts/{accountId}/locations/{locationId}/localPosts/{postId}).
--   3. status — SCHEDULED | PUBLISHED | FAILED (driven by gbpPostScheduler.ts).
--   4. scheduled_for — when a SCHEDULED post should be published.
--   5. published_at — when the post was actually published to Google.
--
-- Existing rows are backfilled to status = 'PUBLISHED' (they are already live).

ALTER TABLE gbp_posts
  ADD COLUMN IF NOT EXISTS location_id    VARCHAR REFERENCES gbp_locations_list(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS post_name      VARCHAR,
  ADD COLUMN IF NOT EXISTS status         VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS scheduled_for  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at   TIMESTAMPTZ;

-- Backfill: existing posts are already published (state = 'live' → status = 'PUBLISHED').
UPDATE gbp_posts
SET status = 'PUBLISHED', published_at = google_create_time
WHERE status = 'PUBLISHED' AND published_at IS NULL AND google_create_time IS NOT NULL;

-- Index for tenant + status queries (scheduler cron + dashboard list).
CREATE INDEX IF NOT EXISTS idx_gbp_posts_tenant_status
  ON gbp_posts (tenant_id, status);

-- Partial index for due scheduled posts (scheduler cron polls this).
CREATE INDEX IF NOT EXISTS idx_gbp_posts_scheduled
  ON gbp_posts (scheduled_for)
  WHERE status = 'SCHEDULED';

-- Index for location-scoped post queries (public surface endpoints, Phase 4).
CREATE INDEX IF NOT EXISTS idx_gbp_posts_location
  ON gbp_posts (location_id)
  WHERE location_id IS NOT NULL;
