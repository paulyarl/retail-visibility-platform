-- ============================================================================
-- MIGRATE DATA FROM MAIN TO STAGING
-- ============================================================================
-- Run this in STAGING Supabase SQL Editor
-- This will copy all data from main database to staging
-- ============================================================================

-- IMPORTANT: Replace these placeholders with actual database URLs
-- You can get these from Vercel Environment Variables

-- Set up the connection to main database
-- (This requires dblink extension - may not be available in free tier)

-- Alternative: Use pg_dump/psql from command line:
-- pg_dump "MAIN_DATABASE_URL" > main_backup.sql
-- psql "STAGING_DATABASE_URL" < main_backup.sql

-- For now, we'll copy the most critical tables manually:
-- 1. Organization
-- 2. Tenant
-- 3. User
-- 4. oauth_integrations (for GBP sync)
-- 5. Other essential data

-- ============================================================================
-- MANUAL DATA MIGRATION (if pg_dump not available)
-- ============================================================================

-- Copy Organizations
INSERT INTO "Organization" SELECT * FROM dblink(
  'MAIN_DATABASE_URL',
  'SELECT * FROM "Organization"'
) AS t(id TEXT, name TEXT, created_at TIMESTAMP, updated_at TIMESTAMP);

-- Copy Tenants
INSERT INTO "Tenant" SELECT * FROM dblink(
  'MAIN_DATABASE_URL',
  'SELECT * FROM "Tenant"'
) AS t(
  id TEXT, name TEXT, organization_id TEXT,
  created_at TIMESTAMP, updated_at TIMESTAMP,
  status "LocationStatus", status_changed_at TIMESTAMP,
  status_changed_by TEXT, status_reason TEXT,
  suspended_at TIMESTAMP, closed_at TIMESTAMP,
  created_by TEXT
);

-- Copy Users
INSERT INTO "User" SELECT * FROM dblink(
  'MAIN_DATABASE_URL',
  'SELECT * FROM "User"'
) AS t(id TEXT, email TEXT, name TEXT, role "user_role", created_at TIMESTAMP, updated_at TIMESTAMP);

-- Copy GBP Categories (if they exist)
INSERT INTO "GbpCategory" SELECT * FROM dblink(
  'MAIN_DATABASE_URL',
  'SELECT * FROM "GbpCategory"'
) AS t(id TEXT, name TEXT, display_name TEXT, is_active BOOLEAN, created_at TIMESTAMP, updated_at TIMESTAMP);

-- Copy OAuth Integrations (CRITICAL for GBP sync)
INSERT INTO "oauth_integrations" SELECT * FROM dblink(
  'MAIN_DATABASE_URL',
  'SELECT * FROM "oauth_integrations"'
) AS t(
  id UUID, tenant_id TEXT, provider TEXT, access_token TEXT,
  refresh_token TEXT, scopes TEXT[], expires_at TIMESTAMP,
  is_active BOOLEAN, metadata JSONB, created_at TIMESTAMP, updated_at TIMESTAMP
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check data migration success
SELECT 'Organization' as table_name, COUNT(*) as count FROM "Organization"
UNION ALL
SELECT 'Tenant' as table_name, COUNT(*) as count FROM "Tenant"
UNION ALL
SELECT 'User' as table_name, COUNT(*) as count FROM "User"
UNION ALL
SELECT 'oauth_integrations' as table_name, COUNT(*) as count FROM "oauth_integrations"
UNION ALL
SELECT 'GbpCategory' as table_name, COUNT(*) as count FROM "GbpCategory";

-- Verify GBP OAuth token exists
SELECT id, provider, tenant_id, is_active, created_at
FROM oauth_integrations
WHERE provider = 'google_business'
ORDER BY created_at DESC;

-- ============================================================================
-- COMMAND LINE ALTERNATIVE (Recommended)
-- ============================================================================
--
-- If you have access to command line with PostgreSQL tools:
--
-- 1. Export from main:
--    pg_dump "MAIN_DATABASE_URL" > main_full_backup.sql
--
-- 2. Import to staging:
--    psql "STAGING_DATABASE_URL" < main_full_backup.sql
--
-- This will copy ALL data including GBP categories and OAuth tokens.
--
-- ============================================================================
