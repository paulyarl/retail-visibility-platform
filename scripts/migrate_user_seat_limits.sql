-- Manual Migration: Populate max_users on subscription_tiers_list
-- based on the USER_LIMITS config in tenant-limits.ts
--
-- Run this after the Prisma schema has been pushed / migrated
-- so the max_users column exists on subscription_tiers_list.
--
-- Usage:
--   psql $DATABASE_URL -f scripts/migrate_user_seat_limits.sql
--   OR via Supabase SQL Editor

BEGIN;

-- 1. Ensure column exists (safe to re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers_list'
    AND column_name = 'max_users'
  ) THEN
    ALTER TABLE subscription_tiers_list ADD COLUMN max_users INTEGER;
  END IF;
END
$$;

-- 2. Populate limits per tier (mirrors USER_LIMITS in tenant-limits.ts)
UPDATE subscription_tiers_list
SET max_users = CASE tier_key
  WHEN 'google_only'    THEN 1
  WHEN 'discovery'      THEN 2
  WHEN 'starter'        THEN 3
  WHEN 'storefront'     THEN 5
  WHEN 'commitment'     THEN 10
  WHEN 'professional'   THEN 15
  WHEN 'enterprise'     THEN 25
  WHEN 'organization'   THEN 0   -- 0 means unlimited
  ELSE 3  -- fallback to starter default
END;

-- 3. Verify results
SELECT
  tier_key,
  name,
  max_users,
  CASE
    WHEN max_users = 0 THEN 'Unlimited'
    ELSE max_users::text || ' users'
  END AS seat_display
FROM subscription_tiers_list
ORDER BY sort_order;

COMMIT;
