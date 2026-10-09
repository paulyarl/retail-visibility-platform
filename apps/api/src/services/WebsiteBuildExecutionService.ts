/**
 * WebsiteBuildExecutionService — PB-08 / A7 post-decision execution read
 * model. The counterpart of RepairFulfillmentService.getRepairExecution
 * (sprint W7) for the website-gap motion.
 *
 * A confirmed playbook_decision (kind='website_build_scope') is the decision
 * point; this model aggregates everything an operator needs to drive the
 * build after confirming scope:
 *   - the decision payload + delivery_mode (dfy/diy, scope-gated via
 *     BUILD_SCOPE_MODES — the analog of the repair package's mode)
 *   - this campaign's seed link (role/status/claim/NAP confidence)
 *   - prospect-shared seeds reachable via sibling links — the designed
 *     attach path for a non-primary PB-08 sibling
 *   - the seed-preview storefront state (demo tier) for the resolved seed
 *   - the website_build owner intake (auto-offered at `paid`, migration 304)
 *   - playbook checklist progress + next steps
 *
 * The card self-gates on isWebsiteGapCampaign + a confirmed decision, so
 * this service 400s on non-PB-08 campaigns rather than returning a hollow
 * payload.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { ValidationError } from '../middleware/errorHandler';
import {
  BUILD_SCOPE_MODES,
  isBuildScope,
  modesForScope,
} from '../lib/website-build';

export class WebsiteBuildExecutionService extends BaseService {
  private static instance: WebsiteBuildExecutionService;

  private constructor() {
    super();
  }

  static getInstance(): WebsiteBuildExecutionService {
    if (!WebsiteBuildExecutionService.instance) {
      WebsiteBuildExecutionService.instance = new WebsiteBuildExecutionService();
    }
    return WebsiteBuildExecutionService.instance;
  }

  /**
   * Mirrors the eligibility gate in MarketingCampaignService.confirmWebsiteBuildScope:
   * playbook_code === 'PB-08' is definitive; the accepted triage result's
   * effective playbook archetype === 'A7' is the fallback.
   */
  private async assertWebsiteGap(campaignId: string): Promise<any> {
    const campaign = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        stage: true,
        scope: true,
        playbook_code: true,
        playbook_decision: true,
        business_prospect_id: true,
      },
    });
    if (!campaign) throw new ValidationError(`Campaign ${campaignId} not found`);

    if (campaign.playbook_code !== 'PB-08') {
      const triageRow = await this.prisma.mkt_campaign_triage_results.findFirst({
        where: { campaign_id: campaignId, is_operator_accepted: true },
        include: {
          playbook: { select: { archetype: true } },
          overridden_playbook: { select: { archetype: true } },
        },
      });
      const archetype = (triageRow as any)?.overridden_playbook?.archetype
        ?? (triageRow as any)?.playbook?.archetype
        ?? null;
      if (archetype !== 'A7') {
        throw new ValidationError('Website build execution is only available for website-gap (PB-08 / A7) campaigns');
      }
    }
    return campaign;
  }

  async getWebsiteBuildExecution(campaignId: string, ctx?: RequestCtx): Promise<any> {
    try {
      const campaign = await this.assertWebsiteGap(campaignId);

      const decision = (campaign.playbook_decision as Record<string, any> | null) ?? null;
      const confirmedScope = decision?.kind === 'website_build_scope' ? decision.confirmed_scope : null;

      // This campaign's own seed links — primary role first, same ordering
      // convention as the repair read model.
      const seedLink = await this.prisma.directory_seed_campaign_links.findFirst({
        where: { campaign_id: campaignId },
        orderBy: [{ link_role: 'asc' }, { created_at: 'asc' }],
        select: {
          seed_id: true,
          link_role: true,
          nap_match_confidence: true,
          nap_match_summary: true,
          directory_presence_seeds: { select: { status: true, claimed_at: true } },
        },
      });

      // Prospect-shared seeds — seeds linked to sibling campaigns of the same
      // business prospect. The designed attach path for a non-primary sibling
      // is a 'sibling' link onto the shared seed.
      let linkableSeeds: any[] = [];
      if (campaign.business_prospect_id) {
        linkableSeeds = await this.prisma.$queryRaw<any[]>`
          SELECT DISTINCT l.seed_id,
                 l.campaign_id AS linked_via_campaign_id,
                 l.link_role   AS linked_via_role,
                 s.status      AS seed_status,
                 dl.business_name,
                 dl.city,
                 dl.state
          FROM directory_seed_campaign_links l
          JOIN mkt_campaigns_list c ON c.id = l.campaign_id
          JOIN directory_presence_seeds s ON s.id = l.seed_id
          JOIN directory_listings_list dl ON dl.id = s.listing_id
          WHERE c.business_prospect_id = ${campaign.business_prospect_id}
            AND l.campaign_id <> ${campaignId}
            AND s.status IS DISTINCT FROM 'suppressed'
          ORDER BY l.seed_id
        `;
      }

      // Preview storefront state for the campaign's resolved seed.
      let preview: any = null;
      if (seedLink) {
        try {
          const { default: demoTenantService } = await import('./DemoTenantService.js');
          const status = await demoTenantService.getSeedPreviewStatus(seedLink.seed_id);
          preview = {
            eligible: status.eligible,
            storefront_url: status.preview?.storefrontUrl ?? null,
            tenant_id: status.preview?.tenantId ?? null,
            expires_at: status.preview?.expiresAt ?? null,
            extensions_used: status.preview?.extensionsUsed ?? 0,
            page_views: status.preview?.pageViews ?? 0,
          };
        } catch (err) {
          logger.warn('WebsiteBuildExecutionService — preview status lookup failed', ctx, {
            error: (err as Error).message,
            campaignId,
          });
        }
      }

      // website_build owner intake (auto-offered at `paid`, migration 304).
      let intake: any = null;
      const intakeRow = await this.prisma.mkt_dispute_intake.findFirst({
        where: { campaign_id: campaignId, intake_kind: 'website_build' },
        select: {
          id: true,
          short_code: true,
          submitted_at: true,
          viewed_at: true,
          viewed_count: true,
          expires_at: true,
          _count: { select: { mkt_dispute_attachments: true } },
        },
      });
      if (intakeRow) {
        intake = {
          intake_id: intakeRow.id,
          short_code: intakeRow.short_code,
          short_url: intakeRow.short_code ? `/i/${intakeRow.short_code}` : null,
          submitted_at: intakeRow.submitted_at,
          viewed_at: intakeRow.viewed_at,
          viewed_count: intakeRow.viewed_count,
          expires_at: intakeRow.expires_at,
          attachment_count: (intakeRow as any)._count?.mkt_dispute_attachments ?? 0,
        };
      }

      // Checklist progress — reuse the resolved campaign checklist so the
      // card tracks the SAME steps the Checklist tab checks off.
      let checklist: any = null;
      try {
        const { default: checklistService } = await import('./PlaybookChecklistService.js');
        const view = await checklistService.getCampaignChecklist(campaignId, ctx);
        const nextSteps = view.steps
          .filter((s: any) => s.progress?.completedAt == null)
          .slice(0, 3)
          .map((s: any) => ({ id: s.id, title: s.title, step_order: s.stepOrder }));
        checklist = {
          steps_total: view.steps.length,
          steps_completed: view.completedCount,
          required_total: view.requiredTotal,
          required_completed: view.requiredCompleted,
          next_steps: nextSteps,
        };
      } catch (err) {
        // No effective playbook / checklist errors are non-fatal — the card
        // just renders without the checklist band.
        logger.warn('WebsiteBuildExecutionService — checklist lookup failed', ctx, {
          error: (err as Error).message,
          campaignId,
        });
      }

      return {
        campaign_id: campaignId,
        stage: campaign.stage,
        decision,
        confirmed_scope: confirmedScope,
        delivery_mode: decision?.delivery_mode ?? null,
        scope_modes: modesForScope(confirmedScope),
        seed: seedLink
          ? {
              seed_id: seedLink.seed_id,
              link_role: seedLink.link_role,
              nap_match_confidence: seedLink.nap_match_confidence,
              nap_match_summary: seedLink.nap_match_summary,
              seed_status: (seedLink as any).directory_presence_seeds?.status ?? null,
              seed_claimed: (seedLink as any).directory_presence_seeds?.status === 'claimed',
              claimed_at: (seedLink as any).directory_presence_seeds?.claimed_at ?? null,
            }
          : null,
        linkable_seeds: linkableSeeds,
        preview,
        intake,
        checklist,
      };
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Set the delivery mode on a confirmed decision. Mode lives inside
   * playbook_decision next to confirmed_scope — re-confirmation preserves it
   * when it remains valid for the new scope (see confirmWebsiteBuildScope).
   */
  async updateDeliveryMode(
    campaignId: string,
    mode: 'dfy' | 'diy',
    changedBy?: string,
    ctx?: RequestCtx,
  ): Promise<any> {
    try {
      const campaign = await this.assertWebsiteGap(campaignId);
      const decision = (campaign.playbook_decision as Record<string, any> | null) ?? null;
      if (decision?.kind !== 'website_build_scope' || !isBuildScope(decision.confirmed_scope)) {
        throw new ValidationError('Confirm the build scope before choosing a delivery mode');
      }
      const allowed = BUILD_SCOPE_MODES[decision.confirmed_scope as keyof typeof BUILD_SCOPE_MODES] ?? [];
      if (!allowed.includes(mode)) {
        throw new ValidationError(`Delivery mode '${mode}' is not offered for scope '${decision.confirmed_scope}'`);
      }

      const updated = await this.prisma.mkt_campaigns_list.update({
        where: { id: campaignId },
        data: {
          playbook_decision: {
            ...decision,
            delivery_mode: mode,
            delivery_mode_decided_at: new Date().toISOString(),
            delivery_mode_decided_by: changedBy ?? null,
          },
        },
      });

      logger.info('Website build delivery mode set', ctx, { campaignId, mode, scope: decision.confirmed_scope });
      return updated;
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }
}

export default WebsiteBuildExecutionService.getInstance();
