/**
 * CrmTenantService — aggregates tenant + order + ticket + task stats for CRM views
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';

export class CrmTenantService extends BaseService {
  private static instance: CrmTenantService;

  private constructor() { super(); }

  static getInstance(): CrmTenantService {
    if (!CrmTenantService.instance) {
      CrmTenantService.instance = new CrmTenantService();
    }
    return CrmTenantService.instance;
  }

  /**
   * List tenants with computed CRM stats (LTV, open tickets, pending tasks, last activity)
   */
  async listTenants(params: {
    q?: string;
    tier?: string;
    status?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: 'insensitive' } },
        { tenant_business_profiles_list: { email: { contains: params.q, mode: 'insensitive' } } },
      ];
    }
    if (params.tier) where.subscription_tier = params.tier;
    if (params.status) where.subscription_status = params.status;

    const [tenants, total] = await Promise.all([
      prisma.tenants.findMany({
        where,
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          subscription_status: true,
          service_level: true,
          location_status: true,
          created_at: true,
          tenant_business_profiles_list: { select: { email: true, phone_number: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.tenants.count({ where }),
    ]);

    // Compute CRM stats per tenant in parallel
    const tenantsWithStats = await Promise.all(
      tenants.map(async (t) => {
        const [orderAgg, openTickets, pendingTasks, lastActivity] = await Promise.all([
          prisma.orders.aggregate({
            where: { tenant_id: t.id },
            _count: true,
            _sum: { total_cents: true },
          }),
          prisma.crm_support_tickets.count({
            where: { tenant_id: t.id, status: { in: ['open', 'in_progress', 'waiting'] } },
          }),
          prisma.crm_tasks.count({
            where: { tenant_id: t.id, status: { in: ['pending', 'in_progress'] } },
          }),
          prisma.crm_activities.findFirst({
            where: { tenant_id: t.id },
            orderBy: { created_at: 'desc' },
            select: { created_at: true, activity_type: true },
          }),
        ]);

        return {
          ...t,
          email: t.tenant_business_profiles_list?.email || null,
          phone: t.tenant_business_profiles_list?.phone_number || null,
          ltv_cents: orderAgg._sum.total_cents || 0,
          order_count: orderAgg._count,
          open_tickets: openTickets,
          pending_tasks: pendingTasks,
          last_activity_at: lastActivity?.created_at?.toISOString() || null,
          last_activity_type: lastActivity?.activity_type || null,
        };
      })
    );

    return {
      data: tenantsWithStats,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get full tenant detail with CRM aggregates
   */
  async getTenantDetail(tenantId: string) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        service_level: true,
        location_status: true,
        created_at: true,
        tenant_business_profiles_list: { select: { email: true, phone_number: true, business_name: true, city: true, state: true } },
      },
    });

    if (!tenant) return null;

    const [orderAgg, openTickets, pendingTasks, recentOrders, contacts, recentActivities] = await Promise.all([
      prisma.orders.aggregate({
        where: { tenant_id: tenantId },
        _count: true,
        _sum: { total_cents: true },
      }),
      prisma.crm_support_tickets.count({
        where: { tenant_id: tenantId, status: { in: ['open', 'in_progress', 'waiting'] } },
      }),
      prisma.crm_tasks.count({
        where: { tenant_id: tenantId, status: { in: ['pending', 'in_progress'] } },
      }),
      prisma.orders.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { id: true, order_number: true, total_cents: true, order_status: true, payment_status: true, created_at: true },
      }),
      prisma.crm_contacts.findMany({
        where: { tenant_id: tenantId },
        orderBy: { is_primary: 'desc' },
        select: { id: true, first_name: true, last_name: true, email: true, phone: true, role: true, is_primary: true },
      }),
      prisma.crm_activities.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { id: true, actor_name: true, actor_type: true, activity_type: true, content: true, is_internal: true, created_at: true },
      }),
    ]);

    return {
      ...tenant,
      email: tenant.tenant_business_profiles_list?.email || null,
      phone: tenant.tenant_business_profiles_list?.phone_number || null,
      business_name: tenant.tenant_business_profiles_list?.business_name || null,
      city: tenant.tenant_business_profiles_list?.city || null,
      state: tenant.tenant_business_profiles_list?.state || null,
      ltv_cents: orderAgg._sum.total_cents || 0,
      order_count: orderAgg._count,
      orders_30d: recentOrders.length,
      open_tickets: openTickets,
      pending_tasks: pendingTasks,
      contacts,
      recent_activities: recentActivities,
      recent_orders: recentOrders,
    };
  }

  /**
   * Get paginated transactions (orders) for a tenant
   */
  async getTenantTransactions(tenantId: string, page: number = 1, limit: number = 25) {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where: { tenant_id: tenantId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          order_number: true,
          total_cents: true,
          order_status: true,
          payment_status: true,
          created_at: true,
        },
      }),
      prisma.orders.count({ where: { tenant_id: tenantId } }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get CRM dashboard stats for a tenant (tenant-scoped view)
   */
  async getTenantCrmStats(tenantId: string) {
    const [openTickets, pendingTasks, recentActivities, openInquiries] = await Promise.all([
      prisma.crm_support_tickets.findMany({
        where: { tenant_id: tenantId, status: { in: ['open', 'in_progress', 'waiting'] } },
        orderBy: { priority: 'desc' },
        take: 3,
        select: { id: true, title: true, priority: true, status: true, assigned_to: true, created_at: true },
      }),
      prisma.crm_tasks.findMany({
        where: { tenant_id: tenantId, status: { in: ['pending', 'in_progress'] } },
        orderBy: { due_date: 'asc' },
        take: 2,
        select: { id: true, title: true, status: true, due_date: true, assigned_to: true },
      }),
      prisma.crm_activities.findMany({
        where: { tenant_id: tenantId, is_internal: false },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { id: true, actor_name: true, activity_type: true, content: true, created_at: true },
      }),
      prisma.crm_inquiries.findMany({
        where: { tenant_id: tenantId, status: { in: ['new', 'in_progress'] } },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: { id: true, subject: true, status: true, contact_id: true, customer_id: true, body: true, created_at: true },
      }),
    ]);

    return { open_tickets: openTickets, pending_tasks: pendingTasks, recent_activities: recentActivities, open_inquiries: openInquiries };
  }
}

export default CrmTenantService;
