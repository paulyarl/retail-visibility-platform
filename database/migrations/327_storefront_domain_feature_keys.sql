-- 327_storefront_domain_feature_keys.sql
--
-- Custom Domains sprint (docs/CUSTOM_DOMAINS_SPRINT_PLAN.md), Phase 1.7(a).
-- Seeds the two storefront-presentation capability keys on the existing
-- `storefront_options` capability type (D12 — feature keys, not a module):
--
--   storefront_opt_platform_subdomain  — level 2 entitlement: the platform
--     may host the tenant's storefront at {slug}.visibleshelf.com. The
--     assignment ACTION stays separate (tenants.subdomain); the resolve
--     path is never gated (grandfathering — existing subdomains keep
--     serving regardless of entitlement).
--   storefront_opt_custom_domain       — level 3 entitlement: the tenant
--     may attach a tenant-owned domain (this sprint's feature). Composes
--     with the `custom_domains` platform flag (D10): flag = deployed-to-you,
--     capability = entitled-to-you.
--
-- Grant policy:
--   custom_domain   → professional, organization (D4/D12). chain_enterprise
--                     and other flexible holders inherit via the resolver's
--                     `flexible ||` prefix (R23) — NOT a table grant.
--   platform_subdomain → the paid storefront-bearing tiers that carry the
--                     Google-surface requirement (Discovery rungs as the
--                     required minimum; Storefront rungs inherit Google's
--                     baseline per V3.1; scale tiers inherit the surface).
--                     OPEN PRODUCT CALL (D12): free/directory tiers are
--                     deliberately ungranted here — grandfathering covers
--                     existing assignments; widen via tier_features_list
--                     if product bundles it lower.
--
-- Skill: .devin/skills/add-capability-feature.md — seed FIRST, before any
-- resolver or frontend code (unseeded keys resolve false and are invisible
-- in the Admin UI).

BEGIN;

-- ─── 1. Feature keys ─────────────────────────────────────────────────────

INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('storefront_opt_platform_subdomain',
   'Platform Subdomain',
   'Tenant storefront reachable at {slug}.visibleshelf.com (platform-hosted domain). Entitlement for the assignment action; required by the Google surface (Discovery rungs) which needs a domain-hosted storefront URL.',
   'storefront_options', true, 0, NOW(), NOW()),
  ('storefront_opt_custom_domain',
   'Custom Domain',
   'Tenant-owned domain (apex, www, or subdomain host) serving the tenant storefront with Vercel-managed verification + TLS. Gated feature — composes with the custom_domains platform flag (deployed-to-you AND entitled-to-you).',
   'storefront_options', true, 0, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at  = NOW();

-- ─── 2. Link to capability type ──────────────────────────────────────────

DO $$
DECLARE
  v_cap_id  TEXT;
  v_key     TEXT;
  v_feat_id TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = 'storefront_options';
  IF v_cap_id IS NULL THEN
    RAISE EXCEPTION 'capability type storefront_options not found';
  END IF;

  FOREACH v_key IN ARRAY ARRAY[
    'storefront_opt_platform_subdomain',
    'storefront_opt_custom_domain'
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

-- ─── 3. Tier grants ──────────────────────────────────────────────────────

DO $$
DECLARE
  v_cap_id         TEXT;
  v_tier_id        TEXT;
  v_tier_key       TEXT;

  -- Level 3: custom_domain grant set (D4/D12)
  v_custom_tiers   TEXT[] := ARRAY[
    'professional',
    'organization'
  ];

  -- Level 2: platform_subdomain grant set — Google-surface-required tiers
  -- (Discovery rungs) + storefront-bearing tiers that inherit the surface.
  -- Free/directory tiers intentionally absent (D12 open product call).
  v_subdomain_tiers TEXT[] := ARRAY[
    'discovery', 'discovery_plus', 'discovery_premium',
    'storefront', 'storefront_plus', 'storefront_premium',
    'commitment', 'ecommerce', 'omnichannel',
    'professional', 'organization', 'enterprise'
  ];
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = 'storefront_options';
  IF v_cap_id IS NULL THEN
    RAISE EXCEPTION 'capability type storefront_options not found';
  END IF;

  FOREACH v_tier_key IN ARRAY v_custom_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list
      WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;
    INSERT INTO tier_features_list (
      id, tier_id, capability_type_id, feature_key, feature_name,
      is_enabled, is_inherited, metadata
    ) VALUES (
      gen_random_uuid()::text, v_tier_id, v_cap_id,
      'storefront_opt_custom_domain', 'Custom Domain',
      true, false, '{"capability_type": "storefront_options"}'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;

  FOREACH v_tier_key IN ARRAY v_subdomain_tiers LOOP
    SELECT id INTO v_tier_id FROM subscription_tiers_list
      WHERE tier_key = v_tier_key AND is_active = true LIMIT 1;
    IF v_tier_id IS NULL THEN
      RAISE NOTICE 'tier % not found or inactive — skipping', v_tier_key;
      CONTINUE;
    END IF;
    INSERT INTO tier_features_list (
      id, tier_id, capability_type_id, feature_key, feature_name,
      is_enabled, is_inherited, metadata
    ) VALUES (
      gen_random_uuid()::text, v_tier_id, v_cap_id,
      'storefront_opt_platform_subdomain', 'Platform Subdomain',
      true, false, '{"capability_type": "storefront_options"}'
    )
    ON CONFLICT (tier_id, feature_key) DO NOTHING;
  END LOOP;
END $$;

-- mv_tenant_effective_capabilities is materialized — refresh so the new
-- grants resolve immediately (same pattern as migration 321).
REFRESH MATERIALIZED VIEW mv_tenant_effective_capabilities;

COMMIT;

-- Verification queries:
--   SELECT key, name, is_active FROM features_list
--     WHERE key IN ('storefront_opt_platform_subdomain','storefront_opt_custom_domain');
--   SELECT stl.tier_key, tfl.feature_key, tfl.is_enabled
--     FROM tier_features_list tfl
--     JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
--     WHERE tfl.feature_key LIKE 'storefront_opt_%domain%' OR tfl.feature_key = 'storefront_opt_platform_subdomain';
--   SELECT ctl.key AS capability_type, fl.key AS feature
--     FROM capability_features_list cfl
--     JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
--     JOIN features_list fl ON fl.id = cfl.feature_id
--     WHERE fl.key IN ('storefront_opt_platform_subdomain','storefront_opt_custom_domain');
