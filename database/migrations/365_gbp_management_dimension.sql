-- Migration 365: GBP DFY management dimension + activity events
--
-- Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §3.1/§5.1
-- Sprint: docs/LocalBiz/GBP_DFY_SPRINT_PLAN.md D1
--
-- Adds the platform-management columns to gbp_locations_list:
--   managed_by           — 'self' (DIY) | 'platform' (DFY)
--   granted_via          — 'oauth' (merchant OAuth, DIY + model A)
--                          'invitation' (owner approved platform access)
--                          'platform_claim' (platform owns the listing)
--   delegated_surfaces   — jsonb: {reviews, posts, media, info, hours, attributes}
--                          the platform-side delegation record (NOT a merchant
--                          soft gate — lives here, not tenant_gbp_options_settings)
--   platform_account_id  — the platform's real GBP account id for managed
--                          locations (the {accountId} segment of v4 API paths)
--
-- New table gbp_activity_events — the merchant-facing DFY activity feed and
-- the operator audit trail (actor_user_id for admin-initiated actions).
--
-- Ownership rule: unique index on location_id — one platform row per Google
-- location (blocks the DIY-row + platform-row double-claim the spec calls out).

ALTER TABLE gbp_locations_list
  ADD COLUMN IF NOT EXISTS managed_by          VARCHAR(16) NOT NULL DEFAULT 'self',
  ADD COLUMN IF NOT EXISTS granted_via         VARCHAR(16) NOT NULL DEFAULT 'oauth',
  ADD COLUMN IF NOT EXISTS delegated_surfaces  JSONB,
  ADD COLUMN IF NOT EXISTS platform_account_id VARCHAR;

-- One platform row per Google location. If pre-existing duplicates exist,
-- the index fails — resolve manually before re-running.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gbp_locations_location_id
  ON gbp_locations_list (location_id);

CREATE TABLE IF NOT EXISTS gbp_activity_events (
  id                   TEXT        PRIMARY KEY,
  tenant_id            VARCHAR     NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gbp_location_id      VARCHAR     REFERENCES gbp_locations_list(id) ON DELETE SET NULL,
  action               VARCHAR(40) NOT NULL,
  actor                VARCHAR(12) NOT NULL,          -- 'admin' | 'system' | 'autopilot'
  actor_user_id        VARCHAR,
  detail               JSONB       NOT NULL DEFAULT '{}',
  visible_to_merchant  BOOLEAN     NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbp_activity_events_tenant
  ON gbp_activity_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gbp_activity_events_location
  ON gbp_activity_events (gbp_location_id, created_at DESC);
