-- Migration 249: Fix active-profile unique constraints for state/platform scoping
--
-- The existing partial unique indexes only considered (category_key,
-- reference_city, intelligence_focus) when enforcing "one active profile
-- per scope". State-scoped profiles (reference_city = NULL,
-- reference_state = 'INDIANA') collided with nationwide profiles
-- (reference_city = NULL, reference_state = NULL) under the old
-- idx_mkt_intel_profiles_active_category_focus_nullcity index because
-- both have reference_city IS NULL and the index didn't include
-- reference_state or reference_platform.
--
-- This migration replaces both partial unique indexes with versions that
-- include reference_state and reference_platform via COALESCE (treating
-- NULL as the sentinel string '__none__' so NULLs are distinguishable
-- in the unique constraint — PostgreSQL treats multiple NULLs as
-- non-equal by default, which would allow duplicate nationwide profiles).

-- 1. Drop the old null-city partial unique index (too narrow — collides
--    state-scoped with nationwide).
DROP INDEX IF EXISTS idx_mkt_intel_profiles_active_category_focus_nullcity;

-- 2. Drop the old non-null-city partial unique index (doesn't include
--    state or platform — a city-scoped profile in two different states
--    would collide).
DROP INDEX IF EXISTS idx_mkt_intel_profiles_active_category_city_focus;

-- 3. Create a single partial unique index covering ALL scope dimensions.
--    Uses COALESCE to convert NULLs to sentinels so that NULL and non-NULL
--    values are both treated as distinct values in the uniqueness check.
--    This enforces: at most one active profile per
--    (category_key, intelligence_focus, reference_city, reference_state,
--     reference_platform).
CREATE UNIQUE INDEX idx_mkt_intel_profiles_active_scope
  ON public.mkt_intelligence_profiles (
    category_key,
    intelligence_focus,
    COALESCE(reference_city, '__none__'),
    COALESCE(reference_state, '__none__'),
    COALESCE(reference_platform, '__none__')
  )
  WHERE status = 'active';
