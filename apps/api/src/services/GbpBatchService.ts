/**
 * GBP post batch fan-out — the DFY batch composer backend.
 *
 * Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §6.2
 * Sprint: docs/LocalBiz/GBP_DFY_SPRINT_PLAN.md D6
 *
 * Audience resolution → per-location gbp_posts rows (created_by='admin',
 * batch_id, staggered scheduled_for), honoring:
 *   - managed_by='platform' only (DIY locations are never batch targets)
 *   - delegated_surfaces.posts !== false (delegation off → skip)
 *   - dedupe window: same summary posted to this tenant within 7d → skip
 *   - min-interval: a scheduled post within 24h of the target time → shift +24h
 *   - stagger: index-minute offsets spread the fan-out under the 300 QPM quota
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { generateQuickStart } from '../lib/id-generator';
import { emitGbpActivity } from '../lib/google/gbp-activity';

const DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STAGGER_MS = 60 * 1000;

export interface BatchAudience {
  type: 'all_managed' | 'explicit';
  gbpLocationIds?: string[];
}

export interface BatchTemplate {
  summary: string;
  topicType?: 'STANDARD' | 'EVENT' | 'OFFER';
  event?: { title?: string; startDate?: string; endDate?: string };
  offer?: { couponCode?: string; redeemUrl?: string; terms?: string };
  callToAction?: { type?: string; url?: string };
  media?: { type?: string; url?: string };
}

export interface MaterializeDecision {
  gbpLocationId: string;
  tenantId: string;
  outcome: 'created' | 'skipped_not_managed' | 'skipped_not_delegated' | 'skipped_dedupe' | 'skipped_missing' | 'error';
  scheduledFor?: string;
  reason?: string;
}

type LocationRow = {
  id: string;
  tenant_id: string | null;
  managed_by: string;
  delegated_surfaces: unknown;
};

/** Resolve the audience to location rows, without writing anything. */
export async function resolveAudience(audience: BatchAudience): Promise<LocationRow[]> {
  if (audience.type === 'explicit') {
    const ids = (audience.gbpLocationIds ?? []).slice(0, 500);
    if (!ids.length) return [];
    return prisma.gbp_locations_list.findMany({
      where: { id: { in: ids } },
      select: { id: true, tenant_id: true, managed_by: true, delegated_surfaces: true },
    }) as Promise<LocationRow[]>;
  }

  return prisma.gbp_locations_list.findMany({
    where: { managed_by: 'platform' },
    select: { id: true, tenant_id: true, managed_by: true, delegated_surfaces: true },
  }) as Promise<LocationRow[]>;
}

/**
 * Preview: the same decision logic as materialization, without writes.
 * `summaryDedupe` checks need the DB anyway — they're reads, safe to reuse.
 */
export async function previewBatch(audience: BatchAudience, template: BatchTemplate, baseTime: Date) {
  const locations = await resolveAudience(audience);
  return planMaterialization(locations, template, baseTime);
}

