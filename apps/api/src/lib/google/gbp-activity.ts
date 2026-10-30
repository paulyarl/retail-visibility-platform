/**
 * GBP activity events — the merchant-facing "what the platform did" feed
 * (visible_to_merchant rows) and the operator audit trail (all rows).
 *
 * Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §5.1
 * Emitted by every DFY writer: publisher, autopilot, NAP guardian, media,
 * verification, connect/revoke. Fail-safe — a feed write never breaks the
 * op that produced it.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { logger } from '../../logger';
import { generateQuickStart } from '../id-generator';

export type GbpActivityActor = 'admin' | 'system' | 'autopilot';

export interface GbpActivityInput {
  tenantId: string;
  gbpLocationId?: string | null;
  action: string;
  actor: GbpActivityActor;
  /** Platform user id for admin-initiated actions (audit trail). */
  actorUserId?: string | null;
  detail?: Record<string, unknown>;
  /** Ops-internal events (token failures, retries) pass false. */
  visibleToMerchant?: boolean;
}

export async function emitGbpActivity(evt: GbpActivityInput): Promise<void> {
  try {
    await prisma.gbp_activity_events.create({
      data: {
        id: generateQuickStart('gae'),
        tenant_id: evt.tenantId,
        gbp_location_id: evt.gbpLocationId ?? null,
        action: evt.action,
        actor: evt.actor,
        actor_user_id: evt.actorUserId ?? null,
        detail: (evt.detail ?? {}) as Prisma.InputJsonValue,
        visible_to_merchant: evt.visibleToMerchant !== false,
      },
    });
  } catch (error) {
    logger.warn('[GbpActivity] emit failed', undefined, {
      action: evt.action,
      tenantId: evt.tenantId,
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
  }
}
