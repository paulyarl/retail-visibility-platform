/**
 * CrmTenantCrmService — Tenant CRM service
 * Extends TenantApiSingleton for Auth0 cookie-based auth with X-Tenant-ID header
 * Endpoints: /api/tenant/crm/*
 */
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import { unifiedCapabilityService } from '../UnifiedCapabilityService';
import type {
  CrmTenantCrmStats, CrmUserReadState, CrmContact, CrmContactDetail, CreateContactInput, UpdateContactInput,
  CrmTicket, CreateTicketInput, UpdateTicketInput,
  CrmTicketMessage, CreateTicketMessageInput,
  CrmTask, CrmTaskMessage, CreateTaskMessageInput, CrmActivity, CrmInquiry, CreateInquiryInput, UpdateInquiryInput,
  CrmAlert, TaskStatus,
} from '@/types/crm';

class CrmTenantCrmService extends TenantApiSingleton {
  private static instance: CrmTenantCrmService;
  private inflightStats: Promise<CrmTenantCrmStats> | null = null;

  private constructor() {
    super('crm-tenant', { ttl: 3 * 60 * 1000 });
  }

  static getInstance(): CrmTenantCrmService {
    if (!CrmTenantCrmService.instance) {
      CrmTenantCrmService.instance = new CrmTenantCrmService();
    }
    return CrmTenantCrmService.instance;
  }

