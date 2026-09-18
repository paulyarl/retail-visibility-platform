/**
 * GalleryEligibilityService — diagnostic gallery eligibility (single campaign)
 *
 * Pre-flight for the Diagnostic Gallery tab and the seed → preview_built
 * transition. Surfaces WHY a campaign cannot produce a gallery (stage,
 * screenshots, or an unresolvable archetype) with a machine-readable `reason`
 * and a human `action`, so the UI can warn before the operator hits a 400.
 *
 * The archetype chain (openers, headers, closers, deliverable sections, gallery
 * defaults) is derived from an operator-accepted triage result or a real
 * (non-stub) business_analysis audit. Without one of those, a campaign at
 * preview_built is not usable — which is the state this guard exists to prevent.
 *
 * Spec: docs/LocalBiz/MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md §4.2
 */

import { BaseService } from '../BaseService';
import type { RequestCtx } from '../../context';
import { isStubBusinessAnalysisAudit } from '../../lib/marketing-audits';
import { resolveCampaignArchetype } from '../OutreachOpenerService';
import type { ArchetypeCode } from '../outreach-openers/archetype-selection';

export const GALLERY_ELIGIBLE_STAGES = ['preview_built', 'shown'] as const;

export type GalleryIneligibilityReason =
  | 'invalid_stage'
  | 'no_screenshots'
  | 'no_business_analysis_audit'
  | 'archetype_unresolved';

export interface GalleryArchetypeSource {
  archetype: ArchetypeCode | null;
  hasBusinessAnalysisAudit: boolean;
  hasAcceptedTriage: boolean;
}

export interface GalleryEligibility {
  eligible: boolean;
  stage: string;
  stageOk: boolean;
  screenshotCount: number;
  hasBusinessAnalysisAudit: boolean;
  hasAcceptedTriage: boolean;
  archetype: ArchetypeCode | null;
  reason: GalleryIneligibilityReason | null;
  action: string | null;
}

const REASON_ACTIONS: Record<GalleryIneligibilityReason, string> = {
  invalid_stage: 'Advance the campaign to preview_built or shown before generating a gallery link.',
  no_screenshots: 'Upload at least one diagnostic screenshot.',
  no_business_analysis_audit:
    'Run the seek-stage business analysis from the Prompts tab so an archetype can be resolved.',
  archetype_unresolved:
    'Accept a triage recommendation or run a business_analysis audit so an archetype can be resolved.',
};

export class GalleryEligibilityService extends BaseService {
  private static instance: GalleryEligibilityService;

  private constructor() {
    super();
  }

  static getInstance(): GalleryEligibilityService {
    if (!GalleryEligibilityService.instance) {
      GalleryEligibilityService.instance = new GalleryEligibilityService();
    }
    return GalleryEligibilityService.instance;
  }

  /**
   * Resolve where the campaign's archetype comes from.
   *
   * `resolveCampaignArchetype` is authoritative — it tries the accepted-triage
   * playbook first, then falls back to `selectArchetype(latestAuditData)`, and
   * throws when neither source exists. `source` tells us which path won, which
   * is how we distinguish "no audit at all" from "triage accepted".
   */
  async resolveArchetypeSource(campaignId: string, ctx?: RequestCtx): Promise<GalleryArchetypeSource> {
    let archetype: ArchetypeCode | null = null;
    let hasAcceptedTriage = false;
    try {
      const resolved = await resolveCampaignArchetype(campaignId, ctx);
      archetype = resolved.archetype as ArchetypeCode;
      hasAcceptedTriage = resolved.source === 'triage';
    } catch {
      // Neither an accepted triage nor an audit — leave archetype null.
    }

    let hasBusinessAnalysisAudit = false;
    try {
      const audits = await this.prisma.mkt_audits_list.findMany({
        where: { campaign_id: campaignId, platform: 'business_analysis' },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: { platform: true, audit_data: true },
      });
      hasBusinessAnalysisAudit = (Array.isArray(audits) ? audits : []).some(
        (a: any) => !isStubBusinessAnalysisAudit(a),
      );
    } catch {
      // Audit lookup unavailable — fall through; the fallback resolution below
      // is still authoritative evidence that a real audit exists.
    }

    // A fallback resolution can only succeed when a real audit exists.
    if (archetype && !hasAcceptedTriage) hasBusinessAnalysisAudit = true;

    return { archetype, hasBusinessAnalysisAudit, hasAcceptedTriage };
  }

  /**
   * Full eligibility for minting a diagnostic gallery token.
   */
  async resolveEligibility(campaignId: string, ctx?: RequestCtx): Promise<GalleryEligibility> {
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: {
        stage: true,
        mkt_files_list: {
          where: { file_type: 'diagnostic_screenshot' },
          select: { id: true },
        },
      },
    });
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const stage = campaign.stage ?? '';
    const stageOk = (GALLERY_ELIGIBLE_STAGES as readonly string[]).includes(stage);
    const screenshotCount = campaign.mkt_files_list.length;

    const source = await this.resolveArchetypeSource(campaignId, ctx);

    const reason: GalleryIneligibilityReason | null = !stageOk
      ? 'invalid_stage'
      : screenshotCount === 0
      ? 'no_screenshots'
      : source.archetype === null
      ? source.hasBusinessAnalysisAudit
        ? 'archetype_unresolved'
        : 'no_business_analysis_audit'
      : null;

    return {
      eligible: reason === null,
      stage,
      stageOk,
      screenshotCount,
      hasBusinessAnalysisAudit: source.hasBusinessAnalysisAudit,
      hasAcceptedTriage: source.hasAcceptedTriage,
      archetype: source.archetype,
      reason,
      action: reason ? REASON_ACTIONS[reason] : null,
    };
  }
}

export default GalleryEligibilityService.getInstance();
