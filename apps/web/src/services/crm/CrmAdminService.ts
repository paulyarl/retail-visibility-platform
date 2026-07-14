/**
 * CrmAdminService — Platform Admin CRM service
 * Extends AdminApiSingleton for Auth0 cookie-based auth with admin headers
 * Endpoints: /api/admin/crm/*
 */
import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import type {
  PaginatedResult, CrmTenantListParams, CrmTenantSummary, CrmTenantDetail,
  CrmContact, CreateContactInput, UpdateContactInput,
  CrmTicket, CreateTicketInput, UpdateTicketInput,
  CrmTicketMessage, CreateTicketMessageInput,
  CrmTask, CreateTaskInput, UpdateTaskInput,
  CrmActivity, CreateActivityInput,
  CrmInquiry, CreateInquiryInput, UpdateInquiryInput,
  CrmAlert, CrmOrder, RequestListParams, CrmRequestItem,
} from '@/types/crm';

class CrmAdminService extends AdminApiSingleton {
  private static instance: CrmAdminService;

  private constructor() {
    super('crm-admin', { ttl: 5 * 60 * 1000 });
  }

  static getInstance(): CrmAdminService {
    if (!CrmAdminService.instance) {
      CrmAdminService.instance = new CrmAdminService();
    }
    return CrmAdminService.instance;
  }

