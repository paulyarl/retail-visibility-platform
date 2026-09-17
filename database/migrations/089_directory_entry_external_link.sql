-- ============================================================
-- Directory Entry External Link Capability Feature
-- + General-purpose Effective Capability Materialized View
--
-- Part 1: Seeds directory_entry_external_link feature key
-- Part 2: Adds external_link_enabled merchant preference column
-- Part 3: Creates mv_tenant_effective_capabilities — a general-purpose
--         MV that pre-resolves ALL capability features per tenant by
--         merging tier features, org tier features, and BSaaS purchases.
--         The directory API JOINs this MV to get canUseExternalLink
--         per store without calling the resolver N times.
--
--         Any future capability feature needing fast effective resolution
--         can reuse this same MV — just filter by feature_key.
--
-- Refresh schedule (set by admin via Supabase cron):
--   SELECT cron.schedule(
--     'refresh-mv_tenant_effective_capabilities',
--     '*/10 * * * *',
--     $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_effective_capabilities$$
--   );
-- ============================================================

-- ============================================================
-- Part 1: Seed feature key + link to capability type
-- ============================================================

DO $$
DECLARE
  v_capability_type_id TEXT;
  v_feature_key        TEXT  := 'directory_entry_external_link';
  v_feature_name       TEXT  := 'Directory Entry — External Link';
BEGIN
  SELECT id INTO v_capability_type_id FROM capability_type_list WHERE key = 'directory_entry';
  IF v_capability_type_id IS NULL THEN
    RAISE EXCEPTION 'Capability type "directory_entry" not found. Run directory_entry_capability_features.sql first.';
  END IF;

  INSERT INTO features_list (key, name, is_active, created_at, updated_at)
  VALUES (v_feature_key, v_feature_name, true, NOW(), NOW())
  ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

  INSERT INTO capability_features_list (capability_type_id, feature_id, is_active, sort_order, created_at, updated_at)
  SELECT v_capability_type_id, fl.id, true,
    (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM capability_features_list WHERE capability_type_id = v_capability_type_id),
    NOW(), NOW()
  FROM features_list fl
  WHERE fl.key = v_feature_key
  ON CONFLICT DO NOTHING;

  -- Tier assignments are managed via the Admin UI at /settings/admin/capabilities
  -- Flexible tiers (professional, chain_professional, organization, enterprise, trial_professional)
  -- get this automatically via directory_entry_flexible once linked.
  -- Lower tiers can purchase via BSaaS Feature Store if a catalog entry is added.
END $$;

-- ============================================================
-- Part 2: Add merchant preference column
-- ============================================================

ALTER TABLE tenant_storefront_options_settings
ADD COLUMN IF NOT EXISTS external_link_enabled Boolean DEFAULT false;

-- ============================================================
-- Part 3: Create general-purpose effective capability MV
--
-- mv_tenant_effective_capabilities
--   One row per (tenant_id, feature_key) where the feature is
--   effectively enabled for that tenant from any source.
--
-- Sources merged (most-permissive-wins, mirrors EffectiveCapabilityResolver):
--   1. Tenant tier features (tier_features_list)
--   2. Org tier features (if tenant belongs to an organization)
--   3. BSaaS purchases (tenant_feature_purchases, status in active/past_due/trial)
--
-- Trial tiers are mapped to base tiers so trial users get the same
-- capability as their base tier (mirrors getEffectiveTier()).
--
-- Usage example (directory API):
--   LEFT JOIN mv_tenant_effective_capabilities mec
--     ON mec.tenant_id = dll.tenant_id
--     AND mec.feature_key = 'directory_entry_external_link'
--   -- mec.is_enabled IS TRUE means the tenant has the feature
--
-- Unique index on (tenant_id, feature_key) enables CONCURRENTLY refresh.
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS mv_tenant_effective_capabilities CASCADE;

