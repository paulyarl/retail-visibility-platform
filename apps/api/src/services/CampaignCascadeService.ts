/**
 * CampaignCascadeService — campaign-scoped Four-Act execution view.
 *
 * The campaign detail Project Plan tab's `#execution` surface is the natural
 * operator home for the cascade: the campaign carries the audit/archetype/
 * briefing triad, and the linked seed carries the announce/touch/gallery
 * evidence. This service resolves the campaign's primary seed and returns the
 * same `SeedCascadeSummary` the seed page uses, plus the announce queue state.
 *
 * Spec: docs/LocalBiz/FOUR_ACT_OUTREACH_CASCADE_SPEC.md §7;
 *       docs/LocalBiz/marketing_ops_project_phase_sprint_plan.md §7.3.
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import SeedCascadeService, { type SeedCascadeSummary } from './SeedCascadeService';

export interface CampaignCascadeResponse {
  seedId: string | null;
  seed: {
    seedBatch: string | null;
    status: string;
    publishedAt: string | null;
  } | null;
  cascade: SeedCascadeSummary | null;
  announce: {
    scheduledAt: string | null;
    deliveredAt: string | null;
    channel: string | null;
    inQueue: boolean;
  };
  reason?: 'no_primary_seed';
}

export class CampaignCascadeService extends BaseService {
  private static instance: CampaignCascadeService;

  private constructor() {
    super();
  }

  static getInstance(): CampaignCascadeService {
    if (!CampaignCascadeService.instance) {
      CampaignCascadeService.instance = new CampaignCascadeService();
    }
    return CampaignCascadeService.instance;
  }

  /**
   * Batch form for the PG VAST board — campaign-linked prospects whose queue
   * row has no direct `seed_id`.
   */
  async getForCampaigns(
    campaignIds: string[],
  ): Promise<Record<string, CampaignCascadeResponse>> {
    const ids = [...new Set(campaignIds.filter(Boolean))];
    const out: Record<string, CampaignCascadeResponse> = {};
    for (let i = 0; i < ids.length; i += 5) {
      await Promise.all(
        ids.slice(i, i + 5).map(async (id) => {
          out[id] = await this.getForCampaign(id);
        }),
      );
    }
    return out;
  }

  async getForCampaign(campaignId: string): Promise<CampaignCascadeResponse> {
    const links = await prisma.$queryRaw<any[]>`
      SELECT seed_id
      FROM directory_seed_campaign_links
      WHERE campaign_id = ${campaignId}
        AND link_role = 'primary'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const seedId = links[0]?.seed_id ?? null;
    if (!seedId) {
      return {
        seedId: null,
        seed: null,
        cascade: null,
        announce: { scheduledAt: null, deliveredAt: null, channel: null, inQueue: false },
        reason: 'no_primary_seed',
      };
    }

    const seedRows = await prisma.$queryRaw<any[]>`
      SELECT seed_batch, status, published_at
      FROM directory_presence_seeds
      WHERE id = ${seedId}
      LIMIT 1
    `;
    const seed = seedRows[0] ?? null;
    const cascade = await SeedCascadeService.getSummary(seedId);
    const inQueue =
      !!cascade?.announceScheduledAt &&
      !cascade?.announceDeliveredAt &&
      !!seed &&
      ['published', 'invited'].includes(seed.status);

    return {
      seedId,
      seed: seed
        ? {
            seedBatch: seed.seed_batch ?? null,
            status: seed.status,
            publishedAt: seed.published_at ? new Date(seed.published_at).toISOString() : null,
          }
        : null,
      cascade,
      announce: {
        scheduledAt: cascade?.announceScheduledAt ?? null,
        deliveredAt: cascade?.announceDeliveredAt ?? null,
        channel: cascade?.announceChannel ?? null,
        inQueue,
      },
    };
  }
}

export default CampaignCascadeService.getInstance();
