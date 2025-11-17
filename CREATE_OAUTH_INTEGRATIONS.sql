-- ============================================================================
-- CREATE OAUTH_INTEGRATIONS TABLE - Platform Level
-- ============================================================================
-- Date: November 17, 2025
-- Purpose: Create oauth_integrations table for platform-level OAuth storage
-- Run in: Supabase SQL Editor
-- ============================================================================

-- Create oauth_integrations table
CREATE TABLE IF NOT EXISTS oauth_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES "Tenant"(id) ON DELETE CASCADE, -- TEXT to match Tenant.id
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scopes TEXT[] DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_integrations_provider
  ON oauth_integrations(provider, is_active);

CREATE INDEX IF NOT EXISTS idx_oauth_integrations_tenant
  ON oauth_integrations(tenant_id) WHERE tenant_id IS NOT NULL;

-- Enable RLS (Row Level Security)
ALTER TABLE oauth_integrations ENABLE ROW LEVEL SECURITY;

-- Policy: Platform admins can see all, regular users see their tenant's data
CREATE POLICY oauth_integrations_access ON oauth_integrations
  FOR ALL
  USING (
    -- Platform admin check (adjust based on your role system)
    current_setting('app.current_user_role', true) IN ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER')
    OR
    -- Tenant-specific access
    tenant_id IS NULL
    OR
    tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- ============================================================================
-- VERIFY CREATION
-- ============================================================================

-- Check table was created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'oauth_integrations';

-- Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'oauth_integrations'
ORDER BY ordinal_position;

-- ============================================================================
-- OPTIONAL: Insert a test Google Business integration (uncomment if needed)
-- ============================================================================

-- INSERT INTO oauth_integrations (
--   tenant_id, -- NULL for platform-level
--   provider,
--   access_token,
--   refresh_token,
--   scopes,
--   expires_at,
--   metadata
-- ) VALUES (
--   NULL, -- platform-level
--   'google_business',
--   '{"access_token":"your-access-token","token_type":"Bearer","expires_in":3600}',
--   'your-refresh-token',
--   ARRAY['https://www.googleapis.com/auth/business.manage'],
--   NOW() + INTERVAL '1 hour',
--   '{"account":"your-google-account@example.com"}'::jsonb
-- );

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- This table supports both tenant-level and platform-level OAuth:
-- - tenant_id = NULL: Platform-level (what you need for GBP sync)
-- - tenant_id = TEXT: Tenant-specific OAuth (matches Tenant.id type)
--
-- After running this SQL:
-- 1. Verify table creation with queries above
-- 2. Update GBPCategorySyncService to use this table
-- 3. Test the service
--
-- ✅ Foreign key constraint added with correct table name: "Tenant"
-- ✅ Data types match: tenant_id TEXT references Tenant.id TEXT
--
-- ============================================================================
