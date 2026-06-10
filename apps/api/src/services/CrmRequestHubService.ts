/**
 * CrmRequestHubService — Unified inbox that unions tickets + tasks + inquiries
 * with read state, tenant name enrichment, and sorting.
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import CrmTicketService from './CrmTicketService';
import CrmTaskService from './CrmTaskService';
import CrmInquiryService from './CrmInquiryService';
import { CrmRequestReadService } from './CrmRequestReadService';

export interface RequestHubItem {
  id: string;
  type: 'ticket' | 'task' | 'inquiry';
  tenant_id: string;
  tenant_name: string;
  title: string;
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
  created_at: string | null;
  is_read: boolean;
}

export interface RequestHubFilters {
  type?: 'ticket' | 'task' | 'inquiry';
  status?: string;
  priority?: string;
  assignedTo?: string;
  tenantId?: string;
  unread?: boolean;
}

export class CrmRequestHubService extends BaseService {
  private static instance: CrmRequestHubService;
  private ticketService = CrmTicketService.getInstance();
  private taskService = CrmTaskService.getInstance();
  private inquiryService = CrmInquiryService.getInstance();
  private readService = CrmRequestReadService.getInstance();

  private constructor() { super(); }

  static getInstance(): CrmRequestHubService {
    if (!CrmRequestHubService.instance) {
      CrmRequestHubService.instance = new CrmRequestHubService();
    }
    return CrmRequestHubService.instance;
  }

  /**
   * List all requests (tickets + tasks + inquiries) with read state
   */
  async listRequests(userId: string, filters: RequestHubFilters = {}): Promise<RequestHubItem[]> {
    const { type, status, priority, assignedTo, tenantId } = filters;

    const [tickets, tasks, inquiries, readStates] = await Promise.all([
      (!type || type === 'ticket')
        ? this.ticketService.listGlobal({ assignedTo, status, priority })
        : Promise.resolve([]),
      (!type || type === 'task')
        ? this.taskService.listGlobal({ assignedTo, status, tenantId })
        : Promise.resolve([]),
      (!type || type === 'inquiry')
        ? this.inquiryService.listGlobal({ assignedTo, status })
        : Promise.resolve([]),
      this.readService.getReadStates(userId),
    ]);

    // Tenant name cache
    const tenantCache = new Map<string, string>();
    const getTenantName = async (tid: string): Promise<string> => {
      if (tenantCache.has(tid)) return tenantCache.get(tid)!;
      const tenant = await prisma.tenants.findUnique({ where: { id: tid }, select: { name: true } });
      const name = tenant?.name || 'Unknown';
      tenantCache.set(tid, name);
      return name;
    };

    const items: RequestHubItem[] = [];

    for (const t of tickets) {
      items.push({
        id: t.id,
        type: 'ticket',
        tenant_id: t.tenant_id,
        tenant_name: await getTenantName(t.tenant_id),
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigned_to: t.assigned_to,
        created_at: t.created_at ? t.created_at.toISOString() : null,
        is_read: readStates.has(t.id),
      });
    }

    for (const t of tasks) {
      items.push({
        id: t.id,
        type: 'task',
        tenant_id: t.tenant_id,
        tenant_name: await getTenantName(t.tenant_id),
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigned_to: t.assigned_to,
        created_at: t.created_at ? t.created_at.toISOString() : null,
        is_read: readStates.has(t.id),
      });
    }

    for (const i of inquiries) {
      items.push({
        id: i.id,
        type: 'inquiry',
        tenant_id: i.tenant_id,
        tenant_name: await getTenantName(i.tenant_id),
        title: i.subject,
        status: i.status,
        priority: i.priority,
        assigned_to: i.assigned_to,
        created_at: i.created_at ? i.created_at.toISOString() : null,
        is_read: readStates.has(i.id),
      });
    }

    // Filter unread if requested
    let result = filters.unread ? items.filter(i => !i.is_read) : items;

    // Sort by created_at descending
    result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

    return result;
  }

  /**
   * Compute CRM dashboard stats
   */
  async getDashboardStats(): Promise<{
    openTickets: number;
    overdueTasks: number;
    activeTenants: number;
    avgResponseTimeMs: number | null;
  }> {
    const [openTickets, overdueTasksResult, activeTenants, responseTimes] = await Promise.all([
      prisma.crm_support_tickets.count({ where: { status: { in: ['open', 'in_progress', 'waiting'] } } }),
      prisma.crm_tasks.count({
        where: {
          status: { in: ['pending', 'in_progress'] },
          due_date: { lt: new Date() },
        },
      }),
      prisma.tenants.count({ where: { subscription_status: 'active' } }),
      prisma.crm_support_tickets.findMany({
        where: {
          first_responded_at: { not: null },
          created_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { created_at: true, first_responded_at: true },
      }),
    ]);

    let avgResponseTimeMs: number | null = null;
    if (responseTimes.length > 0) {
      const totalMs = responseTimes.reduce((sum, t) => {
        if (t.first_responded_at && t.created_at) {
          return sum + (new Date(t.first_responded_at).getTime() - new Date(t.created_at).getTime());
        }
        return sum;
      }, 0);
      avgResponseTimeMs = Math.round(totalMs / responseTimes.length);
    }

    return { openTickets, overdueTasks: overdueTasksResult, activeTenants, avgResponseTimeMs };
  }
}

export default CrmRequestHubService;
