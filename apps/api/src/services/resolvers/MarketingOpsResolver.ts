/**
 * Marketing Ops Resolver
 *
 * Resolves effective marketing ops state from tier features only.
 * No merchant preferences — admin-only module, no merchant gate.
 *
 * Pattern: mirrors PlatformServiceResolver (features-only, no merchant prefs)
 */

import type { EffectiveMarketingOps } from './types';

export function resolveMarketingOps(
  features: Record<string, boolean>
): EffectiveMarketingOps {
  const disabled = !!features.marketing_ops_disabled;
  const enabled = !disabled && !!features.marketing_ops_enabled;

  return {
    enabled,
    can_use_prompt_execution: enabled && !!features.marketing_ops_prompt_execution,
    can_use_filter_review: enabled && !!features.marketing_ops_filter_review,
    can_use_batch_execution: enabled && !!features.marketing_ops_batch_execution,
    can_use_revenue_tracking: enabled && !!features.marketing_ops_revenue_tracking,
    is_flexible: false,
  };
}
