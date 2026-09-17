-- ============================================================
-- Migration 129: Tenant Prospecting Channel
-- ============================================================
-- Description: Bridges the Marketing Ops campaign pipeline into a tenant
--   acquisition channel. Adds campaign→tenant linking columns, first/last-touch
--   attribution, campaign origin (prospect vs upsell), demo storefront link,
--   GBP lookup cache, and the public deliverable preview token table.
-- Prerequisite: 128_marketing_ops.sql applied
-- Date: 2026-07-29
-- Design doc: docs/LocalBiz/tenant_prospecting_channel_sprint_plan.md (v2.0)
-- ============================================================

-- ============================================================
-- STEP 1: Add tenant_id to mkt_campaigns_list
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(255);

DO $$ BEGIN
  ALTER TABLE mkt_campaigns_list
    ADD CONSTRAINT fk_mkt_campaigns_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_tenant ON mkt_campaigns_list(tenant_id);

-- ============================================================
-- STEP 2: Add date_tenant_onboarded column
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS date_tenant_onboarded TIMESTAMPTZ;

-- ============================================================
-- STEP 3: First/last-touch conversion attribution (G5)
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS first_touch_source VARCHAR(50),
  ADD COLUMN IF NOT EXISTS last_touch_source VARCHAR(50);
  -- Sources: 'qr_deliverable', 'demo_storefront', 'gbp_enhancer', 'directory_preview', 'manual', 'external'
  -- first_touch_source: write-once, set on the first recorded prospect interaction (token view or admin link)
  -- last_touch_source:  overwritten on every subsequent touch; value at conversion = conversion driver

-- ============================================================
-- STEP 3b: Campaign origin — prospect vs. upsell population (G8)
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS campaign_origin VARCHAR(20) NOT NULL DEFAULT 'prospect';
  -- 'prospect': business is not a tenant (acquisition funnel)
  -- 'upsell':   existing tenant buying marketing services (set when admin links a tenant at creation)

-- ============================================================
-- STEP 3c: Demo storefront link on campaign (G3)
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS demo_tenant_id VARCHAR(255);

DO $$ BEGIN
  ALTER TABLE mkt_campaigns_list
    ADD CONSTRAINT fk_mkt_campaigns_demo_tenant
    FOREIGN KEY (demo_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_mkt_campaigns_demo_tenant ON mkt_campaigns_list(demo_tenant_id);

-- ============================================================
-- STEP 3d: GBP lookup cache on campaign (G7)
-- ============================================================

ALTER TABLE mkt_campaigns_list
  ADD COLUMN IF NOT EXISTS gbp_lookup_cache JSONB,
  ADD COLUMN IF NOT EXISTS gbp_lookup_cached_at TIMESTAMPTZ;

-- ============================================================
-- STEP 4: Public deliverable preview tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS mkt_deliverable_preview_tokens (
  id              VARCHAR(255)  PRIMARY KEY,          -- mdpt-{nanoid}
  deliverable_id  VARCHAR(255),                        -- nullable: demo-storefront tokens have no deliverable
  campaign_id     VARCHAR(255)  NOT NULL,              -- unified trust anchor for ALL public CTAs (G2)
  token_type      VARCHAR(20)   NOT NULL DEFAULT 'deliverable',  -- 'deliverable' | 'demo_storefront'
  token           VARCHAR(255)  UNIQUE NOT NULL,       -- random token for public URL
  expires_at      TIMESTAMPTZ   NOT NULL,
  viewed_at       TIMESTAMPTZ,
  converted_at    TIMESTAMPTZ,
  tenant_id       VARCHAR(255),                        -- populated on signup
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_mkt_preview_deliverable
    FOREIGN KEY (deliverable_id) REFERENCES mkt_deliverables_list(id) ON DELETE CASCADE,
  CONSTRAINT fk_mkt_preview_campaign
    FOREIGN KEY (campaign_id) REFERENCES mkt_campaigns_list(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mkt_preview_token ON mkt_deliverable_preview_tokens(token);
CREATE INDEX IF NOT EXISTS idx_mkt_preview_deliverable ON mkt_deliverable_preview_tokens(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_mkt_preview_campaign ON mkt_deliverable_preview_tokens(campaign_id);

-- RLS: public read by token, admin full access
ALTER TABLE mkt_deliverable_preview_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mkt_preview_public_read ON mkt_deliverable_preview_tokens
    FOR SELECT
    USING (true);  -- token validation done in service layer
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_preview_admin_all ON mkt_deliverable_preview_tokens
    FOR ALL
    USING (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'))
    WITH CHECK (current_setting('app.current_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY mkt_preview_service_write ON mkt_deliverable_preview_tokens
    FOR ALL
    USING (current_setting('app.current_role', true) = 'service')
    WITH CHECK (current_setting('app.current_role', true) = 'service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- STEP 5: updated_at trigger for preview tokens table
-- ============================================================

CREATE OR REPLACE FUNCTION update_mkt_preview_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mkt_preview_tokens_updated_at ON mkt_deliverable_preview_tokens;
CREATE TRIGGER trg_mkt_preview_tokens_updated_at
  BEFORE UPDATE ON mkt_deliverable_preview_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_mkt_preview_tokens_updated_at();

-- ============================================================
-- VERIFICATION QUERIES (run manually after applying)
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'mkt_campaigns_list'
--   AND column_name IN ('tenant_id','date_tenant_onboarded','first_touch_source','last_touch_source','campaign_origin','demo_tenant_id','gbp_lookup_cache','gbp_lookup_cached_at');
--
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--   WHERE table_name = 'mkt_deliverable_preview_tokens' ORDER BY ordinal_position;
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'mkt_deliverable_preview_tokens';
--
-- SELECT polname FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid
--   WHERE c.relname = 'mkt_deliverable_preview_tokens';
--
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'mkt_deliverable_preview_tokens'::regclass;
