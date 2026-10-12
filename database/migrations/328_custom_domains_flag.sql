-- Migration 328: Platform feature flag `custom_domains` (sprint plan D10/3.3)
--
-- Gates the tenant-owned custom-domain write path (addDomain) and, via the
-- NEXT_PUBLIC_FF_CUSTOM_DOMAINS twin, the proxy's custom-host branch.
-- Platform-level enabled=false: beta cohort gets tenant_feature_flags_list
-- overrides; flip enabled=true at general rollout. allow_tenant_override=true
-- is required for the cohort mechanism.

INSERT INTO platform_feature_flags_list (id, flag, enabled, description, rollout, allow_tenant_override, updated_at, created_at)
SELECT 'flag-custom-domains', 'custom_domains', false,
       'Tenant-owned custom storefront domains (level-3 presentation). Requires storefront_opt_custom_domain capability; beta cohort via tenant_feature_flags_list overrides.',
       'platform', true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM platform_feature_flags_list WHERE flag = 'custom_domains'
);
