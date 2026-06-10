/**
 * CrmActivityService — append-only activity log for CRM
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmActivityId } from '../lib/id-generator';

export class CrmActivityService extends BaseService {
  private static instance: CrmActivityService;

  private constructor() { super(); }

  static getInstance(): CrmActivityService {
    if (!CrmActivityService.instance) {
      CrmActivityService.instance = new CrmActivityService();
    }
    return CrmActivityService.instance;
  }

  /**
   * List activities for a tenant
   */
  async listByTenant(tenantId: string, filters: { type?: string; ticketId?: string; isInternal?: boolean; limit?: number } = {}) {
    const where: any = { tenant_id: tenantId };
    if (filters.type) where.activity_type = filters.type;
    if (filters.ticketId) where.ticket_id = filters.ticketId;
    if (filters.isInternal === false) where.is_internal = false;
    return prisma.crm_activities.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: filters.limit || 50,
    });
  }

  /**
   * List all activities globally (admin dashboard)
   */
  async listGlobal(filters: { isInternal?: boolean; limit?: number } = {}) {
    const where: any = {};
    if (filters.isInternal === false) where.is_internal = false;
    return prisma.crm_activities.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: filters.limit || 20,
    });
  }

  /**
   * List activities for a customer (own tickets only, no internal)
   */
  async listByCustomer(customerId: string, filters: { limit?: number } = {}) {
    // Get tickets belonging to this customer, then fetch their activities
    const tickets = await prisma.crm_support_tickets.findMany({
      where: { customer_id: customerId },
      select: { id: true, tenant_id: true },
    });

    const ticketIds = tickets.map(t => t.id);
    const tenantIds = [...new Set(tickets.map(t => t.tenant_id))];

    return prisma.crm_activities.findMany({
      where: {
        tenant_id: { in: tenantIds },
        ticket_id: { in: ticketIds },
        is_internal: false,
      },
      orderBy: { created_at: 'desc' },
      take: filters.limit || 50,
    });
  }

  /**
   * Create an activity/note (append-only)
   */
  async create(data: {
    tenant_id: string;
    ticket_id?: string;
    task_id?: string;
    actor_id: string;
    actor_type: string; // platform | tenant | customer
    actor_name: string;
    activity_type: string;
    content?: string;
    metadata?: any;
    is_internal?: boolean;
  }) {
    return prisma.crm_activities.create({ data: { id: generateCrmActivityId(data.tenant_id), ...data } });
  }

  /**
   * Update an activity (only user-created notes, not system events)
   */
  async update(activityId: string, content: string) {
    const activity = await prisma.crm_activities.findUnique({ where: { id: activityId } });
    if (!activity) throw new Error('Activity not found');
    if (activity.activity_type === 'status_change' || activity.activity_type === 'task_created') {
      throw new Error('System activities cannot be edited');
    }
    return prisma.crm_activities.update({
      where: { id: activityId },
      data: { content },
    });
  }

  /**
   * Delete an activity (only user-created notes)
   */
  async delete(activityId: string) {
    const activity = await prisma.crm_activities.findUnique({ where: { id: activityId } });
    if (!activity) throw new Error('Activity not found');
    if (activity.activity_type === 'status_change' || activity.activity_type === 'task_created') {
      throw new Error('System activities cannot be deleted');
    }
    return prisma.crm_activities.delete({ where: { id: activityId } });
  }
}

export default CrmActivityService;
