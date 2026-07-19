/**
 * Funnel Resolver
 *
 * Resolves effective sales funnel capability from merged tier + purchased features.
 * Follows the canonical feature-key convention for options capabilities:
 *   <capability_key>_enabled / _disabled
 *   <capability_key>_flexible
 *   <capability_key>_<group>_on / _off
 *   <capability_key>_<group>_<feature>
 *
 * For funnel_options the group is "builder" and the step types are the features.
 */

import type { EffectiveFunnel, FunnelStepType, FunnelOptionsMerchantSettings } from './types';

const STEP_KEY_MAP: { key: string; type: FunnelStepType }[] = [
  { key: 'funnel_options_builder_order_bump', type: 'order_bump' },
  { key: 'funnel_options_builder_upsell', type: 'upsell' },
  { key: 'funnel_options_builder_downsell', type: 'downsell' },
  { key: 'funnel_options_builder_oto', type: 'oto' },
  { key: 'funnel_options_builder_coupon_offer', type: 'coupon_offer' },
];

const MERCHANT_TOGGLE_MAP: { key: keyof FunnelOptionsMerchantSettings; type: FunnelStepType }[] = [
  { key: 'order_bump_enabled', type: 'order_bump' },
  { key: 'upsell_enabled', type: 'upsell' },
  { key: 'downsell_enabled', type: 'downsell' },
  { key: 'oto_enabled', type: 'oto' },
  { key: 'coupon_offer_enabled', type: 'coupon_offer' },
];

export function resolveFunnelOptions(
  features: Record<string, boolean>,
  merchantPrefs?: FunnelOptionsMerchantSettings | null
): EffectiveFunnel {
  const disabled = !!features.funnel_options_disabled;
  const masterEnabled = !!features.funnel_options_enabled;
  const flexible = !!features.funnel_options_flexible;
  const groupOn = flexible || !!features.funnel_options_builder_on;
  const groupOff = !!features.funnel_options_builder_off;
  const builderEnabled = masterEnabled && !disabled && groupOn && !groupOff;

  // Tier-gate: which steps are allowed by tier
  const tierAllowedSteps: FunnelStepType[] = [];
  for (const { key, type } of STEP_KEY_MAP) {
    if (groupOn && !groupOff) {
      tierAllowedSteps.push(type);
    } else if (!groupOff && !!features[key]) {
      tierAllowedSteps.push(type);
    }
  }

  // Merchant gate: filter tier-allowed steps by merchant toggles (default true if no prefs)
  const merchantGate = (type: FunnelStepType): boolean => {
    if (!merchantPrefs) return true;
    const entry = MERCHANT_TOGGLE_MAP.find(m => m.type === type);
    if (!entry) return true;
    const val = merchantPrefs[entry.key];
    return val === null || val === undefined ? true : !!val;
  };

  const allowed_steps = tierAllowedSteps.filter(s => merchantGate(s));

  const enabled = masterEnabled && !disabled && allowed_steps.length > 0;

  return {
    enabled,
    builder_enabled: builderEnabled,
    allowed_steps,
    can_use_order_bump: enabled && allowed_steps.includes('order_bump'),
    can_use_upsell: enabled && allowed_steps.includes('upsell'),
    can_use_downsell: enabled && allowed_steps.includes('downsell'),
    can_use_oto: enabled && allowed_steps.includes('oto'),
    can_use_coupon_offer: enabled && allowed_steps.includes('coupon_offer'),
    is_flexible: flexible,
    merchant_preferences: merchantPrefs ?? null,
  };
}
