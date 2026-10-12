-- 331_storefront_domains_capability.sql
--
-- Module-responsibility split (rules: R14 one-capability-one-concern, R37).
-- Moves storefront ADDRESSING entitlements (level-2 platform subdomain,
-- level-3 custom domain) OUT of `storefront_options` — the merchant-facing
-- settings configurator — into a dedicated entitlement capability type:
-- `storefront_domains`.
--
-- Why: storefront_options gates display/behavior toggles with merchant
-- prefs (tenant_storefront_options_settings). Addressing is operator/
-- platform-administered — state lives in tenants.subdomain / custom_domains
-- rows + DNS, there are no merchant prefs — so it never belonged in the
-- configurator module. It was also the cause of the Discovery tier
-- workaround: under the contract, `storefront_opt_disabled` vetoes the
-- whole module, so carrying the subdomain inside it forced a fabricated
-- `storefront_opt_enabled` (migration 330). With a dedicated module,
-- Discovery's data is honest again: options disabled + domains granted.
--
--   storefront_domains_enabled            module ON gate
--   storefront_domains_disabled           module OFF gate (absolute veto)
--   storefront_domains_flexible           all levels unlocked
--   storefront_domains_platform_subdomain level 2 — {slug}.visibleshelf.com
--   storefront_domains_custom_domain      level 3 — tenant-owned domain
--
-- Re-keys (no semantic change to grants):
--   tier_features_list:    storefront_opt_platform_subdomain → storefront_domains_platform_subdomain
--                          storefront_opt_custom_domain      → storefront_domains_custom_domain
--   tenant_feature_purchases / tenant_feature_overrides_list — same re-keys
--   bsaas_catalog SKU:     storefront_opt_custom_domain      → storefront_domains_custom_domain
--
-- Discovery honest shape: `storefront_opt_enabled` (fabricated by 330) is
-- deactivated and `storefront_opt_disabled` restored to active; the
-- subdomain now lives in the domains module where the options veto can't
-- reach it.
--
-- directory_presence baseline: `storefront_domains_enabled` — the level-1
-- platform path IS their addressing surface, and it satisfies the
-- checkCapabilityEngagement gate for future à-la-carte SKU eligibility.
--
-- Idempotent throughout. Old keys are deactivated + unlinked.

BEGIN;

-- ─── 1. Capability type ──────────────────────────────────────────────────

