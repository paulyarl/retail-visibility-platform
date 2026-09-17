-- 228_seek_batch_entries.sql
-- Per-entry storage for seek batches so each (category, city, profile, focus)
-- tuple is tightly coupled, eliminating profile spillover risk.
--
-- Legacy batches (created before this migration) store a single profile_id,
-- niche_category, intelligence_focus, and cities[] on mkt_seek_batches itself.
-- New batches created via the queue flow populate mkt_seek_batch_entries with
-- one row per (profile, city) pair. On launch, one campaign is created per
-- entry using the entry's own profile/category/focus — no cross-contamination.
--
-- The parent mkt_seek_batches row still stores a summary (cities[], niche_category,
-- profile_id, intelligence_focus) for backward-compatible list views, but the
-- entries table is the source of truth at launch time when populated.

CREATE TABLE IF NOT EXISTS mkt_seek_batch_entries (
  id                  VARCHAR(60) PRIMARY KEY,
  batch_id            VARCHAR(60) NOT NULL REFERENCES mkt_seek_batches(id) ON DELETE CASCADE,
  profile_id          VARCHAR(64) NOT NULL,
  profile_version     INT,
  niche_category      VARCHAR(100) NOT NULL,
  city                VARCHAR(100) NOT NULL,
  state               VARCHAR(50),
  intelligence_focus  VARCHAR(20) NOT NULL DEFAULT 'emerging',
  sort_order          INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msbe_batch ON mkt_seek_batch_entries (batch_id);
CREATE INDEX IF NOT EXISTS idx_msbe_profile ON mkt_seek_batch_entries (profile_id);
CREATE INDEX IF NOT EXISTS idx_msbe_city ON mkt_seek_batch_entries (city);

COMMENT ON TABLE mkt_seek_batch_entries IS
  'Per-entry seek batch rows: one (profile, city, category, focus) tuple per row. Eliminates profile spillover by tightly coupling each city to its own profile.';
