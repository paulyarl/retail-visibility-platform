-- ============================================================================
-- UPDATE GOOGLE BUSINESS ACCESS TOKEN (when expired)
-- ============================================================================
-- Run this in Supabase SQL Editor when your token expires
-- Replace YOUR_NEW_ACCESS_TOKEN_HERE with the new token from OAuth Playground
-- ============================================================================

UPDATE oauth_integrations
SET
  access_token = '{
    "access_token": "YOUR_NEW_ACCESS_TOKEN_HERE",
    "token_type": "Bearer",
    "expires_in": 3599
  }'::json,
  expires_at = NOW() + INTERVAL '1 hour',
  updated_at = NOW()
WHERE provider = 'google_business'
  AND tenant_id IS NULL
  AND is_active = true;

-- ============================================================================
-- VERIFY UPDATE
-- ============================================================================

SELECT
  id,
  provider,
  expires_at,
  updated_at
FROM oauth_integrations
WHERE provider = 'google_business'
  AND tenant_id IS NULL;
