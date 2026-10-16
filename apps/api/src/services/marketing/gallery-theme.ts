/**
 * Gallery theme resolution — the A2 recurring-negative-review theme.
 *
 * `resolveCampaignArchetype` returns the archetype but not the theme, so an A2
 * gallery re-runs `selectArchetype` over the campaign's latest
 * business_analysis audit to recover it. Shared by the gallery-token route and
 * the postal mailer so both mint the same gallery meta.
 */

import type { RequestCtx } from '../../context';
import { selectArchetype, type ArchetypeCode, type BusinessAnalysisAuditData, type NegativeReviewTheme } from '../outreach-openers/archetype-selection';

export async function resolveGalleryTheme(
  campaignId: string,
  archetype: ArchetypeCode,
  ctx?: RequestCtx,
): Promise<NegativeReviewTheme | null> {
  if (archetype !== 'A2') return null;

  const BusinessContextService = (await import('../deliverable/BusinessContextService')).default;
  const auditResult = await BusinessContextService.getLatestAuditData(campaignId, ctx);
  if (!auditResult) return null;

  const autoSel = selectArchetype(auditResult.auditData as BusinessAnalysisAuditData);
  return autoSel.theme ?? null;
}
