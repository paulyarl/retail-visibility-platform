/**
 * CrmInquiryService — CRUD + assignment for crm_inquiries
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmInquiryId, generateCustomerTenantRelationshipId } from '../lib/id-generator';

export class CrmInquiryService extends BaseService {
  private static instance: CrmInquiryService;

  private constructor() { super(); }

  static getInstance(): CrmInquiryService {
    if (!CrmInquiryService.instance) {
      CrmInquiryService.instance = new CrmInquiryService();
    }
    return CrmInquiryService.instance;
  }

  async listByTenant(tenantId: string, filters: { status?: string; priority?: string } = {}) {
    const where: any = { tenant_id: tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
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
    return prisma.crm_inquiries.create({ data: { id: generateCrmInquiryId(data.tenant_id), ...data } });
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

    return prisma.crm_inquiries.create({
      data: {
        id: generateCrmInquiryId(data.tenant_id),
        ...data,
        customer_id: customerId,
        status: 'open',
        source: 'customer_portal',
      },
    });
  }

  async update(inquiryId: string, data: {
    status?: string;
    priority?: string;
    assigned_to?: string;
    subject?: string;
    body?: string;
  }) {
    const updateData: any = { ...data };
    if (data.status === 'resolved') {
      updateData.resolved_at = new Date();
    }
    return prisma.crm_inquiries.update({ where: { id: inquiryId }, data: updateData });
  }
}

export default CrmInquiryService;
