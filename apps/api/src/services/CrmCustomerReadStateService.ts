/**
 * CrmCustomerReadStateService — persistent per-customer read state for CRM surfaces
 * Mirrors CrmUserReadStateService but keyed on customer_id (no tenant requirement).
 * Scopes: 'ticket_feed', 'inquiry_feed', 'activity_feed', 'alert_feed'
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmCustomerReadStateId } from '../lib/id-generator';

export const CRM_CUSTOMER_READ_STATE_SCOPES = {
  TICKET_FEED: 'ticket_feed',
  INQUIRY_FEED: 'inquiry_feed',
  ACTIVITY_FEED: 'activity_feed',
  ALERT_FEED: 'alert_feed',
} as const;

export type CrmCustomerReadStateScope = typeof CRM_CUSTOMER_READ_STATE_SCOPES[keyof typeof CRM_CUSTOMER_READ_STATE_SCOPES];

export interface CrmCustomerReadState {
  scope: string;
  last_read_at: string;
}

export class CrmCustomerReadStateService extends BaseService {
  private static instance: CrmCustomerReadStateService;

  private constructor() { super(); }

  static getInstance(): CrmCustomerReadStateService {
    if (!CrmCustomerReadStateService.instance) {
      CrmCustomerReadStateService.instance = new CrmCustomerReadStateService();
    }
    return CrmCustomerReadStateService.instance;
  }

  /**
   * Get the last read timestamp for a single scope
   */
  async getLastReadAt(customerId: string, scope: string): Promise<Date | null> {
    const state = await prisma.crm_customer_read_states.findUnique({
      where: {
        customer_id_scope: {
          customer_id: customerId,
          scope,
        },
      },
      select: { last_read_at: true },
    });
    return state?.last_read_at ?? null;
  }

  /**
   * Get all read states for a customer
   */
  async getReadStates(customerId: string): Promise<CrmCustomerReadState[]> {
    const states = await prisma.crm_customer_read_states.findMany({
      where: { customer_id: customerId },
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
  async setLastReadAt(customerId: string, scope: string, lastReadAt: Date = new Date()) {
    return prisma.crm_customer_read_states.upsert({
      where: {
        customer_id_scope: {
          customer_id: customerId,
          scope,
        },
      },
      update: {
        last_read_at: lastReadAt,
        updated_at: new Date(),
      },
      create: {
        id: generateCrmCustomerReadStateId(),
        customer_id: customerId,
        scope,
        last_read_at: lastReadAt,
      },
    });
  }

  /**
   * Mark the ticket feed as read up to now
   */
  async markTicketFeedRead(customerId: string) {
    return this.setLastReadAt(customerId, CRM_CUSTOMER_READ_STATE_SCOPES.TICKET_FEED);
  }

  /**
   * Mark the inquiry feed as read up to now
   */
  async markInquiryFeedRead(customerId: string) {
    return this.setLastReadAt(customerId, CRM_CUSTOMER_READ_STATE_SCOPES.INQUIRY_FEED);
  }

  /**
   * Mark the activity feed as read up to now
   */
  async markActivityFeedRead(customerId: string) {
    return this.setLastReadAt(customerId, CRM_CUSTOMER_READ_STATE_SCOPES.ACTIVITY_FEED);
  }

  /**
   * Mark the alert feed as read up to now
   */
  async markAlertFeedRead(customerId: string) {
    return this.setLastReadAt(customerId, CRM_CUSTOMER_READ_STATE_SCOPES.ALERT_FEED);
  }
}

export default CrmCustomerReadStateService;
