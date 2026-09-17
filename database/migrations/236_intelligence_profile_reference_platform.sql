-- Migration 236: Intelligence Profile Reference Platform
--
-- Adds a `reference_platform` column to `mkt_intelligence_profiles` so
-- gold-standard profiles can be platform-scoped (e.g. a Google-only
-- gold-standard profile for "Beauty Supply" coexists with a cross-platform
-- profile for the same category).
--
-- Mirrors the existing `reference_city` pattern:
--   - NULL = cross-platform (the default, backward-compatible with all
--     existing profiles)
--   - 'google' | 'yelp' | 'facebook' | 'bbb' | 'apple_maps' | 'bing' =
--     platform-specific
--
-- Resolution fallback chain (in IntelligenceProfileService.resolve):
--   1. (category, focus, city, platform) exact match
--   2. (category, focus, city) with reference_platform = NULL (cross-platform fallback)
--   3. existing city-agnostic / focus-only / category-only fallbacks
--
-- The identity tuple for importAsDraft is now
--   (category_key, intelligence_focus, reference_city, reference_platform)
-- so a platform-specific scan creates a distinct profile id from a
-- cross-platform scan for the same (category, focus, city).

ALTER TABLE mkt_intelligence_profiles
  ADD COLUMN IF NOT EXISTS reference_platform VARCHAR(20);

-- Index for the platform-aware resolution path.
-- Matches the pattern of the existing city/state indexes.
CREATE INDEX IF NOT EXISTS idx_mkt_intel_profiles_category_platform_focus
  ON mkt_intelligence_profiles (category_key, reference_platform, intelligence_focus);
