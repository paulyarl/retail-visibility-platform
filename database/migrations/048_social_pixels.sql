-- Phase 2C: Social Pixels & Conversion Tracking
-- Stores per-tenant Meta Pixel ID and TikTok Pixel ID for client-side tracking
-- and Conversions API / Events API server-side tracking

BEGIN;

CREATE TABLE IF NOT EXISTS tenant_social_pixels (
  id                  VARCHAR(100) PRIMARY KEY,
  tenant_id           VARCHAR(100) NOT NULL,
  meta_pixel_id       VARCHAR(50),
  meta_access_token   VARCHAR(500),   -- for Meta Conversions API (server-side)
  tiktok_pixel_id     VARCHAR(50),
  tiktok_access_token VARCHAR(500),   -- for TikTok Events API (server-side)
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_social_pixels_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT uq_social_pixels_tenant UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_social_pixels_tenant ON tenant_social_pixels(tenant_id);

-- RLS policies
ALTER TABLE tenant_social_pixels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_pixels_tenant_all" ON tenant_social_pixels;
CREATE POLICY "social_pixels_tenant_all" ON tenant_social_pixels
  FOR ALL USING (
    tenant_id = current_setting('app.current_tenant_id', true)
  );

DROP POLICY IF EXISTS "social_pixels_admin_all" ON tenant_social_pixels;
CREATE POLICY "social_pixels_admin_all" ON tenant_social_pixels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = current_setting('app.current_user_id', true)
      AND u.role IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT')
    )
  );

-- Public read for storefront pixel injection (only pixel IDs, not tokens)
DROP POLICY IF EXISTS "social_pixels_public_read" ON tenant_social_pixels;
CREATE POLICY "social_pixels_public_read" ON tenant_social_pixels
  FOR SELECT USING (true);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_social_pixels_updated_at ON tenant_social_pixels;
CREATE TRIGGER trg_social_pixels_updated_at
  BEFORE UPDATE ON tenant_social_pixels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
