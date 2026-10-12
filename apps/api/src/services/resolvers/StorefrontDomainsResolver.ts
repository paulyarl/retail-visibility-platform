/**
 * Storefront Domains Resolver
 *
 * Resolves effective storefront addressing state from tier features.
 * Entitlement module — no merchant prefs: addressing state lives in
 * tenants.subdomain / custom_domains rows + DNS, administered by platform
 * ops (module-responsibility split from storefront_options — see R37).
 *
 * Levels: path (baseline) → platform_subdomain (level 2) → custom_domain
 * (level 3). The assignment ACTIONS stay separate (tenants.subdomain write,
 * custom_domains lifecycle); this resolves entitlement only.
 */

import type {
  EffectiveStorefrontDomains,
  StorefrontAddressingLevel,
} from './types';

export function resolveStorefrontDomains(
  features: Record<string, boolean>
): EffectiveStorefrontDomains {
  const disabled = !!features.storefront_domains_disabled;
  const flexible = !!features.storefront_domains_flexible;
  // Capability contract: `_disabled` vetoes the ENTIRE module. Any other
  // active `storefront_domains_*` key activates it — `_enabled`/`_flexible`
  // explicitly, or any lone feature key as an implicit `_enabled` (R17 §4).
  const mainOn = !disabled && Object.entries(features).some(
    ([k, v]) => v && k.startsWith('storefront_domains_') && k !== 'storefront_domains_disabled'
  );

  const platformSubdomain = mainOn && (flexible || !!features.storefront_domains_platform_subdomain);
  const customDomain = mainOn && (flexible || !!features.storefront_domains_custom_domain);

  const allowedLevels: StorefrontAddressingLevel[] = [];
  if (mainOn) {
    allowedLevels.push('path');
    if (platformSubdomain) allowedLevels.push('platform_subdomain');
    if (customDomain) allowedLevels.push('custom_domain');
  }

  return {
    enabled: mainOn,
    is_flexible: flexible,
    allowed_levels: allowedLevels,
    platform_subdomain_enabled: platformSubdomain,
    custom_domain_enabled: customDomain,
  };
}
