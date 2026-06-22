/**
 * CrmUserReadStateService — persistent per-user read state for CRM surfaces
 * Replaces localStorage-based read tracking with database-backed state.
 * Scopes: 'activity_feed' (tenant CRM widget), extensible to 'alert_feed', etc.
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmUserReadStateId } from '../lib/id-generator';

export const CRM_READ_STATE_SCOPES = {
  ACTIVITY_FEED: 'activity_feed',
  ALERT_FEED: 'alert_feed',
} as const;

export type CrmReadStateScope = typeof CRM_READ_STATE_SCOPES[keyof typeof CRM_READ_STATE_SCOPES];

export interface CrmUserReadState {
  scope: string;
  last_read_at: string;
}

export class CrmUserReadStateService extends BaseService {
  private static instance: CrmUserReadStateService;

  private constructor() { super(); }

  static getInstance(): CrmUserReadStateService {
    if (!CrmUserReadStateService.instance) {
      CrmUserReadStateService.instance = new CrmUserReadStateService();
    }
    return CrmUserReadStateService.instance;
  }

  /**
   * Get the last read timestamp for a single scope
   */
  async getLastReadAt(userId: string, tenantId: string, scope: string): Promise<Date | null> {
    const state = await prisma.crm_user_read_states.findUnique({
      where: {
        user_id_tenant_id_scope: {
          user_id: userId,
          tenant_id: tenantId,
          scope,
        },
      },
      select: { last_read_at: true },
    });
    return state?.last_read_at ?? null;
  }

  /**
   * Get all read states for a user in a tenant
   */
  async getReadStates(userId: string, tenantId: string): Promise<CrmUserReadState[]> {
    const states = await prisma.crm_user_read_states.findMany({
      where: { user_id: userId, tenant_id: tenantId },
      select: { scope: true, last_read_at: true },
      orderBy: { scope: 'asc' },
    });
    return states.map(s => ({
      scope: s.scope,
      last_read_at: s.last_read_at.toISOString(),
    }));
  }

  /**
   * Set the last read timestamp for a single scope (upsert)
   */
  async setLastReadAt(userId: string, tenantId: string, scope: string, lastReadAt: Date = new Date()) {
    return prisma.crm_user_read_states.upsert({
      where: {
        user_id_tenant_id_scope: {
          user_id: userId,
          tenant_id: tenantId,
          scope,
        },
      },
      update: {
        last_read_at: lastReadAt,
        updated_at: new Date(),
      },
      create: {
        id: generateCrmUserReadStateId(),
        user_id: userId,
        tenant_id: tenantId,
        scope,
        last_read_at: lastReadAt,
      },
    });
  }

  /**
   * Mark the tenant activity feed as read up to now
   */
  async markActivityFeedRead(userId: string, tenantId: string) {
    return this.setLastReadAt(userId, tenantId, CRM_READ_STATE_SCOPES.ACTIVITY_FEED);
  }

  /**
   * Mark the tenant alert feed as read up to now
   */
  async markAlertFeedRead(userId: string, tenantId: string) {
    return this.setLastReadAt(userId, tenantId, CRM_READ_STATE_SCOPES.ALERT_FEED);
  }
}

export default CrmUserReadStateService;
