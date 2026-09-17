-- Migration 177: Diagnostic Gallery Engagement Events + Analytics
--
-- Creates two new tables following the qr_scan_events / qr_analytics dual-table
-- pattern: raw append-only events for per-interaction tracking, plus a rollup
-- table for aggregate dashboard queries.
--
-- mkt_gallery_events: one row per engagement interaction (gallery_opened,
-- screenshot_viewed, carousel_next/prev, cta_clicked, cta_hovered,
-- session_heartbeat, session_end). Append-only -- never updated.
--
-- mkt_gallery_analytics: per-token per-day aggregate rollup. Upserted by the
-- gallery-analytics-sync job (Sprint 7). Unique on (token_id, period_start,
-- period_type).
--
-- Conventions:
--   * mkt_* family: no ENABLE ROW LEVEL SECURITY, no updated_at triggers.
--   * tenant_id column included (DEFAULT 'platform') for admin filtering and
--     future RLS enablement, but RLS policy is NOT applied today.
--   * IDs are global (mkt_* family convention): gevt-{nanoid}, ga-{nanoid}.
--   * No FK to mkt_deliverable_preview_tokens or mkt_campaigns_list -- the
--     token/campaign may be deleted (CASCADE), but we retain the event/analytics
--     rows for historical reporting. token_id and campaign_id are plain
--     VARCHAR columns, not FK-constrained.
--   * ip_hash is SHA-256(ip + salt), never raw IP. Salt from unifiedConfig
--     (galleryIpHashSalt). If salt is unset, ip_hash is null (graceful
--     degradation).
--   * dwell_ms on session_heartbeat is CUMULATIVE since session start (not
--     per-interval). Aggregation must use MAX(dwell_ms) per session, not SUM.
--
-- After running: cd apps/api && npx prisma db pull && npx prisma generate.
-- Date: 2026-08-08

-- --- 1. Raw event log (append-only) ---

CREATE TABLE IF NOT EXISTS mkt_gallery_events (
  id               VARCHAR(255) PRIMARY KEY,
  tenant_id        VARCHAR(255) NOT NULL DEFAULT 'platform',
  token_id         VARCHAR(255) NOT NULL,
  campaign_id      VARCHAR(255) NOT NULL,
  session_id       VARCHAR(255),
  event_type       VARCHAR(30) NOT NULL,
  screenshot_index INTEGER,
  screenshot_id    VARCHAR(255),
  dwell_ms         INTEGER,
  client_width     INTEGER,
  client_height    INTEGER,
  referrer         TEXT,
  user_agent       TEXT,
  ip_hash          VARCHAR(64),
  geo_country      VARCHAR(10),
  geo_city         VARCHAR(100),
  device_type      VARCHAR(20),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mkt_gallery_events_token
  ON mkt_gallery_events(token_id);
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_events_campaign
  ON mkt_gallery_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_events_type
  ON mkt_gallery_events(event_type);
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_events_session
  ON mkt_gallery_events(session_id);
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_events_created
  ON mkt_gallery_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_events_token_type_time
  ON mkt_gallery_events(token_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_events_campaign_type_time
  ON mkt_gallery_events(campaign_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_events_tenant
  ON mkt_gallery_events(tenant_id);

-- --- 2. Aggregate rollup (per token per day) ---

CREATE TABLE IF NOT EXISTS mkt_gallery_analytics (
  id                       VARCHAR(255) PRIMARY KEY,
  tenant_id                VARCHAR(255) NOT NULL DEFAULT 'platform',
  token_id                 VARCHAR(255) NOT NULL,
  campaign_id              VARCHAR(255) NOT NULL,
  period_start             DATE NOT NULL,
  period_type              VARCHAR(10) DEFAULT 'day',
  total_opens              INTEGER DEFAULT 0,
  unique_sessions          INTEGER DEFAULT 0,
  total_screenshot_views   INTEGER DEFAULT 0,
  total_carousel_navs      INTEGER DEFAULT 0,
  cta_clicks               INTEGER DEFAULT 0,
  cta_hovers               INTEGER DEFAULT 0,
  avg_session_duration_ms  INTEGER DEFAULT 0,
  avg_screenshots_viewed   INTEGER DEFAULT 0,
  mobile_views             INTEGER DEFAULT 0,
  desktop_views            INTEGER DEFAULT 0,
  tablet_views             INTEGER DEFAULT 0,
  top_country              VARCHAR(10),
  top_city                 VARCHAR(100),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token_id, period_start, period_type)
);

CREATE INDEX IF NOT EXISTS idx_mkt_gallery_analytics_token
  ON mkt_gallery_analytics(token_id);
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_analytics_campaign
  ON mkt_gallery_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_analytics_period
  ON mkt_gallery_analytics(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_gallery_analytics_tenant
  ON mkt_gallery_analytics(tenant_id);

-- --- Verification ---
-- SELECT count(*) FROM information_schema.tables
-- WHERE table_name IN ('mkt_gallery_events','mkt_gallery_analytics');
-- -- Should return 2.
--
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'mkt_gallery_events' ORDER BY indexname;
-- SELECT indexname FROM pg_indexes
-- WHERE tablename = 'mkt_gallery_analytics' ORDER BY indexname;