INSERT INTO capability_type_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES (
  'storefront_domains',
  'Storefront Domains',
  'Storefront addressing entitlements — the three-level presentation model (platform path, platform subdomain, tenant-owned custom domain). Operator/platform-administered: state lives in tenants.subdomain and custom_domains rows, not merchant preferences.',
  'storefront',
  true,
  9,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();

-- ─── 2. Feature keys ─────────────────────────────────────────────────────

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('storefront_domains_enabled',  'Storefront Domains Enabled',
   'Master ON gate — storefront addressing module active for the tier. Level 1 (platform path) is the universal baseline.',
   'storefront_domains', true, 0, NOW(), NOW()),
  ('storefront_domains_disabled', 'Storefront Domains Disabled',
   'Master OFF gate — explicitly disengages the addressing module; absolute veto over every level.',
   'storefront_domains', true, 0, NOW(), NOW()),
  ('storefront_domains_flexible', 'Storefront Domains Flexible',
   'Unlocks every addressing level in the module (platform subdomain + custom domain).',
   'storefront_domains', true, 0, NOW(), NOW()),
  ('storefront_domains_platform_subdomain', 'Platform Subdomain',
   'Level 2 — tenant storefront reachable at {slug}.visibleshelf.com (platform-hosted domain). Entitlement for the assignment action; required by the Google surface.',
   'storefront_domains', true, 1, NOW(), NOW()),
  ('storefront_domains_custom_domain', 'Custom Domain',
   'Level 3 — tenant-owned domain (apex, www, or subdomain host) serving the tenant storefront with Vercel-managed verification + TLS. Composes with the custom_domains platform flag.',
   'storefront_domains', true, 2, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at  = NOW();

-- ─── 3. Capability links ─────────────────────────────────────────────────

DO $$
DECLARE
  v_cap_id  TEXT;
  v_key     TEXT;
  v_feat_id TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = 'storefront_domains';
  IF v_cap_id IS NULL THEN
    RAISE EXCEPTION 'capability type storefront_domains not found';
  END IF;

  FOREACH v_key IN ARRAY ARRAY[
    'storefront_domains_enabled',
    'storefront_domains_disabled',
    'storefront_domains_flexible',
    'storefront_domains_platform_subdomain',
    'storefront_domains_custom_domain'
  ] LOOP
    SELECT id INTO v_feat_id FROM features_list WHERE key = v_key;
    IF v_feat_id IS NOT NULL THEN
      INSERT INTO capability_features_list (capability_type_id, feature_id)
      VALUES (v_cap_id, v_feat_id)
      ON CONFLICT DO NOTHING;
    ELSE
      RAISE NOTICE 'feature key % not found — skipped', v_key;
    END IF;
  END LOOP;
END $$;

-- ─── 4. Re-key tier grants ───────────────────────────────────────────────

DO $$
DECLARE
  v_cap_id TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = 'storefront_domains';

  UPDATE tier_features_list
  SET feature_key        = 'storefront_domains_platform_subdomain',
      capability_type_id = v_cap_id,
      feature_name       = 'Platform Subdomain',
      metadata           = '{"capability_type": "storefront_domains"}',
      updated_at         = NOW()
  WHERE feature_key = 'storefront_opt_platform_subdomain';

  UPDATE tier_features_list
  SET feature_key        = 'storefront_domains_custom_domain',
      capability_type_id = v_cap_id,
      feature_name       = 'Custom Domain',
      metadata           = '{"capability_type": "storefront_domains"}',
      updated_at         = NOW()
  WHERE feature_key = 'storefront_opt_custom_domain';
END $$;

-- ─── 5. Discovery — restore the honest shape ─────────────────────────────
-- Migration 330 fabricated storefront_opt_enabled to carry the subdomain
-- under the veto contract. The dedicated module removes the need: options
-- disabled (true intent) + domains granted separately.

DO $$
DECLARE
  v_tier_id TEXT;
BEGIN
  SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = 'discovery';
  IF v_tier_id IS NOT NULL THEN
    UPDATE tier_features_list
    SET is_enabled = true, updated_at = NOW()
    WHERE tier_id = v_tier_id AND feature_key = 'storefront_opt_disabled';

    UPDATE tier_features_list
    SET is_enabled = false, updated_at = NOW()
    WHERE tier_id = v_tier_id AND feature_key = 'storefront_opt_enabled';
  END IF;
END $$;

-- ─── 6. directory_presence — level-1 baseline ────────────────────────────
-- Their platform path IS an addressing surface; `_enabled` is the honest
-- module baseline and satisfies checkCapabilityEngagement for à-la-carte
-- SKU eligibility.

DO $$
DECLARE
  v_tier_id TEXT;
  v_cap_id  TEXT;
BEGIN
  SELECT id INTO v_tier_id FROM subscription_tiers_list WHERE tier_key = 'directory_presence';
  SELECT id INTO v_cap_id  FROM capability_type_list   WHERE key = 'storefront_domains';
  IF v_tier_id IS NOT NULL AND v_cap_id IS NOT NULL THEN
    INSERT INTO tier_features_list (
      id, tier_id, capability_type_id, feature_key, feature_name,
      is_enabled, is_inherited, metadata
    ) VALUES (
      gen_random_uuid()::text, v_tier_id, v_cap_id,
      'storefront_domains_enabled', 'Storefront Domains',
      true, false, '{"capability_type": "storefront_domains"}'
    )
    ON CONFLICT (tier_id, feature_key) DO UPDATE
      SET is_enabled = true, updated_at = NOW();
  END IF;
END $$;

-- ─── 7. Re-key live grants ───────────────────────────────────────────────

UPDATE tenant_feature_purchases
SET feature_key = 'storefront_domains_platform_subdomain', updated_at = NOW()
WHERE feature_key = 'storefront_opt_platform_subdomain';
UPDATE tenant_feature_purchases
SET feature_key = 'storefront_domains_custom_domain', updated_at = NOW()
WHERE feature_key = 'storefront_opt_custom_domain';

UPDATE tenant_feature_overrides_list
SET feature = 'storefront_domains_platform_subdomain', updated_at = NOW()
WHERE feature = 'storefront_opt_platform_subdomain';
UPDATE tenant_feature_overrides_list
SET feature = 'storefront_domains_custom_domain', updated_at = NOW()
WHERE feature = 'storefront_opt_custom_domain';

-- ─── 8. Re-key the BSaaS SKU ─────────────────────────────────────────────

UPDATE bsaas_catalog
SET feature_key = 'storefront_domains_custom_domain', updated_at = NOW()
WHERE feature_key = 'storefront_opt_custom_domain';

-- ─── 9. Retire the old keys ──────────────────────────────────────────────

DELETE FROM capability_features_list
WHERE feature_id IN (
  SELECT id FROM features_list
  WHERE key IN ('storefront_opt_platform_subdomain', 'storefront_opt_custom_domain')
);

UPDATE features_list
SET is_active = false, updated_at = NOW()
WHERE key IN ('storefront_opt_platform_subdomain', 'storefront_opt_custom_domain');

COMMIT;

-- MV refresh — outside the txn (CONCURRENTLY cannot run inside a block).
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_effective_capabilities;

-- Verification:
--   SELECT t.tier_key, tf.feature_key, tf.is_enabled
--   FROM tier_features_list tf JOIN subscription_tiers_list t ON t.id = tf.tier_id
--   WHERE tf.feature_key LIKE 'storefront_domains_%' ORDER BY t.tier_key;
--   -- discovery: storefront_opt_disabled=true, storefront_opt_enabled=false,
--   --            storefront_domains_platform_subdomain=true
--   SELECT feature_key FROM bsaas_catalog WHERE feature_key LIKE '%custom_domain%';
