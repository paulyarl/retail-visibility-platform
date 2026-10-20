/**
 * SeedCascadeCohortService — cohort-1 funnel measurement for the Four-Act
 * cascade.
 *
 * Stages are derived from the same per-prospect summary the panel uses, so
 * the report cannot drift from the operator's view:
 *   seeds            — every seed in the cohort
 *   act1Verified     — act-1 gate cleared (operational + channel + pain)
 *   act2Aware        — a mail/email touch after the announce
 *   act3Cleared      — gallery_opened or a cascade_gallery tagged scan
 *   act4Scheduled    — gate cleared (walk-in can be scheduled)
 *   act4Done         — a visit touch
 *   claimed          — seed.claimed_at set
 *   organicClaims    — a claim request submitted before the announce delivered
 *
 * Cohort 1 is 20 prospects; the per-prospect summary is intentionally reused
 * (N+1) rather than reimplementing the derivation in SQL.
 *
 * Spec: docs/LocalBiz/FOUR_ACT_OUTREACH_CASCADE_SPEC.md §6.
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import SeedCascadeService from './SeedCascadeService';

export interface CascadeCohortRow {
  seedId: string;
  businessName: string | null;
  seedBatch: string | null;
  status: string;
  act1Verified: boolean;
  act2Aware: boolean;
  act3Cleared: boolean;
  act4Scheduled: boolean;
  act4Done: boolean;
  claimed: boolean;
  organicClaim: boolean;
  announceScheduledAt: string | null;
  announceDeliveredAt: string | null;
  ageDays: number | null;
}

export interface CascadeCohortSummary {
  cohort: {
    seedBatch: string | null;
    seedIds: string[] | null;
  };
  totals: {
    seeds: number;
    act1Verified: number;
    act2Aware: number;
    act3Cleared: number;
    act4Scheduled: number;
    act4Done: number;
    claimed: number;
    organicClaims: number;
  };
  rates: {
    act1Verified: number;
    act2Aware: number;
    act3Cleared: number;
    act4Scheduled: number;
    claimed: number;
  };
  rows: CascadeCohortRow[];
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export class SeedCascadeCohortService extends BaseService {
  private static instance: SeedCascadeCohortService;

  private constructor() {
    super();
  }

  static getInstance(): SeedCascadeCohortService {
    if (!SeedCascadeCohortService.instance) {
      SeedCascadeCohortService.instance = new SeedCascadeCohortService();
    }
    return SeedCascadeCohortService.instance;
  }

  async getCohortSummary(filters: {
    seedBatch?: string;
    seedIds?: string[];
  } = {}): Promise<CascadeCohortSummary> {
    const seedIds = filters.seedIds?.filter(Boolean) ?? [];
    const seeds = await prisma.directory_presence_seeds.findMany({
      where: {
        ...(filters.seedBatch ? { seed_batch: filters.seedBatch } : {}),
        ...(seedIds.length > 0 ? { id: { in: seedIds } } : {}),
      },
      select: {
        id: true,
        seed_batch: true,
        status: true,
        claimed_at: true,
        published_at: true,
        directory_listings_list: { select: { business_name: true } },
      },
      orderBy: { published_at: 'asc' },
    });

    const ids = seeds.map((s) => s.id);
    const claimRows = ids.length
      ? await prisma.directory_claim_requests.findMany({
          where: { seed_id: { in: ids } },
          select: { seed_id: true, submitted_at: true, status: true },
          orderBy: { submitted_at: 'asc' },
        })
      : [];

    const claimsBySeed = new Map<string, Array<{ submitted_at: Date; status: string }>>();
    for (const claim of claimRows) {
      const list = claimsBySeed.get(claim.seed_id) ?? [];
      list.push({ submitted_at: claim.submitted_at, status: claim.status });
      claimsBySeed.set(claim.seed_id, list);
    }

    const rows: CascadeCohortRow[] = [];
    for (const seed of seeds) {
      const summary = await SeedCascadeService.getSummary(seed.id);
      const announceDeliveredAt = summary?.announceDeliveredAt ?? null;
      const claims = claimsBySeed.get(seed.id) ?? [];
      const organicClaim =
        claims.some(
          (c) => !announceDeliveredAt || new Date(c.submitted_at) < new Date(announceDeliveredAt),
        ) ||
        (!!seed.claimed_at &&
          (!announceDeliveredAt || new Date(seed.claimed_at) < new Date(announceDeliveredAt)));

      const publishedAt = seed.published_at ? new Date(seed.published_at) : null;
      rows.push({
        seedId: seed.id,
        businessName: seed.directory_listings_list?.business_name ?? null,
        seedBatch: seed.seed_batch ?? null,
        status: seed.status,
        act1Verified: summary?.gate.act1Cleared ?? false,
        act2Aware: summary?.acts[1]?.status === 'done',
        act3Cleared: summary?.gate.act3Cleared ?? false,
        act4Scheduled:
          summary?.acts[3]?.status === 'in_progress' || summary?.acts[3]?.status === 'done',
        act4Done: summary?.acts[3]?.status === 'done',
        claimed: !!seed.claimed_at,
        organicClaim,
        announceScheduledAt: summary?.announceScheduledAt ?? null,
        announceDeliveredAt,
        ageDays: publishedAt
          ? Math.max(0, Math.floor((Date.now() - publishedAt.getTime()) / 86_400_000))
          : null,
      });
    }

    const totals = {
      seeds: rows.length,
      act1Verified: rows.filter((r) => r.act1Verified).length,
      act2Aware: rows.filter((r) => r.act2Aware).length,
      act3Cleared: rows.filter((r) => r.act3Cleared).length,
      act4Scheduled: rows.filter((r) => r.act4Scheduled).length,
      act4Done: rows.filter((r) => r.act4Done).length,
      claimed: rows.filter((r) => r.claimed).length,
      organicClaims: rows.filter((r) => r.organicClaim).length,
    };

    return {
      cohort: {
        seedBatch: filters.seedBatch ?? null,
        seedIds: seedIds.length > 0 ? seedIds : null,
      },
      totals,
      rates: {
        act1Verified: rate(totals.act1Verified, totals.seeds),
        act2Aware: rate(totals.act2Aware, totals.seeds),
        act3Cleared: rate(totals.act3Cleared, totals.seeds),
        act4Scheduled: rate(totals.act4Scheduled, totals.seeds),
        claimed: rate(totals.claimed, totals.seeds),
      },
      rows,
    };
  }
}

export default SeedCascadeCohortService.getInstance();
