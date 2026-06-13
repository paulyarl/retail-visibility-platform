/**
 * CrmTicketService — CRUD + status transitions + assignment for crm_support_tickets
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmTicketId, generateCrmActivityId, generateCustomerTenantRelationshipId } from '../lib/id-generator';

export class CrmTicketService extends BaseService {
  private static instance: CrmTicketService;

  private constructor() { super(); }

  static getInstance(): CrmTicketService {
    if (!CrmTicketService.instance) {
      CrmTicketService.instance = new CrmTicketService();
    }
    return CrmTicketService.instance;
  }

  /**
   * List tickets for a specific tenant
   */
  async listByTenant(tenantId: string, filters: { status?: string; priority?: string; assignedTo?: string } = {}) {
    const where: any = { tenant_id: tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedTo) where.assigned_to = filters.assignedTo;
    return prisma.crm_support_tickets.findMany({ where, orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }] });
  }

  /**
   * Global ticket queue (all tenants)
   */
  async listGlobal(filters: { assignedTo?: string; status?: string; priority?: string } = {}) {
    const where: any = {};
    if (filters.assignedTo) where.assigned_to = filters.assignedTo;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    return prisma.crm_support_tickets.findMany({ where, orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }] });
  }

  /**
   * List tickets for a specific customer (cross-tenant)
   */
  async listByCustomer(customerId: string, filters: { status?: string } = {}) {
    const where: any = { customer_id: customerId };
    if (filters.status) where.status = filters.status;
    return prisma.crm_support_tickets.findMany({ where, orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }] });
  }

  async getById(ticketId: string) {
    return prisma.crm_support_tickets.findUnique({ where: { id: ticketId } });
  }

  /**
   * Create ticket (platform or tenant user)
   */
  async create(data: {
    tenant_id: string;
    contact_id?: string;
    customer_id?: string;
    title: string;
    description?: string;
    priority?: string;
    category?: string;
    assigned_to?: string;
    inquiry_id?: string;
    faq_id?: string;
  }) {
    return prisma.crm_support_tickets.create({ data: { id: generateCrmTicketId(data.tenant_id), ...data } });
  }

  /**
   * Create ticket from customer (validates customer-tenant relationship)
   */
  async createFromCustomer(customerId: string, data: {
    tenant_id: string;
    title: string;
    description?: string;
    priority?: string;
    category?: string;
    faq_id?: string;
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

    return prisma.crm_support_tickets.create({
      data: {
        id: generateCrmTicketId(data.tenant_id),
        ...data,
        customer_id: customerId,
        status: 'open',
      },
    });
  }

  /**
   * Update ticket (status, assignment, priority)
   * Handles status transition side effects
   */
  async update(ticketId: string, data: {
    status?: string;
    priority?: string;
    category?: string;
    assigned_to?: string;
    inquiry_id?: string;
  }, actorId: string, actorName: string, actorType: string = 'platform') {
    const ticket = await prisma.crm_support_tickets.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    const updateData: any = { ...data, updated_at: new Date() };

    // Track first response for SLA
    if (data.status && data.status !== 'open' && !ticket.first_responded_at) {
      updateData.first_responded_at = new Date();
    }

    // Track resolution time
    if (data.status === 'resolved' && ticket.status !== 'resolved') {
      updateData.resolved_at = new Date();
    }

    const updated = await prisma.crm_support_tickets.update({
      where: { id: ticketId },
      data: updateData,
    });

    // Auto-log status change as activity
    if (data.status && data.status !== ticket.status) {
      await prisma.crm_activities.create({
        data: {
          id: generateCrmActivityId(ticket.tenant_id),
          tenant_id: ticket.tenant_id,
          ticket_id: ticketId,
          actor_id: actorId,
          actor_type: actorType,
          actor_name: actorName,
          activity_type: 'status_change',
          content: `Ticket status changed from ${ticket.status} to ${data.status}`,
          metadata: { from: ticket.status, to: data.status },
          is_internal: false,
        },
      });
    }

    // Auto-log assignment change as activity
    if (data.assigned_to && data.assigned_to !== ticket.assigned_to) {
      await prisma.crm_activities.create({
        data: {
          id: generateCrmActivityId(ticket.tenant_id),
          tenant_id: ticket.tenant_id,
          ticket_id: ticketId,
          actor_id: actorId,
          actor_type: actorType,
          actor_name: actorName,
          activity_type: 'status_change',
          content: `Ticket assigned to ${data.assigned_to}`,
          metadata: { from: ticket.assigned_to, to: data.assigned_to },
          is_internal: true,
        },
      });
    }

    return updated;
  }

  /**
   * Reorder tickets within a status column (Kanban drag-and-drop)
   * Accepts an array of { id, sort_order } pairs and batch-updates them
   */
  async reorder(items: { id: string; sort_order: number }[]) {
    const ops = items.map(item =>
      prisma.crm_support_tickets.update({
        where: { id: item.id },
        data: { sort_order: item.sort_order },
      })
    );
    return prisma.$transaction(ops);
  }
}

export default CrmTicketService;
