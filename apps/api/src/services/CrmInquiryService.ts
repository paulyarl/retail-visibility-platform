/**
 * CrmInquiryService — CRUD + assignment for crm_inquiries
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { generateCrmInquiryId, generateCustomerTenantRelationshipId } from '../lib/id-generator';
import { PLATFORM_SCOPE } from '../lib/platform-scope';

export class CrmInquiryService extends BaseService {
  private static instance: CrmInquiryService;

  private constructor() { super(); }

  static getInstance(): CrmInquiryService {
    if (!CrmInquiryService.instance) {
      CrmInquiryService.instance = new CrmInquiryService();
    }
    return CrmInquiryService.instance;
  }

  async listByTenant(tenantId: string, filters: { status?: string; priority?: string; assignedTo?: string } = {}) {
    const where: any = { tenant_id: tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedTo) where.assigned_to = filters.assignedTo;
    return prisma.crm_inquiries.findMany({ where, orderBy: { created_at: 'desc' } });
  }

  async listGlobal(filters: { assignedTo?: string; status?: string } = {}) {
    const where: any = {};
    if (filters.assignedTo) where.assigned_to = filters.assignedTo;
    if (filters.status) where.status = filters.status;
    return prisma.crm_inquiries.findMany({ where, orderBy: { created_at: 'desc' } });
  }

  async listByCustomer(customerId: string, filters: { status?: string } = {}) {
    const where: any = { customer_id: customerId };
    if (filters.status) where.status = filters.status;
    return prisma.crm_inquiries.findMany({ where, orderBy: { created_at: 'desc' } });
  }

  async getById(inquiryId: string) {
    return prisma.crm_inquiries.findUnique({ where: { id: inquiryId } });
  }

  async create(data: {
    tenant_id: string;
    contact_id?: string;
    customer_id?: string;
    subject: string;
    body?: string;
    priority?: string;
    assigned_to?: string;
    source?: string;
    sender_name?: string;
    sender_email?: string;
    sender_phone?: string;
  }) {
    const inquiry = await prisma.crm_inquiries.create({ data: { id: generateCrmInquiryId(data.tenant_id), ...data } });
    this.notifyPlatformIntake(inquiry, data.sender_email);
    return inquiry;
  }

  async createFromCustomer(customerId: string, data: {
    tenant_id: string;
    subject: string;
    body?: string;
    priority?: string;
  }) {
    // Verify or create customer-tenant relationship
    // Customers who placed orders may not have an explicit relationship record yet
    let relationship = await prisma.customer_tenant_relationships.findUnique({
      where: {
        customer_id_tenant_id: {
          customer_id: customerId,
          tenant_id: data.tenant_id,
        },
      },
    });

    if (!relationship) {
      // Auto-create relationship — customer is explicitly reaching out to this tenant
      relationship = await prisma.customer_tenant_relationships.create({
        data: {
          id: generateCustomerTenantRelationshipId(data.tenant_id, customerId),
          customer_id: customerId,
          tenant_id: data.tenant_id,
        },
      });
    }

    const inquiry = await prisma.crm_inquiries.create({
      data: {
        id: generateCrmInquiryId(data.tenant_id),
        ...data,
        customer_id: customerId,
        status: 'open',
        source: 'customer_portal',
      },
    });

    // Platform-bound customer inquiry — resolve the requestor's email so a
    // reply from the catch-all reaches them.
    if (data.tenant_id === PLATFORM_SCOPE) {
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
        select: { email: true },
      });
      this.notifyPlatformIntake(inquiry, customer?.email);
    }

    return inquiry;
  }

  /**
   * Platform-bound inquiries (tenant_id = 'platform', e.g. the anonymous
   * Help Desk form) also email the catch-all inbox — same path as the
   * Requests-Hub alert. Tenant-scoped inquiries stay merchant-facing and
   * never trigger this. Fire-and-forget; never fails inquiry creation.
   */
  private notifyPlatformIntake(inquiry: any, replyTo?: string | null): void {
    if (inquiry.tenant_id !== PLATFORM_SCOPE) return;
    void import('./email/PlatformIntakeEmailService')
      .then((m) =>
        m.default.notifyIntakeTicket({
          ticketId: inquiry.id,
          kind: 'Inquiry',
          title: inquiry.subject,
          description: inquiry.body,
          category: inquiry.source || 'platform_inquiry',
          priority: inquiry.priority,
          inquiryId: inquiry.id,
          replyTo,
        })
      )
      .catch((err) => {
        logger.error('[CrmInquiryService] Intake email notify failed (non-fatal)', undefined, {
          error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err) },
          inquiryId: inquiry.id,
        });
      });
  }

  async update(inquiryId: string, data: {
    status?: string;
    priority?: string;
    assigned_to?: string;
    subject?: string;
    body?: string;
  }) {
    const inquiry = await prisma.crm_inquiries.findUnique({ where: { id: inquiryId } });
    if (!inquiry) throw new Error('Inquiry not found');
    if (inquiry.status === 'closed') throw new Error('Inquiry is closed and cannot be modified');

    const updateData: any = { ...data, updated_at: new Date() };
    if (data.status === 'resolved') {
      updateData.resolved_at = new Date();
    }
    return prisma.crm_inquiries.update({ where: { id: inquiryId }, data: updateData });
  }
}

export default CrmInquiryService;