  // --- Cache management ---
  getServiceCachePatterns(): string[] {
    return [
      'crm-tenant-list',
      'crm-tenant-detail',
      'crm-tenant-transactions',
      'crm-contacts',
      'crm-tickets',
      'crm-ticket-messages',
      'crm-tasks',
      'crm-activities',
      'crm-inquiries',
      'crm-requests',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  /** Unwrap API response: makeDefaultRequest stores full JSON body in result.data,
   *  but our API wraps payloads in { success, data }, so the actual payload is result.data.data */
  private unwrap<T>(result: { success: boolean; data: any; error?: any }): T {
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data?.data as T;
  }

  // --- Tenants (read-only for CRM context) ---
  async listTenants(params: CrmTenantListParams): Promise<PaginatedResult<CrmTenantSummary>> {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const cacheKey = `crm-tenant-list-${qs}`;
    const result = await this.makeDefaultRequest<PaginatedResult<CrmTenantSummary>>(
      `/api/admin/crm/tenants?${qs}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<PaginatedResult<CrmTenantSummary>>(result);
  }

  async getTenantDetail(tenantId: string): Promise<CrmTenantDetail> {
    const cacheKey = `crm-tenant-detail-${tenantId}`;
    const result = await this.makeDefaultRequest<CrmTenantDetail>(
      `/api/admin/crm/tenants/${tenantId}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<CrmTenantDetail>(result);
  }

  async getTenantTransactions(tenantId: string, page: number = 1, limit: number = 25): Promise<PaginatedResult<CrmOrder>> {
    const cacheKey = `crm-tenant-transactions-${tenantId}-${page}`;
    const result = await this.makeDefaultRequest<PaginatedResult<CrmOrder>>(
      `/api/admin/crm/tenants/${tenantId}/transactions?page=${page}&limit=${limit}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<PaginatedResult<CrmOrder>>(result);
  }

  // --- Contacts (CRUD) ---
  async listContacts(tenantId: string): Promise<CrmContact[]> {
    const cacheKey = `crm-contacts-${tenantId}`;
    const result = await this.makeDefaultRequest<CrmContact[]>(
      `/api/admin/crm/tenants/${tenantId}/contacts`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<CrmContact[]>(result);
  }

  async createContact(tenantId: string, data: CreateContactInput): Promise<CrmContact> {
    const result = await this.makeDefaultRequest<CrmContact>(
      `/api/admin/crm/tenants/${tenantId}/contacts`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmContact>(result);
  }

  async updateContact(contactId: string, data: UpdateContactInput): Promise<CrmContact> {
    const result = await this.makeDefaultRequest<CrmContact>(
      `/api/admin/crm/contacts/${contactId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmContact>(result);
  }

  async deleteContact(contactId: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/admin/crm/contacts/${contactId}`,
      { method: 'DELETE' }
    );
    await this.invalidateServiceCaches();
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  // --- Tickets (CRUD + status) ---
  async getTicket(ticketId: string): Promise<CrmTicket> {
    const cacheKey = `crm-ticket-${ticketId}`;
    const result = await this.makeDefaultRequest<CrmTicket>(
      `/api/admin/crm/tickets/${ticketId}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmTicket>(result);
  }

  async listTickets(tenantId: string, filters?: { status?: string; priority?: string }): Promise<CrmTicket[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    const cacheKey = `crm-tickets-${tenantId}-${qs}`;
    const result = await this.makeDefaultRequest<CrmTicket[]>(
      `/api/admin/crm/tenants/${tenantId}/tickets${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<CrmTicket[]>(result);
  }

  async listGlobalTickets(filters?: { assignedTo?: string; status?: string; priority?: string; category?: string }): Promise<CrmTicket[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    const cacheKey = `crm-tickets-global-${qs}`;
    const result = await this.makeDefaultRequest<CrmTicket[]>(
      `/api/admin/crm/tickets${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<CrmTicket[]>(result);
  }

  async createTicket(tenantId: string, data: CreateTicketInput): Promise<CrmTicket> {
    const result = await this.makeDefaultRequest<CrmTicket>(
      `/api/admin/crm/tenants/${tenantId}/tickets`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTicket>(result);
  }

  async updateTicket(ticketId: string, data: UpdateTicketInput): Promise<CrmTicket> {
    const result = await this.makeDefaultRequest<CrmTicket>(
      `/api/admin/crm/tickets/${ticketId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTicket>(result);
  }

  // --- Ticket Messages ---
  async listTicketMessages(ticketId: string): Promise<CrmTicketMessage[]> {
    const cacheKey = `crm-ticket-messages-${ticketId}`;
    const result = await this.makeDefaultRequest<CrmTicketMessage[]>(
      `/api/admin/crm/tickets/${ticketId}/messages`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmTicketMessage[]>(result);
  }

  async createTicketMessage(ticketId: string, data: CreateTicketMessageInput): Promise<CrmTicketMessage> {
    const result = await this.makeDefaultRequest<CrmTicketMessage>(
      `/api/admin/crm/tickets/${ticketId}/messages`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTicketMessage>(result);
  }

  // --- Tasks (CRUD) ---
  async listTasks(filters?: { assignedTo?: string; status?: string; tenantId?: string }): Promise<CrmTask[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    const cacheKey = `crm-tasks-${qs}`;
    const result = await this.makeDefaultRequest<CrmTask[]>(
      `/api/admin/crm/tasks${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<CrmTask[]>(result);
  }

  async createTask(data: CreateTaskInput): Promise<CrmTask> {
    const result = await this.makeDefaultRequest<CrmTask>(
      '/api/admin/crm/tasks',
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTask>(result);
  }

  async updateTask(taskId: string, data: UpdateTaskInput): Promise<CrmTask> {
    const result = await this.makeDefaultRequest<CrmTask>(
      `/api/admin/crm/tasks/${taskId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTask>(result);
  }

  async deleteTask(taskId: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/admin/crm/tasks/${taskId}`,
      { method: 'DELETE' }
    );
    await this.invalidateServiceCaches();
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  // --- Activities (append-only) ---
  async listActivities(tenantId: string, filters?: { type?: string; ticketId?: string; limit?: number }): Promise<CrmActivity[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    const cacheKey = `crm-activities-${tenantId}-${qs}`;
    const result = await this.makeDefaultRequest<CrmActivity[]>(
      `/api/admin/crm/tenants/${tenantId}/activities${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmActivity[]>(result);
  }

  async listGlobalActivities(filters?: { limit?: number; isInternal?: boolean }): Promise<CrmActivity[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)] as [string, string])
    ).toString() : '';
    const cacheKey = `crm-global-activities-${qs}`;
    const result = await this.makeDefaultRequest<CrmActivity[]>(
      `/api/admin/crm/activities${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmActivity[]>(result);
  }

  async createActivity(tenantId: string, data: CreateActivityInput): Promise<CrmActivity> {
    const result = await this.makeDefaultRequest<CrmActivity>(
      `/api/admin/crm/tenants/${tenantId}/activities`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmActivity>(result);
  }

  // --- Inquiries ---
  async listInquiries(tenantId: string, filters?: { status?: string; priority?: string }): Promise<CrmInquiry[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    const cacheKey = `crm-inquiries-${tenantId}-${qs}`;
    const result = await this.makeDefaultRequest<CrmInquiry[]>(
      `/api/admin/crm/tenants/${tenantId}/inquiries${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<CrmInquiry[]>(result);
  }

  async createInquiry(tenantId: string, data: CreateInquiryInput): Promise<CrmInquiry> {
    const result = await this.makeDefaultRequest<CrmInquiry>(
      `/api/admin/crm/tenants/${tenantId}/inquiries`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmInquiry>(result);
  }

  async updateInquiry(inquiryId: string, data: UpdateInquiryInput): Promise<CrmInquiry> {
    const result = await this.makeDefaultRequest<CrmInquiry>(
      `/api/admin/crm/inquiries/${inquiryId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmInquiry>(result);
  }

  // --- Requests Hub ---
  async listRequests(params: RequestListParams): Promise<CrmRequestItem[]> {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const cacheKey = `crm-requests-${qs}`;
    const result = await this.makeDefaultRequest<CrmRequestItem[]>(
      `/api/admin/crm/requests?${qs}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmRequestItem[]>(result);
  }

  async updateRequest(requestId: string, type: string, data: Record<string, any>): Promise<CrmRequestItem> {
    const result = await this.makeDefaultRequest<CrmRequestItem>(
      `/api/admin/crm/requests/${requestId}`,
      { method: 'PATCH', body: JSON.stringify({ type, ...data }) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmRequestItem>(result);
  }

  async markRequestRead(requestId: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/admin/crm/requests/${requestId}/read`,
      { method: 'POST' }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  async markAllRequestsRead(): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      '/api/admin/crm/requests/read-all',
      { method: 'POST' }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  // --- Dashboard Stats ---
  async getDashboardStats(): Promise<{
    openTickets: number;
    overdueTasks: number;
    activeTenants: number;
    avgResponseTimeMs: number | null;
  }> {
    const cacheKey = 'crm-dashboard-stats';
    const result = await this.makeDefaultRequest<{
      openTickets: number;
      overdueTasks: number;
      activeTenants: number;
      avgResponseTimeMs: number | null;
    }>(
      '/api/admin/crm/dashboard-stats',
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<{ openTickets: number; overdueTasks: number; activeTenants: number; avgResponseTimeMs: number | null }>(result);
  }

  // --- Alerts ---
  async createAlert(data: { tenant_id: string; type: string; title: string; body?: string; icon?: string; metadata?: Record<string, any> }): Promise<CrmAlert> {
    const result = await this.makeDefaultRequest<CrmAlert>(
      '/api/admin/crm/alerts',
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmAlert>(result);
  }

  async broadcastAlert(data: { tenant_ids?: string[]; send_to_all?: boolean; type: string; title: string; body?: string; icon?: string; cta_label?: string; cta_href?: string; metadata?: Record<string, any> }): Promise<{ alerts: CrmAlert[]; count: number }> {
    const result = await this.makeDefaultRequest<{ alerts: CrmAlert[]; count: number }>(
      '/api/admin/crm/alerts/broadcast',
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    const unwrapped = this.unwrap<{ data: CrmAlert[]; count: number }>(result as any);
    return { alerts: unwrapped.data, count: unwrapped.count };
  }

  // --- Global Inquiries ---
  async listGlobalInquiries(filters?: { assignedTo?: string; status?: string; priority?: string }): Promise<CrmInquiry[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    const cacheKey = `crm-inquiries-global-${qs}`;
    const result = await this.makeDefaultRequest<CrmInquiry[]>(
      `/api/admin/crm/inquiries${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<CrmInquiry[]>(result);
  }

  // --- Directory Promotions ---
  async getPromotionStats(): Promise<{
    activeCount: number;
    gracePeriodCount: number;
    expiredCount: number;
    totalRevenueCents: number;
    upcomingRenewals: any[];
    gracePeriodPromotions: any[];
    recentActivations: any[];
  }> {
    const cacheKey = 'crm-promotion-stats';
    const result = await this.makeDefaultRequest<any>(
      '/api/admin/promotion/stats',
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<any>(result);
  }

  async getTenantPromotion(tenantId: string): Promise<{
    activePurchase: any | null;
    purchases: any[];
  }> {
    const cacheKey = `crm-promotion-tenant-${tenantId}`;
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/promotion/tenant/${tenantId}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<any>(result);
  }
}

export const crmAdminService = CrmAdminService.getInstance();
export default CrmAdminService;