  getServiceCachePatterns(): string[] {
    return [
      'crm-tenant-stats',
      'crm-tenant-read-state',
      'crm-tenant-contacts',
      'crm-tenant-contact-detail',
      'crm-tenant-tickets',
      'crm-tenant-tasks',
      'crm-tenant-activities',
      'crm-tenant-inquiries',
      'crm-tenant-alerts',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    this.inflightStats = null;
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

  // --- Stats (widget) ---
  async getStats(): Promise<CrmTenantCrmStats> {
    if (this.inflightStats) {
      return this.inflightStats;
    }

    this.inflightStats = (async () => {
      const cacheKey = 'crm-tenant-stats';
      const result = await this.makeDefaultRequest<CrmTenantCrmStats>(
        '/api/tenant/crm/stats',
        { method: 'GET' },
        cacheKey,
        3 * 60 * 1000
      );
      return this.unwrap<CrmTenantCrmStats>(result);
    })().finally(() => {
      this.inflightStats = null;
    });

    return this.inflightStats;
  }

  // --- User Read State (persistent widget read tracking) ---
  async getReadState(): Promise<CrmUserReadState[]> {
    const cacheKey = 'crm-tenant-read-state';
    const result = await this.makeDefaultRequest<CrmUserReadState[]>(
      '/api/tenant/crm/read-state',
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmUserReadState[]>(result);
  }

  async setReadState(scope: string, lastReadAt?: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      '/api/tenant/crm/read-state',
      {
        method: 'PUT',
        body: JSON.stringify({ scope, last_read_at: lastReadAt }),
      }
    );
    await this.invalidateCache('crm-tenant-stats');
    await this.invalidateCache('crm-tenant-read-state');
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  // --- Contacts ---
  async listContacts(): Promise<CrmContact[]> {
    const cacheKey = 'crm-tenant-contacts';
    const result = await this.makeDefaultRequest<CrmContact[]>(
      '/api/tenant/crm/contacts',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<CrmContact[]>(result);
  }

  async createContact(data: CreateContactInput): Promise<CrmContact> {
    const result = await this.makeDefaultRequest<CrmContact>(
      '/api/tenant/crm/contacts',
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmContact>(result);
  }

  async updateContact(contactId: string, data: UpdateContactInput): Promise<CrmContact> {
    const result = await this.makeDefaultRequest<CrmContact>(
      `/api/tenant/crm/contacts/${contactId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmContact>(result);
  }

  async getContactDetail(contactId: string): Promise<CrmContactDetail> {
    const cacheKey = `crm-tenant-contact-detail-${contactId}`;
    const result = await this.makeDefaultRequest<CrmContactDetail>(
      `/api/tenant/crm/contacts/${contactId}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmContactDetail>(result);
  }

  // --- Tickets ---
  async listTickets(filters?: { status?: string; assignedTo?: string }): Promise<CrmTicket[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    const cacheKey = `crm-tenant-tickets-${qs}`;
    const result = await this.makeDefaultRequest<CrmTicket[]>(
      `/api/tenant/crm/tickets${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      3 * 60 * 1000
    );
    return this.unwrap<CrmTicket[]>(result);
  }

  async createTicket(data: CreateTicketInput): Promise<CrmTicket> {
    const result = await this.makeDefaultRequest<CrmTicket>(
      '/api/tenant/crm/tickets',
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTicket>(result);
  }

  async createTicketFromInquiry(inquiryId: string): Promise<CrmTicket> {
    const result = await this.makeDefaultRequest<CrmTicket>(
      `/api/tenant/crm/inquiries/${inquiryId}/create-ticket`,
      { method: 'POST' }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTicket>(result);
  }

  async updateTicket(ticketId: string, data: UpdateTicketInput): Promise<CrmTicket> {
    const result = await this.makeDefaultRequest<CrmTicket>(
      `/api/tenant/crm/tickets/${ticketId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTicket>(result);
  }

  // --- Ticket Messages ---
  async listTicketMessages(ticketId: string): Promise<CrmTicketMessage[]> {
    const cacheKey = `crm-tenant-ticket-messages-${ticketId}`;
    const result = await this.makeDefaultRequest<CrmTicketMessage[]>(
      `/api/tenant/crm/tickets/${ticketId}/messages`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmTicketMessage[]>(result);
  }

  async createTicketMessage(ticketId: string, data: CreateTicketMessageInput): Promise<CrmTicketMessage> {
    const result = await this.makeDefaultRequest<CrmTicketMessage>(
      `/api/tenant/crm/tickets/${ticketId}/messages`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTicketMessage>(result);
  }

  // --- Tasks ---
  async listTasks(filters?: { status?: string; assignedTo?: string }): Promise<CrmTask[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    const cacheKey = `crm-tenant-tasks-${qs}`;
    const result = await this.makeDefaultRequest<CrmTask[]>(
      `/api/tenant/crm/tasks${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      3 * 60 * 1000
    );
    return this.unwrap<CrmTask[]>(result);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<CrmTask> {
    const result = await this.makeDefaultRequest<CrmTask>(
      `/api/tenant/crm/tasks/${taskId}`,
      { method: 'PUT', body: JSON.stringify({ status }) },
      undefined
    );
    return this.unwrap<CrmTask>(result);
  }

  // --- Task Messages ---
  async listTaskMessages(taskId: string): Promise<CrmTaskMessage[]> {
    const cacheKey = `crm-tenant-task-messages-${taskId}`;
    const result = await this.makeDefaultRequest<CrmTaskMessage[]>(
      `/api/tenant/crm/tasks/${taskId}/messages`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmTaskMessage[]>(result);
  }

  async createTaskMessage(taskId: string, data: CreateTaskMessageInput): Promise<CrmTaskMessage> {
    const result = await this.makeDefaultRequest<CrmTaskMessage>(
      `/api/tenant/crm/tasks/${taskId}/messages`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTaskMessage>(result);
  }

  // --- Activities ---
  async listActivities(filters?: { limit?: number }): Promise<CrmActivity[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)] as [string, string])
    ).toString() : '';
    const cacheKey = `crm-tenant-activities-${qs}`;
    const result = await this.makeDefaultRequest<CrmActivity[]>(
      `/api/tenant/crm/activities${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmActivity[]>(result);
  }

  // --- Inquiries ---
  async listInquiries(filters?: { status?: string; assignedTo?: string }): Promise<CrmInquiry[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    const cacheKey = `crm-tenant-inquiries-${qs}`;
    const result = await this.makeDefaultRequest<CrmInquiry[]>(
      `/api/tenant/crm/inquiries${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      3 * 60 * 1000
    );
    return this.unwrap<CrmInquiry[]>(result);
  }

  async createInquiry(data: CreateInquiryInput): Promise<CrmInquiry> {
    const result = await this.makeDefaultRequest<CrmInquiry>(
      '/api/tenant/crm/inquiries',
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmInquiry>(result);
  }

  async updateInquiry(inquiryId: string, data: UpdateInquiryInput): Promise<CrmInquiry> {
    const result = await this.makeDefaultRequest<CrmInquiry>(
      `/api/tenant/crm/inquiries/${inquiryId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmInquiry>(result);
  }

  async createFaqFromInquiry(inquiryId: string, data?: { question?: string; answer?: string; scope?: string; status?: string; category_id?: string | null; tags?: string[] }): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenant/crm/inquiries/${inquiryId}/create-faq`,
      { method: 'POST', body: JSON.stringify(data || {}) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<any>(result);
  }

  // --- Alerts ---
  async listAlerts(filters?: { type?: string; unreadOnly?: boolean }): Promise<CrmAlert[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)] as [string, string])
    ).toString() : '';
    const cacheKey = `crm-tenant-alerts-${qs}`;
    const result = await this.makeDefaultRequest<CrmAlert[]>(
      `/api/tenant/crm/alerts${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmAlert[]>(result);
  }

  async markAlertRead(alertId: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenant/crm/alerts/${alertId}/read`,
      { method: 'PUT' }
    );
    await this.invalidateServiceCaches();
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  async markAllAlertsRead(): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      '/api/tenant/crm/alerts/read-all',
      { method: 'PUT' }
    );
    await this.invalidateServiceCaches();
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  async dismissAlert(alertId: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenant/crm/alerts/${alertId}/dismiss`,
      { method: 'PUT' }
    );
    await this.invalidateServiceCaches();
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  // --- Options Settings ---
  async getOptions(tenantId: string): Promise<{ settings: Record<string, boolean>; tierState: any }> {
    const result = await this.makeDefaultRequest<{ success: boolean; settings: Record<string, boolean>; tierState: any; error?: string }>(
      `/api/tenants/${tenantId}/crm-options`,
      { method: 'GET' },
      `crm-options-${tenantId}`,
      3 * 60 * 1000,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return { settings: result.data.settings, tierState: result.data.tierState };
  }

  async updateOptions(tenantId: string, settings: Record<string, boolean>): Promise<Record<string, boolean>> {
    const result = await this.makeDefaultRequest<{ success: boolean; settings: Record<string, boolean>; error?: string }>(
      `/api/tenants/${tenantId}/crm-options`,
      { method: 'PUT', body: JSON.stringify(settings) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateCache(`crm-options-${tenantId}`);
    await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);
    return result.data.settings;
  }
}

export const crmTenantCrmService = CrmTenantCrmService.getInstance();
export default CrmTenantCrmService;
