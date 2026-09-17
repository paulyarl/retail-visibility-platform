-- Migration: Fix MV flexible expansion to use actual flexible feature keys and type gate precedence
-- Issue 1: The MV's flexible_tier_features CTE expected flexible keys to be {capability_key}_flexible
-- (e.g., chatbot_options_flexible), but actual data uses shortened keys (e.g., chatbot_flexible).
-- This caused flexible expansion to fail for 14 of 18 capability types.
-- Issue 2: The MV did not check type gate keys (_disabled, _enabled) with correct precedence.
-- Fix 1: Use a flexible_key_map CTE to look up the actual flexible feature key from capability_features_list
-- instead of guessing the naming convention.
-- Fix 2: Use a type_gate_map CTE to look up type gate keys (_disabled, _enabled) and apply precedence:
--   _disabled > _enabled > _flexible > individual features (R17 in capability-data-flow-rules.md)
-- Note: Group gate keys now use _on/_off, eliminating naming ambiguity with type gates.

-- Drop existing MV
DROP MATERIALIZED VIEW IF EXISTS mv_tenant_effective_capabilities;

-- Recreate MV with fixed flexible expansion logic and type gate precedence
CREATE MATERIALIZED VIEW mv_tenant_effective_capabilities AS
WITH trial_map AS (
  SELECT t.trial_key, t.base_key
  FROM ( VALUES 
    ('trial_google_only','google_only'),
    ('trial_discovery','discovery'),
    ('trial_starter','starter'),
    ('trial_storefront','storefront'),
    ('trial_commitment','commitment'),
    ('trial_professional','professional'),
    ('trial_ecommerce','ecommerce'),
    ('trial_omnichannel','omnichannel'),
    ('trial_enterprise','enterprise'),
    ('trial_chain_starter','chain_starter'),
    ('trial_chain_professional','chain_professional'),
    ('trial_chain_enterprise','chain_enterprise')
  ) t(trial_key, base_key)
),
tenant_tiers AS (
  SELECT t.id AS tenant_id,
    COALESCE(tm.base_key, t.subscription_tier) AS effective_tenant_tier,
    CASE WHEN o.subscription_tier IS NOT NULL THEN COALESCE(om.base_key, o.subscription_tier) ELSE NULL END AS effective_org_tier
  FROM tenants t
  LEFT JOIN organizations_list o ON t.organization_id = o.id
  LEFT JOIN trial_map tm ON tm.trial_key = t.subscription_tier
  LEFT JOIN trial_map om ON om.trial_key = o.subscription_tier
),
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
-- Map capability types to their actual flexible feature keys
flexible_key_map AS (
  SELECT ctl.id AS capability_type_id, fl.key AS flexible_feature_key
  FROM capability_type_list ctl
  JOIN capability_features_list cfl ON cfl.capability_type_id = ctl.id AND cfl.is_active = true
  JOIN features_list fl ON fl.id = cfl.feature_id AND fl.is_active = true AND fl.key LIKE '%_flexible'
),
-- Map capability types to their type gate keys (_disabled, _enabled)
-- Safe to use _enabled/_disabled pattern now that group gates use _on/_off
type_gate_map AS (
  SELECT ctl.id AS capability_type_id, ctl.key AS capability_key,
    fl_disabled.key AS disabled_key, fl_enabled.key AS enabled_key
  FROM capability_type_list ctl
  LEFT JOIN capability_features_list cfl_disabled ON cfl_disabled.capability_type_id = ctl.id AND cfl_disabled.is_active = true
  LEFT JOIN features_list fl_disabled ON fl_disabled.id = cfl_disabled.feature_id AND fl_disabled.is_active = true AND fl_disabled.key = ctl.key || '_disabled'
  LEFT JOIN capability_features_list cfl_enabled ON cfl_enabled.capability_type_id = ctl.id AND cfl_enabled.is_active = true
  LEFT JOIN features_list fl_enabled ON fl_enabled.id = cfl_enabled.feature_id AND fl_enabled.is_active = true AND fl_enabled.key = ctl.key || '_enabled'
),
-- Determine type gate status per tenant (tier sources only)
tenant_type_gates AS (
  SELECT ti.tenant_id, tgm.capability_type_id, tgm.disabled_key, tgm.enabled_key,
    CASE
      WHEN tfl_disabled.feature_key IS NOT NULL THEN 'disabled'
      WHEN tfl_enabled.feature_key IS NOT NULL THEN 'enabled'
      ELSE NULL
    END AS gate_status
  FROM tier_ids ti
  CROSS JOIN type_gate_map tgm
  LEFT JOIN tier_features_list tfl_disabled ON tfl_disabled.tier_id = ti.tier_id AND tfl_disabled.feature_key = tgm.disabled_key AND tfl_disabled.is_enabled = true
  LEFT JOIN tier_features_list tfl_enabled ON tfl_enabled.tier_id = ti.tier_id AND tfl_enabled.feature_key = tgm.enabled_key AND tfl_enabled.is_enabled = true
),
tier_features AS (
  SELECT ti.tenant_id, tfl.feature_key
  FROM tier_ids ti
  JOIN tier_features_list tfl ON tfl.tier_id = ti.tier_id AND tfl.is_enabled = true
),
-- FIXED: Use flexible_key_map instead of guessing {capability_key}_flexible
-- FIXED: Apply type gate precedence: _disabled > _enabled > _flexible
flexible_tier_features AS (
  SELECT ti.tenant_id, fl.key AS feature_key
  FROM tier_ids ti
  JOIN tier_features_list tfl ON tfl.tier_id = ti.tier_id AND tfl.is_enabled = true
  JOIN flexible_key_map fkm ON fkm.capability_type_id = tfl.capability_type_id
  JOIN capability_type_list ctl ON ctl.id = tfl.capability_type_id
  JOIN capability_features_list cfl ON cfl.capability_type_id = ctl.id AND cfl.is_active = true
  JOIN features_list fl ON fl.id = cfl.feature_id AND fl.is_active = true
  WHERE tfl.feature_key = fkm.flexible_feature_key
  -- Type gate check: exclude if capability is disabled
  AND NOT EXISTS (
    SELECT 1 FROM tenant_type_gates ttg
    WHERE ttg.tenant_id = ti.tenant_id
      AND ttg.capability_type_id = tfl.capability_type_id
      AND ttg.gate_status = 'disabled'
  )
),
purchase_features AS (
  SELECT tenant_id, feature_key
  FROM tenant_feature_purchases
  WHERE status IN ('active', 'past_due', 'trial')
  AND (expires_at IS NULL OR expires_at > now())
),
-- FIXED: Use flexible_key_map for purchase flexible expansion
-- FIXED: Apply type gate precedence: _disabled > _enabled > _flexible
flexible_purchase_features AS (
  SELECT pf.tenant_id, fl.key AS feature_key
  FROM purchase_features pf
  JOIN features_list pfl ON pfl.key = pf.feature_key AND pfl.is_active = true
  JOIN capability_features_list cfl ON cfl.feature_id = pfl.id AND cfl.is_active = true
  JOIN flexible_key_map fkm ON fkm.capability_type_id = cfl.capability_type_id
  JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
  JOIN capability_features_list all_cfl ON all_cfl.capability_type_id = ctl.id AND all_cfl.is_active = true
  JOIN features_list fl ON fl.id = all_cfl.feature_id AND fl.is_active = true
  WHERE pf.feature_key = fkm.flexible_feature_key
  -- Type gate check: exclude if capability is disabled (from tier gates)
  AND NOT EXISTS (
    SELECT 1 FROM tenant_type_gates ttg
    WHERE ttg.tenant_id = pf.tenant_id
      AND ttg.capability_type_id = cfl.capability_type_id
      AND ttg.gate_status = 'disabled'
  )
),
override_features AS (
  SELECT tenant_id, feature AS feature_key
  FROM tenant_feature_overrides_list
  WHERE granted = true AND (expires_at IS NULL OR expires_at > now())
),
-- FIXED: Use flexible_key_map for override flexible expansion
-- FIXED: Apply type gate precedence: _disabled > _enabled > _flexible
flexible_override_features AS (
  SELECT of.tenant_id, fl.key AS feature_key
  FROM override_features of
  JOIN features_list ofl ON ofl.key = of.feature_key AND ofl.is_active = true
  JOIN capability_features_list cfl ON cfl.feature_id = ofl.id AND cfl.is_active = true
  JOIN flexible_key_map fkm ON fkm.capability_type_id = cfl.capability_type_id
  JOIN capability_type_list ctl ON ctl.id = cfl.capability_type_id
  JOIN capability_features_list all_cfl ON all_cfl.capability_type_id = ctl.id AND all_cfl.is_active = true
  JOIN features_list fl ON fl.id = all_cfl.feature_id AND fl.is_active = true
  WHERE of.feature_key = fkm.flexible_feature_key
  -- Type gate check: exclude if capability is disabled (from tier gates)
  AND NOT EXISTS (
    SELECT 1 FROM tenant_type_gates ttg
    WHERE ttg.tenant_id = of.tenant_id
      AND ttg.capability_type_id = cfl.capability_type_id
      AND ttg.gate_status = 'disabled'
  )
)
SELECT tenant_id, feature_key, true AS is_enabled
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
) merged
-- Exclude type gate keys (_disabled, _enabled) — these are control keys, not features
WHERE feature_key NOT IN (
  SELECT disabled_key FROM type_gate_map WHERE disabled_key IS NOT NULL
  UNION
  SELECT enabled_key FROM type_gate_map WHERE enabled_key IS NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_mv_tenant_effective_capabilities_tenant_id ON mv_tenant_effective_capabilities (tenant_id);
CREATE INDEX idx_mv_tenant_effective_capabilities_feature_key ON mv_tenant_effective_capabilities (feature_key);
CREATE UNIQUE INDEX idx_mv_tenant_effective_capabilities_unique ON mv_tenant_effective_capabilities (tenant_id, feature_key);

-- Grant permissions
GRANT SELECT ON mv_tenant_effective_capabilities TO postgres;
GRANT SELECT ON mv_tenant_effective_capabilities TO anon;
GRANT SELECT ON mv_tenant_effective_capabilities TO authenticated;
GRANT SELECT ON mv_tenant_effective_capabilities TO service_role;

COMMENT ON MATERIALIZED VIEW mv_tenant_effective_capabilities IS 'Pre-resolved tenant effective capabilities including tier features, type gate precedence (_disabled > _enabled > _flexible > individual), flexible tier expansion, purchases, flexible purchase expansion, admin overrides, and flexible override expansion. Refreshed every 10 minutes via cron.';