/** Shared per-location decision logic (used by preview + materialize). */
async function planMaterialization(
  locations: LocationRow[],
  template: BatchTemplate,
  baseTime: Date
): Promise<Array<{ loc: LocationRow; decision: Omit<MaterializeDecision, 'gbpLocationId' | 'tenantId'> & { scheduledFor?: Date } }>> {
  const out: Array<{ loc: LocationRow; decision: any }> = [];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];

    if (loc.managed_by !== 'platform') {
      out.push({ loc, decision: { outcome: 'skipped_not_managed' } });
      continue;
    }
    const surfaces = (loc.delegated_surfaces as Record<string, boolean> | null) ?? null;
    if (surfaces && surfaces.posts === false) {
      out.push({ loc, decision: { outcome: 'skipped_not_delegated' } });
      continue;
    }
    if (!loc.tenant_id) {
      out.push({ loc, decision: { outcome: 'skipped_missing', reason: 'no tenant' } });
      continue;
    }

    // Dedupe — same summary published/scheduled to this tenant within 7d.
    const dup = await prisma.gbp_posts.findFirst({
      where: {
        tenant_id: loc.tenant_id,
        summary: template.summary,
        created_at: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (dup) {
      out.push({ loc, decision: { outcome: 'skipped_dedupe' } });
      continue;
    }

    // Stagger: base + index minutes spreads fan-out under the 300 QPM quota.
    let scheduledFor = new Date(baseTime.getTime() + i * STAGGER_MS);

    // Min-interval — an existing scheduled post within ±24h pushes this
    // one past it.
    const nearest = await prisma.gbp_posts.findFirst({
      where: {
        tenant_id: loc.tenant_id,
        status: 'SCHEDULED',
        scheduled_for: {
          gte: new Date(scheduledFor.getTime() - MIN_INTERVAL_MS),
          lte: new Date(scheduledFor.getTime() + MIN_INTERVAL_MS),
        },
      },
      orderBy: { scheduled_for: 'desc' },
      select: { scheduled_for: true },
    });
    if (nearest?.scheduled_for) {
      scheduledFor = new Date(nearest.scheduled_for.getTime() + MIN_INTERVAL_MS);
    }

    out.push({ loc, decision: { outcome: 'created', scheduledFor } });
  }

  return out;
}

function templateToPostColumns(template: BatchTemplate) {
  return {
    summary: template.summary,
    topic_type: (template.topicType || 'STANDARD').toUpperCase(),
    event_title: template.event?.title ?? null,
    event_start_date: template.event?.startDate ? new Date(template.event.startDate) : null,
    event_end_date: template.event?.endDate ? new Date(template.event.endDate) : null,
    offer_coupon_code: template.offer?.couponCode ?? null,
    offer_redeem_url: template.offer?.redeemUrl ?? null,
    offer_terms: template.offer?.terms ?? null,
    cta_type: template.callToAction?.type ?? null,
    cta_url: template.callToAction?.url ?? null,
    media_type: template.media?.type ?? null,
    media_url: template.media?.url ?? null,
  };
}

/** Create + materialize a batch. Returns per-location decisions. */
export async function createAndMaterializeBatch(
  audience: BatchAudience,
  template: BatchTemplate,
  scheduledFor: Date,
  actorUserId: string | null,
  recurrence?: unknown
): Promise<{ batchId: string; decisions: MaterializeDecision[] }> {
  const locations = await resolveAudience(audience);
  const plans = await planMaterialization(locations, template, scheduledFor);

  const batchId = generateQuickStart('gpb');
  await prisma.gbp_post_batches.create({
    data: {
      id: batchId,
      actor_user_id: actorUserId,
      audience: audience as any,
      template: template as any,
      recurrence: (recurrence ?? null) as any,
      scheduled_for: scheduledFor,
      status: 'materialized',
      materialized_at: new Date(),
    },
  });

  const decisions: MaterializeDecision[] = [];

  for (const { loc, decision } of plans) {
    if (decision.outcome !== 'created') {
      decisions.push({
        gbpLocationId: loc.id,
        tenantId: loc.tenant_id ?? '',
        outcome: decision.outcome,
        reason: decision.reason,
      });
      continue;
    }

    try {
      await prisma.gbp_posts.create({
        data: {
          id: generateQuickStart('gbpp'),
          tenant_id: loc.tenant_id!,
          location_id: loc.id,
          status: 'SCHEDULED',
          scheduled_for: decision.scheduledFor,
          batch_id: batchId,
          created_by: 'admin',
          ...templateToPostColumns(template),
        },
      });
      decisions.push({
        gbpLocationId: loc.id,
        tenantId: loc.tenant_id!,
        outcome: 'created',
        scheduledFor: decision.scheduledFor.toISOString(),
      });
      // Merchant-visible feed entry — "we scheduled a post for you".
      await emitGbpActivity({
        tenantId: loc.tenant_id!,
        gbpLocationId: loc.id,
        action: 'post_scheduled',
        actor: 'admin',
        actorUserId,
        detail: { batchId, scheduledFor: decision.scheduledFor.toISOString(), summary: template.summary.slice(0, 80) },
      });
    } catch (error: any) {
      logger.error('[GbpBatch] materialize row failed', undefined, {
        locationId: loc.id,
        error: error?.message,
      });
      decisions.push({ gbpLocationId: loc.id, tenantId: loc.tenant_id!, outcome: 'error', reason: error?.message });
    }
  }

  const created = decisions.filter((d) => d.outcome === 'created').length;
  logger.info('[GbpBatch] materialized batch', undefined, {
    batchId,
    locations: locations.length,
    created,
    skipped: decisions.length - created,
  });

  return { batchId, decisions };
}
