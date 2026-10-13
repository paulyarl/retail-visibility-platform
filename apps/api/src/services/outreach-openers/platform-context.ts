/**
 * resolveOutreachPlatformContext — the category platform-signal-weight
 * context shared by every outreach surface (opener, pitch header/closer,
 * follow-ups).
 *
 * Resolves once per call: the number map (for the signal extractor's gap
 * gate), the lead platform premise (argmax signal_weight × gap_severity),
 * and the full ranked distribution the analyst uses to educate — where
 * this category's customers actually look, heaviest first. Reported
 * context only — it feeds prompts, never scoring.
 *
 * Hoisted from OutreachOpenerService so the pitch/follow-up services share
 * one interpretation of signal weight rather than duplicating the
 * resolution. Everything degrades to nulls when no weights resolve.
 */

import type { RequestCtx } from '../../context';
import type { CommonFields } from './field-extractors';

export interface OutreachPlatformContext {
  /** platform → weight map for signal-extractor gap gating (opener only). */
  platformSignalWeights?: Record<string, number>;
  /** The "where" premise — lead platform by weight × gap. */
  platform_premise: CommonFields['platform_premise'];
  /** Ranked landscape — top platforms with weight, scope, and basis. */
  platform_weights: CommonFields['platform_weights'];
}

const EMPTY: OutreachPlatformContext = {
  platform_premise: null,
  platform_weights: null,
};

export async function resolveOutreachPlatformContext(
  campaign: any,
  auditData: any,
  ctx?: RequestCtx,
): Promise<OutreachPlatformContext> {
  try {
    const { IntelligenceProfileService, selectLeadPlatform } =
      await import('../intelligence/IntelligenceProfileService');
    const resolvedWeights = await IntelligenceProfileService.getInstance()
      .resolveSignalWeightsForCampaign(campaign, auditData, ctx);
    if (!resolvedWeights) return EMPTY;

    const platformSignalWeights: Record<string, number> = {};
    for (const [k, v] of resolvedWeights) platformSignalWeights[k] = v.weight;

    const lead = selectLeadPlatform(auditData, resolvedWeights);

    return {
      platformSignalWeights,
      platform_premise: lead
        ? {
            platform: lead.platform,
            signal_weight: lead.signalWeight,
            gap_severity: lead.gapSeverity,
            scope: lead.scope,
            basis: lead.basis,
          }
        : null,
      platform_weights: [...resolvedWeights.values()]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 6)
        .map((w) => ({
          platform: w.platform,
          weight: w.weight,
          scope: w.scope ?? null,
          basis: w.basis ?? null,
        })),
    };
  } catch {
    // Weight resolution is best-effort — prompts degrade to no premise.
    return EMPTY;
  }
}