CREATE MATERIALIZED VIEW mv_tenant_effective_capabilities AS
WITH trial_map AS (
  SELECT * FROM (VALUES
    ('trial_google_only',        'google_only'),
    ('trial_discovery',          'discovery'),
    ('trial_starter',            'starter'),
    ('trial_storefront',         'storefront'),
    ('trial_commitment',         'commitment'),
    ('trial_professional',       'professional'),
    ('trial_ecommerce',          'ecommerce'),
    ('trial_omnichannel',        'omnichannel'),
    ('trial_enterprise',         'enterprise'),
    ('trial_chain_starter',      'chain_starter'),
    ('trial_chain_professional', 'chain_professional'),
    ('trial_chain_enterprise',   'chain_enterprise')
  ) AS t(trial_key, base_key)
),
-- Resolve effective tier keys for each tenant (tenant tier + org tier)
tenant_tiers AS (
  SELECT
    t.id AS tenant_id,
    COALESCE(tm.base_key, t.subscription_tier) AS effective_tenant_tier,
    CASE
      WHEN o.subscription_tier IS NOT NULL THEN
        COALESCE(om.base_key, o.subscription_tier)
      ELSE NULL
    END AS effective_org_tier
  FROM tenants t
  LEFT JOIN organizations_list o ON t.organization_id = o.id
  LEFT JOIN trial_map tm ON tm.trial_key = t.subscription_tier
  LEFT JOIN trial_map om ON om.trial_key = o.subscription_tier
),
-- Collect all tier IDs applicable to each tenant
tier_ids AS (
  SELECT tt.tenant_id, stl.id AS tier_id
  FROM tenant_tiers tt
  LEFT JOIN subscription_tiers_list stl ON stl.tier_key = tt.effective_tenant_tier
  UNION
  SELECT tt.tenant_id, stl.id AS tier_id
  FROM tenant_tiers tt
  LEFT JOIN subscription_tiers_list stl ON stl.tier_key = tt.effective_org_tier
  WHERE stl.id IS NOT NULL
),
-- Tier-granted features (explicit)
tier_features AS (
  SELECT
    ti.tenant_id,
    tfl.feature_key
  FROM tier_ids ti
  JOIN tier_features_list tfl ON tfl.tier_id = ti.tier_id AND tfl.is_enabled = true
),
-- Flexible tier expansion: when a tier has a `{capability_key}_flexible` feature,
-- expand to ALL features linked to that capability type.
-- This mirrors the resolver pattern: flexible = !!features.{capability_key}_flexible
-- which grants all features in the capability type.
flexible_tier_features AS (
  SELECT
    ti.tenant_id,
    fl.key AS feature_key
  FROM tier_ids ti
  JOIN tier_features_list tfl ON tfl.tier_id = ti.tier_id AND tfl.is_enabled = true
  JOIN capability_type_list ctl ON ctl.id = tfl.capability_type_id
  JOIN capability_features_list cfl ON cfl.capability_type_id = ctl.id AND cfl.is_active = true
  JOIN features_list fl ON fl.id = cfl.feature_id AND fl.is_active = true
  WHERE tfl.feature_key = ctl.key || '_flexible'
),
-- BSaaS purchased features (explicit feature keys)
purchase_features AS (
  SELECT
    tenant_id,
    feature_key
  FROM tenant_feature_purchases
  WHERE status IN ('active', 'past_due', 'trial')
    AND (expires_at IS NULL OR expires_at > NOW())
),
-- Flexible purchase expansion: when a tenant purchases a `{capability_key}_flexible`
-- feature via BSaaS (single or bundle), expand to ALL features in that capability type.
-- Sources: bsaas_catalog single purchases, bsaas_bundles bundle purchases,
-- and admin-granted complimentary promotions that write to tenant_feature_purchases.
flexible_purchase_features AS (
  SELECT
    pf.tenant_id,
    fl.key AS feature_key
  FROM purchase_features pf
  JOIN features_list pfl ON pfl.key = pf.feature_key AND pfl.is_active = true
  JOIN capability_features_list cfl ON cfl.feature_id = pfl.id AND cfl.is_active = true
  JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
  JOIN capability_features_list all_cfl ON all_cfl.capability_type_id = ctl.id AND all_cfl.is_active = true
  JOIN features_list fl ON fl.id = all_cfl.feature_id AND fl.is_active = true
  WHERE pf.feature_key = ctl.key || '_flexible'
),
-- Admin overrides: granted features via tenant_feature_overrides_list
-- Admin can grant any feature to a tenant through the OverrideService,
-- including flexible access that expands to all features in a capability type.
override_features AS (
  SELECT
    tenant_id,
    feature AS feature_key
  FROM tenant_feature_overrides_list
  WHERE granted = true
    AND (expires_at IS NULL OR expires_at > NOW())
),
-- Flexible override expansion: when an admin grants a `{capability_key}_flexible`
-- override, expand to ALL features in that capability type.
flexible_override_features AS (
  SELECT
    of.tenant_id,
    fl.key AS feature_key
  FROM override_features of
  JOIN features_list ofl ON ofl.key = of.feature_key AND ofl.is_active = true
  JOIN capability_features_list cfl ON cfl.feature_id = ofl.id AND cfl.is_active = true
  JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
  JOIN capability_features_list all_cfl ON all_cfl.capability_type_id = ctl.id AND all_cfl.is_active = true
  JOIN features_list fl ON fl.id = all_cfl.feature_id AND fl.is_active = true
  WHERE of.feature_key = ctl.key || '_flexible'
)
-- Union all sources — one row per (tenant_id, feature_key) that is effectively enabled
SELECT
  tenant_id,
  feature_key,
  TRUE AS is_enabled
FROM (
  SELECT tenant_id, feature_key FROM tier_features
  UNION
  SELECT tenant_id, feature_key FROM flexible_tier_features
  UNION
  SELECT tenant_id, feature_key FROM purchase_features
  UNION
  SELECT tenant_id, feature_key FROM flexible_purchase_features
  UNION
  SELECT tenant_id, feature_key FROM override_features
  UNION
  SELECT tenant_id, feature_key FROM flexible_override_features
) merged;

-- Unique index enables CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_mv_tenant_effective_capabilities
  ON mv_tenant_effective_capabilities (tenant_id, feature_key);

-- Index on feature_key for filtering
CREATE INDEX idx_mv_tenant_effective_capabilities_feature
  ON mv_tenant_effective_capabilities (feature_key);

-- ============================================================
-- Verification
-- ============================================================

-- Verify feature registration
SELECT
  ctl.key AS capability_type,
  fl.key  AS feature_key,
  fl.name AS feature_name
FROM capability_features_list cfl
JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
JOIN features_list fl ON fl.id = cfl.feature_id
WHERE ctl.key = 'directory_entry' AND fl.key = 'directory_entry_external_link';

-- Verify tier assignments
SELECT
  stl.tier_key,
  tfl.feature_key,
  tfl.is_enabled
FROM tier_features_list tfl
JOIN subscription_tiers_list stl ON stl.id = tfl.tier_id
WHERE tfl.feature_key = 'directory_entry_external_link'
ORDER BY stl.tier_key;

-- Verify MV has data
SELECT COUNT(*) AS total_rows FROM mv_tenant_effective_capabilities;

-- Verify MV for our specific feature
SELECT
  tenant_id,
  feature_key,
  is_enabled
FROM mv_tenant_effective_capabilities
WHERE feature_key = 'directory_entry_external_link'
LIMIT 10;
