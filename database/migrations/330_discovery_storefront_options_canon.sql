-- 330_discovery_storefront_options_canon.sql
--
-- ⚠ SUPERSEDED by 331_storefront_domains_capability.sql (same day).
-- This file was written under the pre-move architecture — it fabricates
-- `storefront_opt_enabled` on discovery to keep the platform_subdomain key
-- alive under the `_disabled` veto. After 331, the domain entitlement lives
-- in the dedicated `storefront_domains` module and discovery's honest shape
-- is `opt_disabled` ACTIVE + `opt_enabled` INACTIVE. Applying this file
-- after 331 would re-corrupt that shape — the DO block below guards on the
-- `storefront_domains` capability type and no-ops when it exists.
-- NEVER apply this to an environment that has run 331.
--
-- Capability-contract data fix — `discovery` tier's storefront_options
-- assignment.
--
-- Canon (declared contract):
--   `_disabled` explicitly deactivates the ENTIRE module for the tier.
--   `_flexible` explicitly activates the ENTIRE module (all keys).
--   `_enabled` optionally activates the module — keys granted individually.
--   `_enabled` absent + any active module key → implicit `_enabled`.
--
-- Violation found in prod (2026-10-12): `discovery` carried
--   storefront_opt_disabled    (module veto)
--   storefront_opt_platform_subdomain (level-2 entitlement)
-- which "worked" only because the D12 fields resolved outside `mainOn`.
-- The resolvers/gates now enforce the veto, so the data must be canonical:
-- `_enabled` (module on) + `storefront_opt_platform_subdomain` (the desired
-- key) — no `_disabled`.
--
-- Mechanics: `tier_features_list.is_enabled` is the per-row active flag, so
-- `_disabled` is soft-deactivated (row kept as an inactive assignment) and
-- `_enabled` is upserted active. Idempotent.

BEGIN;

DO $$
DECLARE
  v_tier_id text;
  v_cap_id  text;
BEGIN
  -- Supersession guard: 331 moved the addressing keys to `storefront_domains`
  -- and restored discovery's honest shape (opt_disabled active). If that
  -- capability type exists, this workaround must NOT run — it would undo it.
  IF EXISTS (SELECT 1 FROM capability_type_list WHERE key = 'storefront_domains') THEN
    RAISE NOTICE '330: superseded by 331 (storefront_domains exists) — skipping to preserve the honest discovery shape';
    RETURN;
  END IF;

  SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = 'discovery';
  SELECT id INTO v_cap_id  FROM capability_type_list   WHERE key = 'storefront_options';

  IF v_tier_id IS NULL OR v_cap_id IS NULL THEN
    RAISE NOTICE '330: discovery tier or storefront_options capability type not found — skipping';
    RETURN;
  END IF;

  -- Deactivate the veto key (kept as an inactive assignment for audit)
  UPDATE tier_features_list
  SET is_enabled = false, updated_at = NOW()
  WHERE tier_id = v_tier_id
    AND feature_key = 'storefront_opt_disabled'
    AND is_enabled = true;

  -- Activate the module
  INSERT INTO tier_features_list (
    id, tier_id, capability_type_id, feature_key, feature_name,
    is_enabled, is_inherited, metadata
  ) VALUES (
    gen_random_uuid()::text, v_tier_id, v_cap_id,
    'storefront_opt_enabled', 'Storefront Options',
    true, false, '{"capability_type": "storefront_options"}'
  )
  ON CONFLICT (tier_id, feature_key) DO UPDATE
    SET is_enabled = true, updated_at = NOW();
END $$;

COMMIT;

-- MV refresh so the corrected composition resolves on the next read —
-- the write gates also union live sources, but the resolver is MV-bound.
-- Outside the txn: CONCURRENTLY cannot run inside a transaction block.
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_effective_capabilities;

-- Verification:
--   SELECT t.tier_key, tf.feature_key, tf.is_enabled
--   FROM tier_features_list tf
--   JOIN subscription_tiers_list t ON t.id = tf.tier_id
--   WHERE t.tier_key = 'discovery' AND tf.feature_key LIKE 'storefront_opt_%';
--   -- expect: platform_subdomain(true), enabled(true), disabled(false), others false
