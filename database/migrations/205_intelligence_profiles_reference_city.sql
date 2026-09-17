-- Migration 205: Intelligence Profile City Scoping
--
-- Closes the city-contamination gap: an intelligence profile established
-- from a city-A establishment campaign was being applied to a city-B
-- discovery campaign for the same (category, focus), injecting city-A
-- specific discovery patterns, supplier names, and business examples into
-- the city-B prompt. The discovery AI then returned city-A businesses.
--
-- Root cause: profiles were keyed on (category_key, intelligence_focus)
-- only — no city dimension. The resolver matched any active profile for
-- the (category, focus) pair regardless of which city it was established
-- in, and renderProfileBlock() injected the city-contaminated
-- configuration_json verbatim.
--
-- Changes:
--   1. Add reference_city VARCHAR(100) NULLABLE on mkt_intelligence_profiles.
--      NULL is the legacy sentinel: a profile with no recorded reference
--      city is treated as city-agnostic by the resolver's fallback path
--      (preserves backward compatibility for any profile we cannot
--      backfill from an establishment campaign).
--   2. Backfill reference_city from the most recent establishment campaign
--      matching each profile's category_key. Profiles whose category has
--      no establishment campaign remain NULL (city-agnostic fallback).
--   3. Drop idx_mkt_intel_profiles_active_category_focus and replace it
--      with idx_mkt_intel_profiles_active_category_city_focus on
--      (category_key, reference_city, intelligence_focus) WHERE
--      status = 'active' AND reference_city IS NOT NULL — allows one
--      active profile per (category, city, focus) triple.
--      A separate partial unique index on (category_key, intelligence_focus)
--      WHERE status = 'active' AND reference_city IS NULL preserves the
--      one-city-agnostic-profile-per-(category, focus) invariant.
--   4. Add a lookup index on (category_key, reference_city, intelligence_focus)
--      for the city-aware resolver.
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

-- 1. Add the reference_city column (nullable — NULL = city-agnostic legacy).
ALTER TABLE mkt_intelligence_profiles
  ADD COLUMN IF NOT EXISTS reference_city VARCHAR(100);

-- 2. Backfill reference_city from the most recent establishment campaign
--    matching each profile's category_key. We join on a normalized
--    category comparison (lower(trim(...))) because mkt_campaigns_list.category
--    is free-text while mkt_intelligence_profiles.category_key is already
--    normalized, and we filter to intelligence_campaign_kind = 'establishment'
--    so a discovery campaign in a different city does not poison the
--    backfill. When multiple establishment campaigns exist for a category,
--    the most recently created one wins (DISTINCT ON ... ORDER BY
--    created_at DESC) — this matches the operator's mental model that the
--    latest establishment run defines the profile's reference market.
UPDATE mkt_intelligence_profiles p
SET reference_city = sub.city
FROM (
  SELECT DISTINCT ON (lower(trim(category)))
         lower(trim(category)) AS norm_category,
         city
  FROM mkt_campaigns_list
  WHERE scope = 'intelligence'
    AND intelligence_campaign_kind = 'establishment'
    AND city IS NOT NULL
    AND city <> ''
  ORDER BY lower(trim(category)), created_at DESC
) sub
WHERE lower(trim(p.category_key)) = sub.norm_category
  AND p.reference_city IS NULL;

-- 3a. Drop the old per-(category, focus) unique index and replace it with
--     a per-(category, city, focus) unique index for city-scoped profiles.
DROP INDEX IF EXISTS idx_mkt_intel_profiles_active_category_focus;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_intel_profiles_active_category_city_focus
  ON mkt_intelligence_profiles (category_key, reference_city, intelligence_focus)
  WHERE status = 'active' AND reference_city IS NOT NULL;

-- 3b. Preserve the one-city-agnostic-profile-per-(category, focus) invariant
--     for legacy NULL-reference_city profiles. This prevents two
--     city-agnostic profiles from being active for the same (category, focus).
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_intel_profiles_active_category_focus_nullcity
  ON mkt_intelligence_profiles (category_key, intelligence_focus)
  WHERE status = 'active' AND reference_city IS NULL;

-- 4. Lookup by (category_key, reference_city, intelligence_focus) for the
--    city-aware resolver.
CREATE INDEX IF NOT EXISTS idx_mkt_intel_profiles_category_city_focus
  ON mkt_intelligence_profiles (category_key, reference_city, intelligence_focus);

-- Verification query (run manually after applying):
-- SELECT id, category_key, reference_city, intelligence_focus, status
--   FROM mkt_intelligence_profiles ORDER BY category_key, reference_city, version DESC;
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'mkt_intelligence_profiles' ORDER BY indexname;

COMMIT;
