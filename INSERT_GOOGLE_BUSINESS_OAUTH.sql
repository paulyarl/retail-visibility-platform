-- ============================================================================
-- INSERT GOOGLE BUSINESS OAUTH RECORD - Platform Level
-- ============================================================================
-- Date: November 17, 2025
-- Purpose: Add Google Business OAuth credentials for GBP category sync
-- Run in: Supabase SQL Editor (AFTER creating oauth_integrations table)
--
-- Your Credentials:
-- Client ID: 407743626849-14md25o51q3khomgdokivm3gldpgc1tg.apps.googleusercontent.com
-- Client Secret: [HIDDEN FOR SECURITY]
-- Redirect URI: https://api.visibleshelf.com/auth/google/business/callback
--
-- ⚠️  NOTE: You have access_token but still need refresh_token for automatic renewal
-- ✅ FIXED: JSON syntax errors (removed invalid EXTRACT function and SQL concatenation)
-- ============================================================================

-- Insert Google Business OAuth integration (platform-level)
INSERT INTO oauth_integrations (
  tenant_id, -- NULL for platform-level
  provider,
  access_token,
  refresh_token,
  scopes,
  expires_at,
  is_active,
  metadata
) VALUES (
  NULL, -- platform-level (not tenant-specific)
  'google_business',
  '{
    "access_token": "REPLACE_WITH_NEW_TOKEN_HERE",
    "token_type": "Bearer",
    "expires_in": 3599
  }'::json,
  NULL, -- refresh_token (you need to get this - see GET_GOOGLE_BUSINESS_TOKENS.md)
  ARRAY['https://www.googleapis.com/auth/business.manage'],
  NOW() + INTERVAL '1 hour', -- Set appropriate expiry
  true, -- active
  '{
    "description": "Platform-level Google Business OAuth for GBP category sync",
    "account": "your-google-account@example.com",
    "setup_date": "2025-11-17"
  }'::jsonb
);

-- ============================================================================
-- VERIFY INSERTION
-- ============================================================================

-- Check the record was inserted
SELECT
  id,
  provider,
  tenant_id,
  is_active,
  created_at,
  expires_at
FROM oauth_integrations
WHERE provider = 'google_business'
  AND tenant_id IS NULL;

-- ============================================================================
-- GET TOKENS FOR MANUAL SETUP
-- ============================================================================
--
-- You need to get OAuth tokens from Google. Here's how:
--
-- 1. Go to Google Cloud Console
-- 2. Enable Google My Business API
-- 3. Create OAuth 2.0 credentials
-- 4. Get authorization code from OAuth flow
-- 5. Exchange code for tokens
--
-- Or use existing tokens from your Google Business setup.
--
-- Replace YOUR_ACCESS_TOKEN_HERE and YOUR_REFRESH_TOKEN_HERE above.
--
-- ============================================================================
