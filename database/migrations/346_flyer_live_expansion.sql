-- Migration 346: Flyer concurrent-live expansion keys
--
-- The concurrent live-flyer cap was a flat MAX_LIVE_FLYERS = 2 constant
-- (spec §3) for every tier. These keys raise it the same way
-- flyer_items_5/10/20 raise items-per-flyer:
--
--   flyer_live_3 — up to 3 concurrent live flyers
--   flyer_live_5 — up to 5 concurrent live flyers
--
-- Semantics:
--   * Expansion keys, not activation keys — FlyerResolver excludes
--     flyer_live_* from mainOn, so granting one to a non-flyer tenant
--     does NOT enable the module.
--   * Default stays 2 (no key required) — every flyer-enabled tenant
--     keeps current behaviour.
--   * flyer_flexible sweeps them (max_live → 5): premium tiers already
--     holding flyer_flexible get the expansion for free, while the keys
--     remain purchasable BSaaS grants for lower tiers via
--     tenant_feature_overrides_list.
--   * Display contract: ≤2 live flyers render as the vertical stack;
--     >2 render as a snap carousel (FlyerSection).
--
-- Idempotent: ON CONFLICT guards throughout.

BEGIN;

-- ============================================================
-- 1. features_list — flyer_live_* keys (module 'flyer')
-- ============================================================

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('flyer_live_3', 'Flyer: 3 Live', 'Up to 3 concurrent live flyers (display switches to carousel)', 'flyer', true, 13, NOW(), NOW()),
  ('flyer_live_5', 'Flyer: 5 Live', 'Up to 5 concurrent live flyers (display switches to carousel)', 'flyer', true, 14, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  is_active   = EXCLUDED.is_active,
  updated_at  = NOW();

-- ============================================================
-- 2. capability_features_list links — under the 'flyer' type so
--    flyer_flexible expansion covers them (display feature, not a
--    channel action — unlike flyer_gbp_publish which stays split).
--    No tier_features_list grants: purchasable + flexible-covered.
-- ============================================================

DO $$
DECLARE
  v_flyer_type_id TEXT;
  v_key           TEXT;
  v_feature_id    TEXT;
BEGIN
  SELECT id INTO v_flyer_type_id FROM capability_type_list WHERE key = 'flyer' LIMIT 1;
  IF v_flyer_type_id IS NULL THEN
    RAISE EXCEPTION 'flyer capability type row missing — run migration 344 first';
  END IF;

  FOR v_key IN
    SELECT * FROM (VALUES ('flyer_live_3'), ('flyer_live_5')) AS t(key)
  LOOP
    SELECT id INTO v_feature_id FROM features_list WHERE key = v_key LIMIT 1;
    IF v_feature_id IS NULL THEN
      RAISE NOTICE 'Feature % not found — skipping', v_key;
      CONTINUE;
    END IF;

    INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
    VALUES (v_flyer_type_id, v_feature_id, true, 0, NOW(), NOW())
    ON CONFLICT (capability_type_id, feature_id) DO UPDATE SET
      is_active = true, updated_at = NOW();
  END LOOP;
END $$;

COMMIT;
