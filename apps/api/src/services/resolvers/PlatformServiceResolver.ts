/**
 * Platform Services Resolver
 *
 * Resolves effective platform services state from tier features only.
 * No merchant preferences — platform services have no merchant gate.
 * No merchant settings table — resolver takes only `features`.
 *
 * Individual service keys (e.g. platform_service_logo_design) are NOT in any tier.
 * They are purchasable only via the BSaaS store as one_time purchases.
 * The master gate (platform_services_enabled) is seeded into all tiers to
 * bypass checkCapabilityEngagement() in the purchase flow.
 */

import type {
  EffectivePlatformServices,
  PlatformServiceType,
} from './types';

const SERVICE_KEYS: { key: string; type: PlatformServiceType }[] = [
  { key: 'platform_service_logo_design', type: 'logo_design' },
  { key: 'platform_service_banner_design', type: 'banner_design' },
  { key: 'platform_service_store_setup', type: 'store_setup' },
  { key: 'platform_service_profile_setup', type: 'profile_setup' },
  { key: 'platform_service_seo_optimization', type: 'seo_optimization' },
  { key: 'platform_service_social_media_kit', type: 'social_media_kit' },
];

export function resolvePlatformServices(
  features: Record<string, boolean>
): EffectivePlatformServices {
  const disabled = !!features.platform_services_disabled;

  // Determine which services have been purchased
  const allowed_services: PlatformServiceType[] = [];
  for (const { key, type } of SERVICE_KEYS) {
    if (!!features[key]) {
      allowed_services.push(type);
    }
  }

  const enabled = !disabled && allowed_services.length > 0;

  return {
    enabled,
    allowed_services,
    can_use_logo_design: enabled && allowed_services.includes('logo_design'),
    can_use_banner_design: enabled && allowed_services.includes('banner_design'),
    can_use_store_setup: enabled && allowed_services.includes('store_setup'),
    can_use_profile_setup: enabled && allowed_services.includes('profile_setup'),
    can_use_seo_optimization: enabled && allowed_services.includes('seo_optimization'),
    can_use_social_media_kit: enabled && allowed_services.includes('social_media_kit'),
    is_flexible: false,
  };
}
