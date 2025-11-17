-- ============================================================================
-- MANUAL DATA MIGRATION - CRITICAL DATA ONLY
-- ============================================================================
-- Run this in STAGING Supabase SQL Editor
-- This manually inserts the most critical data for GBP sync to work
-- ============================================================================

-- 1. Insert Google Business OAuth token (CRITICAL for GBP sync)
INSERT INTO oauth_integrations (
  id,
  tenant_id,
  provider,
  access_token,
  refresh_token,
  scopes,
  expires_at,
  is_active,
  metadata,
  created_at,
  updated_at
) VALUES (
  '430c835e-c5e7-408a-96ab-698c305fad3b',
  NULL,
  'google_business',
  '{
    "access_token": "",
    "token_type": "Bearer",
    "expires_in": 3599
  }'::json,
  NULL,
  ARRAY['https://www.googleapis.com/auth/business.manage'],
  NOW() + INTERVAL '1 hour',
  true,
  '{
    "description": "Platform-level Google Business OAuth for GBP category sync",
    "account": "yarlmoment@gmail.com",
    "setup_date": "2025-11-17"
  }'::jsonb,
  '2025-11-17 09:02:50.953448+00',
  '2025-11-17 09:02:50.953448+00'
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert GBP Categories (if you want the 4,000+ live categories)
-- This is optional - the service will fetch them automatically once OAuth works
-- But you can insert them if you have the data from main

-- INSERT INTO "GbpCategory" (id, name, display_name, is_active, created_at, updated_at)
-- SELECT id, name, display_name, is_active, created_at, updated_at
-- FROM dblink('MAIN_DATABASE_URL', 'SELECT * FROM "GbpCategory"')
-- AS t(id TEXT, name TEXT, display_name TEXT, is_active BOOLEAN, created_at TIMESTAMP, updated_at TIMESTAMP);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that OAuth token exists
SELECT
  id,
  provider,
  tenant_id,
  is_active,
  created_at
FROM oauth_integrations
WHERE provider = 'google_business'
ORDER BY created_at DESC;

-- Check GBP categories count
SELECT COUNT(*) as gbp_categories_count FROM "GbpCategory";

-- ============================================================================
-- TEST THE SERVICE
-- ============================================================================
--
-- After running this, test:
-- curl https://api.visibleshelf.com/test/gbp-oauth
-- Should return: {"success":true,"tokenExists":true}
--
-- curl -X POST https://api.visibleshelf.com/test/sync-gbp-categories
-- Should return: {"success":true,"fetchCount":4000,"usingGoogleAPI":true}
--
-- ============================================================================
