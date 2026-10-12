-- 332_mv_gate_key_flow.sql
--
-- Fix two gate-key defects in mv_tenant_effective_capabilities (both latent
-- since migration 090, surfaced by the storefront_domains module split):
--
-- BUG 1 — Dead vetoes on canonical modules.
--   The MV's final WHERE strips any feature key matching
--   `{capability_key}_disabled` / `{capability_key}_enabled` (type_gate_map).
--   That pattern only matches CANONICAL-named keys — so for every module
--   named after its capability key (storefront_domains, storefront_qr,
--   storefront_gallery, storefront_hours, storefront_layouts, storefront_maps,
--   marketing_ops, directory_entry, funnel_options, …) an assigned
--   `{cap}_disabled` row never reaches the resolvers: the veto is silently
--   dead. Resolvers are built to read gate keys — strip nothing.
--   (Legacy-named modules survive today only because `storefront_opt_disabled`
--   doesn't match `storefront_options_disabled` — they leak through as
--   ordinary rows, which is incidentally what resolvers need.)
--
-- BUG 2 — Phantom vetoes on flexible expansion.
--   flexible_*_features emit EVERY feature linked to the capability type —
--   including `_disabled` and `_off` negative gates. A `storefront_opt_flexible`
--   grant therefore emits `storefront_opt_disabled` into the MV, and the
--   resolver's absolute veto then kills the ENTIRE module. Confirmed live:
--   the enterprise tier holds `storefront_opt_flexible` and its tenants'
--   storefront_options resolved OFF. Fix: expansion emits only non-negative
--   keys — flexible means "all ON"; emitting OFF keys is self-contradictory.
--
-- Net effect after this migration:
--   - `*_disabled` / `*_enabled` assigned via tier / purchase / override now
--     reach resolvers as designed (vetoes work; _enabled-only tiers resolve on).
--   - Expansion no longer emits `_disabled`/`_off` — phantom vetoes die.
--   - Consumers verified: resolvers apply gate semantics; isEntitled /
--     assignSubdomain / resolvePlanCapabilities check _disabled explicitly;
--     directory routes point-lookup specific feature keys; engagement checks
--     read tier_features_list, not the MV.
--
-- Recreate mechanics: MVs cannot be replaced in place — DROP + CREATE
-- (repopulates immediately), same as 089/090. Indexes/grants restored.
--
-- Idempotent: full drop-and-create; safe to re-run.

DROP MATERIALIZED VIEW IF EXISTS mv_tenant_effective_capabilities;

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
type_gate_map AS (
  SELECT ctl.id AS capability_type_id, ctl.key AS capability_key,
    fl_disabled.key AS disabled_key, fl_enabled.key AS enabled_key
  FROM capability_type_list ctl
  LEFT JOIN capability_features_list cfl_disabled ON cfl_disabled.capability_type_id = ctl.id AND cfl_disabled.is_active = true
  LEFT JOIN features_list fl_disabled ON fl_disabled.id = cfl_disabled.feature_id AND fl_disabled.is_active = true AND fl_disabled.key = ctl.key || '_disabled'
  LEFT JOIN capability_features_list cfl_enabled ON cfl_enabled.capability_type_id = ctl.id AND cfl_enabled.is_active = true
  LEFT JOIN features_list fl_enabled ON fl_enabled.id = cfl_enabled.feature_id AND fl_enabled.is_active = true AND fl_enabled.key = ctl.key || '_enabled'
),
-- Determine type gate status per tenant (tier sources only) — suppresses
-- flexible expansion when the capability is disabled at the tier.
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
-- Flexible expansion emits only NON-NEGATIVE keys: module `_disabled` vetoes
-- and group `_off` gates are never "granted" by a flexible key (BUG 2 fix).
-- Positive gates (_enabled/_on/_flexible) still emit — redundant but harmless.
flexible_tier_features AS (
  SELECT ti.tenant_id, fl.key AS feature_key
  FROM tier_ids ti
  JOIN tier_features_list tfl ON tfl.tier_id = ti.tier_id AND tfl.is_enabled = true
  JOIN flexible_key_map fkm ON fkm.capability_type_id = tfl.capability_type_id
  JOIN capability_type_list ctl ON ctl.id = tfl.capability_type_id
  JOIN capability_features_list cfl ON cfl.capability_type_id = ctl.id AND cfl.is_active = true
  JOIN features_list fl ON fl.id = cfl.feature_id AND fl.is_active = true
  WHERE tfl.feature_key = fkm.flexible_feature_key
  AND fl.key NOT LIKE '%\_disabled'
  AND fl.key NOT LIKE '%\_off'
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
  AND fl.key NOT LIKE '%\_disabled'
  AND fl.key NOT LIKE '%\_off'
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
  AND fl.key NOT LIKE '%\_disabled'
  AND fl.key NOT LIKE '%\_off'
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
) merged;
-- BUG 1 fix: NO gate-key filter on the output — assigned `_disabled`/`_enabled`
-- keys MUST reach resolvers; they are the veto/enable inputs, not noise.

CREATE INDEX idx_mv_tenant_effective_capabilities_tenant_id ON mv_tenant_effective_capabilities (tenant_id);
CREATE INDEX idx_mv_tenant_effective_capabilities_feature_key ON mv_tenant_effective_capabilities (feature_key);
CREATE UNIQUE INDEX idx_mv_tenant_effective_capabilities_unique ON mv_tenant_effective_capabilities (tenant_id, feature_key);

GRANT SELECT ON mv_tenant_effective_capabilities TO postgres;
GRANT SELECT ON mv_tenant_effective_capabilities TO anon;
GRANT SELECT ON mv_tenant_effective_capabilities TO authenticated;
GRANT SELECT ON mv_tenant_effective_capabilities TO service_role;

COMMENT ON MATERIALIZED VIEW mv_tenant_effective_capabilities IS 'Pre-resolved tenant effective capabilities including tier features (trial→base proxy), flexible expansion (non-negative keys only — 332), purchases, overrides, and gate keys flowing to resolvers (_disabled/_enabled are veto inputs, not filtered — 332). Refreshed every 10 minutes via cron.';

-- Verification:
--   -- enterprise: storefront_opt_disabled phantom row GONE (expansion no longer emits it)
--   SELECT feature_key FROM mv_tenant_effective_capabilities
--   WHERE tenant_id = 'tid-zcp9a56y' AND feature_key LIKE 'storefront_opt_%';
--
--   -- canonical gate keys now flow: directory_presence _enabled visible,
--   -- discovery's canonical vetoes (gallery/hours/layouts/maps/directory_entry) visible
--   SELECT feature_key FROM mv_tenant_effective_capabilities
--   WHERE tenant_id = 'tid-p4x62u15' AND feature_key LIKE 'storefront_domains_%';
