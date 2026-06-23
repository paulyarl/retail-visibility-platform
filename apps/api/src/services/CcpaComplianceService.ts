/**
 * CCPA Compliance Service
 *
 * Handles California Consumer Privacy Act requests:
 * - Right to opt-out of sale (Do Not Sell My Personal Information)
 * - Right to know (data categories collected)
 * - Right to delete (delegates to existing GDPR deletion flow)
 *
 * Reuses GDPR export for right-to-know and GDPR deletion for right-to-delete.
 *
 * Uses raw SQL (basePrisma.$queryRaw) because the ccpa_requests table may not
 * be in the Prisma schema yet until db pull + generate is run.
 */

import { basePrisma } from '../prisma';
import { logger } from '../logger';
import { generateCcpaRequestId } from '../lib/id-generator';

export type CcpaRequestType = 'opt_out_sale' | 'know' | 'delete';
export type CcpaRequestStatus = 'pending' | 'completed' | 'denied';

export interface CcpaRequest {
  id: string;
  customerId: string | null;
  email: string;
  tenantId: string | null;
  requestType: CcpaRequestType;
  status: CcpaRequestStatus;
  notes: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataCategory {
  category: string;
  examples: string[];
  source: string;
}

const DATA_CATEGORIES: DataCategory[] = [
  {
    category: 'Identifiers',
    examples: ['Name', 'Email address', 'Phone number', 'IP address'],
    source: 'Account registration, order checkout, site visits',
  },
  {
    category: 'Commercial Information',
    examples: ['Order history', 'Purchase records', 'Product preferences'],
    source: 'Checkout process, cart activity',
  },
  {
    category: 'Internet Activity',
    examples: ['Browsing history', 'Search queries', 'Pages visited'],
    source: 'Cookies, analytics, site logs',
  },
  {
    category: 'Geolocation Data',
    examples: ['Shipping address', 'Approximate location from IP'],
    source: 'Checkout, order fulfillment',
  },
  {
    category: 'Financial Information',
    examples: ['Payment method type', 'Billing address'],
    source: 'Payment processing (via Stripe/Square/PayPal)',
  },
];

class CcpaComplianceService {
  private static instance: CcpaComplianceService;

  private constructor() {}

  static getInstance(): CcpaComplianceService {
    if (!CcpaComplianceService.instance) {
      CcpaComplianceService.instance = new CcpaComplianceService();
    }
    return CcpaComplianceService.instance;
  }

  /**
   * Create a CCPA request (typically opt_out_sale)
   */
  async createRequest(params: {
    email: string;
    requestType: CcpaRequestType;
    customerId?: string;
    tenantId?: string;
    ipAddress?: string;
    userAgent?: string;
    notes?: string;
  }): Promise<CcpaRequest> {
    const { email, requestType, customerId, tenantId, ipAddress, userAgent, notes } = params;

    const id = generateCcpaRequestId(tenantId);

    const [record] = await basePrisma.$queryRaw<any[]>`
      INSERT INTO ccpa_requests (
        id, email, customer_id, tenant_id, request_type, status, notes, ip_address, user_agent
      ) VALUES (
        ${id}, ${email}, ${customerId || null}, ${tenantId || null},
        ${requestType}, 'pending', ${notes || null},
        ${ipAddress || null}, ${userAgent || null}
      )
      RETURNING
        id, customer_id, email, tenant_id, request_type, status,
        notes, ip_address, user_agent, completed_at, created_at, updated_at
    `;

    logger.info('[CcpaComplianceService] CCPA request created', undefined, {
      id: record.id,
      email,
      requestType,
      tenantId,
    });

    return this.toModel(record);
  }

  /**
   * Get CCPA requests for a tenant (merchant view)
   */
  async getRequestsForTenant(tenantId: string, status?: CcpaRequestStatus): Promise<CcpaRequest[]> {
    const records = status
      ? await basePrisma.$queryRaw<any[]>`
          SELECT id, customer_id, email, tenant_id, request_type, status,
                 notes, ip_address, user_agent, completed_at, created_at, updated_at
          FROM ccpa_requests
          WHERE tenant_id = ${tenantId} AND status = ${status}
          ORDER BY created_at DESC
        `
      : await basePrisma.$queryRaw<any[]>`
          SELECT id, customer_id, email, tenant_id, request_type, status,
                 notes, ip_address, user_agent, completed_at, created_at, updated_at
          FROM ccpa_requests
          WHERE tenant_id = ${tenantId}
          ORDER BY created_at DESC
        `;

    return records.map(r => this.toModel(r));
  }

  /**
   * Get all CCPA requests (admin view)
   */
  async getAllRequests(status?: CcpaRequestStatus, limit = 50): Promise<CcpaRequest[]> {
    const records = status
      ? await basePrisma.$queryRaw<any[]>`
          SELECT id, customer_id, email, tenant_id, request_type, status,
                 notes, ip_address, user_agent, completed_at, created_at, updated_at
          FROM ccpa_requests
          WHERE status = ${status}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `
      : await basePrisma.$queryRaw<any[]>`
          SELECT id, customer_id, email, tenant_id, request_type, status,
                 notes, ip_address, user_agent, completed_at, created_at, updated_at
          FROM ccpa_requests
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

    return records.map(r => this.toModel(r));
  }

  /**
   * Update request status (admin action)
   */
  async updateStatus(id: string, status: CcpaRequestStatus, notes?: string): Promise<CcpaRequest> {
    const completedAt = status === 'completed' || status === 'denied' ? new Date() : null;

    const [record] = await basePrisma.$queryRaw<any[]>`
      UPDATE ccpa_requests
      SET status = ${status},
          notes = COALESCE(${notes || null}, notes),
          completed_at = COALESCE(${completedAt}, completed_at),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, customer_id, email, tenant_id, request_type, status,
                notes, ip_address, user_agent, completed_at, created_at, updated_at
    `;

    if (!record) {
      throw new Error('CCPA request not found');
    }

    logger.info('[CcpaComplianceService] CCPA request status updated', undefined, {
      id,
      status,
    });

    return this.toModel(record);
  }

  /**
   * Check if an email has an active opt-out-sale request
   */
  async hasOptOutSale(email: string): Promise<boolean> {
    const records = await basePrisma.$queryRaw<any[]>`
      SELECT 1 FROM ccpa_requests
      WHERE email = ${email} AND request_type = 'opt_out_sale' AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    return records.length > 0;
  }

  /**
   * Get data categories collected (required CCPA disclosure)
   */
  getDataCategories(): DataCategory[] {
    return DATA_CATEGORIES;
  }

  private toModel(record: any): CcpaRequest {
    return {
      id: record.id,
      customerId: record.customer_id,
      email: record.email,
      tenantId: record.tenant_id,
      requestType: record.request_type as CcpaRequestType,
      status: record.status as CcpaRequestStatus,
      notes: record.notes,
      ipAddress: record.ip_address,
      userAgent: record.user_agent,
      completedAt: record.completed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}

export default CcpaComplianceService;
