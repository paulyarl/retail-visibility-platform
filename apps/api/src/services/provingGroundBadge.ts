/**
 * Resolve the proving-ground badge for a page of mkt_prospect_queue rows.
 *
 * A prospect belongs to a proving ground via either linkage: the direct
 * `proving_ground_id` column (queue-list grouping, migration 282), or its
 * `source_campaign_id` being a PG / a discovery child of one. Two batched
 * lookups for the whole page so every prospect surface can show "which PG
 * owns this prospect" without per-row campaign fetches.
 *
 * Shared by MarketingProspectQueueService (queue page) and
 * ProspectCommunicationService (communications picker). Non-fatal — a lookup
 * failure degrades to no badges.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import type { RequestCtx } from '../context';

export interface ProvingGroundBadge {
  id: string;
  title: string | null;
  category: string | null;
  city: string | null;
}

export interface ProvingGroundLinkedEntry {
  id: string;
  proving_ground_id?: string | null;
  source_campaign_id?: string | null;
}

export async function resolveProvingGroundBadges(
  entries: ProvingGroundLinkedEntry[],
  ctx?: RequestCtx,
): Promise<Map<string, ProvingGroundBadge>> {
  const pgByEntry = new Map<string, ProvingGroundBadge>();

  const linkedIds = new Set<string>();
  for (const e of entries) {
    if (e.proving_ground_id) linkedIds.add(e.proving_ground_id);
    if (e.source_campaign_id) linkedIds.add(e.source_campaign_id);
  }
  if (linkedIds.size === 0) return pgByEntry;

  try {
    const linked = await prisma.mkt_campaigns_list.findMany({
      where: { id: { in: [...linkedIds] } },
      select: { id: true, title: true, category: true, city: true, campaign_category: true, parent_campaign_id: true },
    });
    const parentIds = [...new Set(
      linked.map((c) => c.parent_campaign_id).filter((id): id is string => !!id),
    )];
    const parents = parentIds.length > 0
      ? await prisma.mkt_campaigns_list.findMany({
          where: { id: { in: parentIds }, campaign_category: 'proving_ground' },
          select: { id: true, title: true, category: true, city: true, campaign_category: true },
        })
      : [];
    const byId = new Map<string, any>([...linked, ...parents].map((c) => [c.id, c]));
    const asPg = (c: any): ProvingGroundBadge | null =>
      c?.campaign_category === 'proving_ground'
        ? {
            id: c.id as string,
            title: c.title as string | null,
            category: c.category as string | null,
            city: c.city as string | null,
          }
        : null;
    for (const e of entries) {
      const source = e.source_campaign_id ? byId.get(e.source_campaign_id) : undefined;
      const pg =
        asPg(e.proving_ground_id ? byId.get(e.proving_ground_id) : undefined) ??
        asPg(source) ??
        asPg(source?.parent_campaign_id ? byId.get(source.parent_campaign_id) : undefined);
      if (pg) pgByEntry.set(e.id, pg);
    }
  } catch (e) {
    logger.warn('proving-ground badge lookup failed (non-fatal)', ctx, {
      error: (e as Error).message,
    });
  }

  return pgByEntry;
}
