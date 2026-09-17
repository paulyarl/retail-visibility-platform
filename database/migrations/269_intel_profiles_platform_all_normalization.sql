-- Migration 269: Normalize cross-platform intelligence profiles
--
-- Bug: the intelligence_profile import path (GAP-P8 hook in
-- MarketingPromptService) persisted the establishment campaign's
-- intelligence_platform verbatim, so two establishment campaigns created
-- identically WITHOUT a specific platform could produce profiles with
-- DIFFERENT stored platform scopes:
--   campaign.intelligence_platform = 'all'  → reference_platform = 'all'
--   campaign.intelligence_platform = ''     → reference_platform = NULL
-- Both mean the same thing — cross-platform scope (Migration 236 stores
-- cross-platform profiles with reference_platform = NULL) — but the split
-- representation breaks the scope-tuple identity:
--   - importAsDraft's (category, focus, city, state, platform) lookup misses
--     the legacy 'all' row, so re-importing the same establishment creates a
--     new profile id instead of versioning the existing profile
--   - idx_mkt_intel_profiles_active_scope (Migration 249) treats 'all' and
--     NULL as distinct slots, allowing two "active cross-platform" profiles
--     for the same semantic scope
--   - the profile list UI rendered a platform badge only for non-NULL
--     values, so one of the two cards showed no platform scope at all
--
-- Fix: normalize every cross-platform profile to reference_platform = NULL.
-- The write path now normalizes 'all' → NULL (IntelligenceProfileService
-- createProfile / importAsDraft via normalizePlatformScope); this migration
-- converges the legacy rows.
--
-- Guarded: an 'all' row is only converted when no other row already occupies
-- the same (category_key, intelligence_focus, reference_city, reference_state)
-- scope with a NULL platform — otherwise the UPDATE would violate the
-- partial unique index. Colliding rows keep 'all' (the resolver's Step 1
-- exact-'all' match still resolves them, and the UI maps 'all' → the same
-- "All Platforms" badge), so this migration is safe to re-run.

UPDATE mkt_intelligence_profiles p
SET reference_platform = NULL,
    updated_at = NOW()
WHERE reference_platform IN ('all', '')
  AND NOT EXISTS (
    SELECT 1
    FROM mkt_intelligence_profiles q
    WHERE q.category_key = p.category_key
      AND q.intelligence_focus = p.intelligence_focus
      AND COALESCE(q.reference_city, '__none__') = COALESCE(p.reference_city, '__none__')
      AND COALESCE(q.reference_state, '__none__') = COALESCE(p.reference_state, '__none__')
      AND q.reference_platform IS NULL
  );
