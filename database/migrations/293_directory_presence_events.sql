-- 293_directory_presence_events.sql
--
-- Layer 3 of the directory presence traffic surface
-- (docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md §4, §5).
--
-- Engagement-grade events for public seed listings — slug-scoped (seeds are
-- public browse pages, no token gate), mirrors the mkt_gallery_events shape
-- from GalleryAnalyticsService.
--
-- Captures: listing_viewed, claim_clicked, call_clicked, directions_clicked,
-- qr_scanned, session_heartbeat, session_end. Enforced in Zod at the route
-- layer (documented here, not a CHECK — matches the gallery pattern).
--
-- Idempotent: CREATE TABLE / INDEX IF NOT EXISTS.
-- Apply against both `local` and `prd`:
--   psql "$DATABASE_URL" -f database/migrations/293_directory_presence_events.sql
--
-- No aggregation rollup table: seed pages are steady-state (unlike SMS-burst
-- gallery tokens), and queries are admin-only. Add a rollup in a follow-up if
-- volume grows.

CREATE TABLE IF NOT EXISTS directory_presence_events (
  id          VARCHAR(40)  PRIMARY KEY,
  tenant_id   VARCHAR(255) NOT NULL,
  listing_id  VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) NOT NULL,
  session_id  VARCHAR(100),
  event_type  VARCHAR(40)  NOT NULL,
  referrer    TEXT,
  user_agent  TEXT,
  ip_hash     VARCHAR(64),
  device_type VARCHAR(20),
  dwell_ms    INTEGER,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpe_tenant_created
  ON directory_presence_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dpe_slug_created
  ON directory_presence_events (slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dpe_session
  ON directory_presence_events (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dpe_event_type
  ON directory_presence_events (event_type, created_at DESC);
