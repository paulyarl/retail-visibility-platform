/**
 * Integration Options Resolver
 *
 * Resolves effective integration options state from tier features + merchant preferences.
 */

import type {
  EffectiveIntegrations,
  IntegrationOptionsMerchantSettings,
} from './types';

export type IntegrationType =
  | 'clover' | 'square' | 'gbp'
  | 'google_shopping' | 'google_merchant_center' | 'gmc_sync'
  | 'propagation_gbp';

export type IntegrationGroup = 'pos' | 'google';

export function resolveIntegrationOptions(
  features: Record<string, boolean>,
  merchantPrefs: IntegrationOptionsMerchantSettings | null,
  capabilityEnabled?: boolean
): EffectiveIntegrations {
  const enabled = capabilityEnabled ?? !!features.integration_enabled;
  const disabled = !!features.integration_disabled;
  const flexible = !!features.integration_flexible;

  const posTypes: IntegrationType[] = ['clover', 'square'];
  const googleTypes: IntegrationType[] = ['gbp', 'google_shopping', 'google_merchant_center', 'gmc_sync'];

  const allowedPosTypes: IntegrationType[] = [];
  const allowedGoogleTypes: IntegrationType[] = [];

  if (flexible || enabled) {
    for (const t of posTypes) {
      if (flexible || features[`integration_${t}`]) allowedPosTypes.push(t);
    }
    for (const t of googleTypes) {
      if (flexible || features[`integration_${t}`]) allowedGoogleTypes.push(t);
    }
  }

  const prefs = {
    integration_enabled: merchantPrefs?.integration_enabled !== false,
    integration_clover: merchantPrefs?.integration_clover !== false,
    integration_square: merchantPrefs?.integration_square !== false,
    integration_gbp: merchantPrefs?.integration_gbp !== false,
    integration_google_shopping: merchantPrefs?.integration_google_shopping !== false,
    integration_google_merchant_center: merchantPrefs?.integration_google_merchant_center !== false,
    integration_gmc_sync: merchantPrefs?.integration_gmc_sync !== false,
  };

  const effectivePosTypes = allowedPosTypes.filter((t) => prefs[`integration_${t}` as keyof typeof prefs] !== false);
  const effectiveGoogleTypes = allowedGoogleTypes.filter((t) => prefs[`integration_${t}` as keyof typeof prefs] !== false);

  return {
    enabled: enabled && !disabled,
    pos_enabled: enabled && !disabled && allowedPosTypes.length > 0,
    google_enabled: enabled && !disabled && allowedGoogleTypes.length > 0,
    allowed_pos_types: allowedPosTypes,
    allowed_google_types: allowedGoogleTypes,
    allowed_types: [...allowedPosTypes, ...allowedGoogleTypes],
    effective_pos_types: effectivePosTypes,
    effective_google_types: effectiveGoogleTypes,
    effective_types: [...effectivePosTypes, ...effectiveGoogleTypes],
    integrations_available: enabled && !disabled && (allowedPosTypes.length + allowedGoogleTypes.length) > 0,
    effective_integrations_available: enabled && !disabled && (effectivePosTypes.length + effectiveGoogleTypes.length) > 0,
    merchant_preferences: prefs,
    is_flexible: flexible,
  };
}
