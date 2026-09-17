-- 235_intelligence_profile_category_key_normalize.sql
-- Backfills mkt_intelligence_profiles.category_key so that snake_case or
-- kebab-case keys (produced by LLM gold-standard scans that interpreted
-- "spaces collapsed" as "replace with underscores/hyphens") are normalized
-- to the canonical space-separated form that normalizeCategoryKey() and
-- resolve() expect.
--
-- Example: "beauty_supply" → "beauty supply"
--          "auto-repair"   → "auto repair"
--
-- This is a one-time data fix. Going forward, importAsDraft() and
-- createProfile() call normalizeCategoryKey() which now also replaces
-- underscores and hyphens with spaces, so new imports are born canonical.

UPDATE mkt_intelligence_profiles
  SET category_key = trim(regexp_replace(lower(category_key), '[_-]+', ' ', 'g')),
      updated_at = now()
  WHERE category_key ~ '[_-]';
