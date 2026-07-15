/**
 * Funnel Resolver
 *
 * Resolves effective sales funnel capability from merged tier + purchased features.
 * Merchants can build funnels only when funnel_builder (or funnel_builder_flexible)
 * is enabled; individual step types can be unlocked by tier or purchased separately.
 */

import type { EffectiveFunnel, FunnelStepType } from './types';

const STEP_KEY_MAP: { key: string; type: FunnelStepType }[] = [
  { key: 'funnel_order_bump', type: 'order_bump' },
  { key: 'funnel_upsell', type: 'upsell' },
  { key: 'funnel_downsell', type: 'downsell' },
  { key: 'funnel_oto', type: 'oto' },
];

export function resolveFunnelOptions(features: Record<string, boolean>): EffectiveFunnel {
  const disabled = !!features.funnel_options_disabled;
  const masterEnabled = !!features.funnel_options_enabled;
  const flexible = !!features.funnel_builder_flexible;
  const builderEnabled = masterEnabled && !disabled && (flexible || !!features.funnel_builder);

  const allowed_steps: FunnelStepType[] = [];
  for (const { key, type } of STEP_KEY_MAP) {
    if (flexible || !!features[key]) {
      allowed_steps.push(type);
    }
  }

  const enabled = masterEnabled && !disabled && allowed_steps.length > 0;

  return {
    enabled,
    builder_enabled: builderEnabled,
    allowed_steps,
    can_use_order_bump: enabled && allowed_steps.includes('order_bump'),
    can_use_upsell: enabled && allowed_steps.includes('upsell'),
    can_use_downsell: enabled && allowed_steps.includes('downsell'),
    can_use_oto: enabled && allowed_steps.includes('oto'),
    is_flexible: flexible,
  };
}
