-- Migration 345: Flyer events table + recurrence column (Phase 3)
--
-- Spec: docs/LocalBiz/FLYER_SURFACE_SPEC.md §5 (counters are not analytics —
-- a daily series and ?src= attribution need an events table mirroring
-- qr_scan_events → qr_analytics) and §8 Phase 3 (flyer_recurring presets).
--
--   * tenant_flyer_events — append-only event rows (impression|click|
--     add_to_cart) with surface + src attribution. The impressions/clicks
--     row counters on tenant_flyers stay as cheap glanceable totals; the
--     series lives here.
--   * tenant_flyers.recurrence — 'none'|'daily'|'weekly' auto-roll preset,
--     consumed by flyer-expiry-enforcer on expiry (gated by flyer_recurring
--     capability at write time in the merchant route).
--
-- Idempotent: IF NOT EXISTS / ON CONFLICT guards throughout.

BEGIN;

-- ============================================================
-- 1. tenant_flyer_events — event-level analytics (spec §5)
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_flyer_events (
  id          VARCHAR(50)  PRIMARY KEY,                        -- 'fle-' prefixed, app-minted
  flyer_id    VARCHAR(50)  REFERENCES tenant_flyers(id) ON DELETE CASCADE,
  tenant_id   VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type  VARCHAR(24)  NOT NULL,                           -- impression|click|add_to_cart|order
  surface     VARCHAR(16)  NOT NULL DEFAULT 'standalone',      -- storefront|directory|place|standalone
  src         VARCHAR(32),                                     -- qr-customer|qr-merchant|share|direct
  flyer_item_id VARCHAR(50),                                   -- item-level attribution when known
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_flyer_event_type CHECK (event_type IN ('impression','click','add_to_cart','order'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_flyer_events_flyer
  ON tenant_flyer_events (flyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_flyer_events_tenant
  ON tenant_flyer_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_flyer_events_src
  ON tenant_flyer_events (tenant_id, src, created_at DESC);

ALTER TABLE tenant_flyer_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_flyer_events_tenant_all ON tenant_flyer_events
    FOR ALL
    USING (tenant_id::text = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY tenant_flyer_events_admin_all ON tenant_flyer_events
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. tenant_flyers.recurrence — auto-roll preset (spec §8 Phase 3)
-- ============================================================

ALTER TABLE tenant_flyers
  ADD COLUMN IF NOT EXISTS recurrence VARCHAR(16) NOT NULL DEFAULT 'none';

DO $$ BEGIN
  ALTER TABLE tenant_flyers
    ADD CONSTRAINT chk_flyer_recurrence CHECK (recurrence IN ('none','daily','weekly'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
