-- Migration 240: GBP Media Location
--
-- Extends gbp_media with:
--   1. location_id — FK to gbp_locations_list for location-scoped queries
--      (public surface photo gallery, Phase 4).
--   2. view_count — Google-provided view analytics (deferred per Subsystem 4,
--      but column is added now so the ingestion job can populate it later).
--
-- No backfill needed — location_id will be populated by the media sync job
-- and the ingestion cron. Existing rows remain NULL until the next sync.

ALTER TABLE gbp_media
  ADD COLUMN IF NOT EXISTS location_id  VARCHAR REFERENCES gbp_locations_list(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS view_count   INTEGER DEFAULT 0;

-- Index for tenant + location queries (public surface endpoints, Phase 4).
CREATE INDEX IF NOT EXISTS idx_gbp_media_tenant_location
  ON gbp_media (tenant_id, location_id);

-- Index for location-scoped media queries.
CREATE INDEX IF NOT EXISTS idx_gbp_media_location
  ON gbp_media (location_id)
  WHERE location_id IS NOT NULL;
