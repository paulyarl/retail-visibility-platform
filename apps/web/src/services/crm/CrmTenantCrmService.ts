/**
 * CrmTenantCrmService — Tenant CRM service
 * Extends TenantApiSingleton for Auth0 cookie-based auth with X-Tenant-ID header
 * Endpoints: /api/tenant/crm/*
 */
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import type {
  CrmTenantCrmStats, CrmContact, CreateContactInput, UpdateContactInput,
  CrmTicket, CreateTicketInput, UpdateTicketInput,
  CrmTicketMessage, CreateTicketMessageInput,
  CrmTask, CrmActivity, CrmInquiry, CreateInquiryInput, UpdateInquiryInput,
} from '@/types/crm';

class CrmTenantCrmService extends TenantApiSingleton {
  private static instance: CrmTenantCrmService;

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
      'crm-tenant-contacts',
      'crm-tenant-tickets',
      'crm-tenant-tasks',
      'crm-tenant-activities',
      'crm-tenant-inquiries',
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

  // --- Stats (widget) ---
  async getStats(): Promise<CrmTenantCrmStats> {
    const cacheKey = 'crm-tenant-stats';
    const result = await this.makeDefaultRequest<CrmTenantCrmStats>(
      '/api/tenant/crm/stats',
      { method: 'GET' },
      cacheKey,
      3 * 60 * 1000
    );
    return this.unwrap<CrmTenantCrmStats>(result);
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

  // --- Tickets ---
  async listTickets(filters?: { status?: string }): Promise<CrmTicket[]> {
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

  // --- Tasks (read-only) ---
  async listTasks(filters?: { status?: string }): Promise<CrmTask[]> {
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
  async listInquiries(filters?: { status?: string }): Promise<CrmInquiry[]> {
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
}

export const crmTenantCrmService = CrmTenantCrmService.getInstance();
export default CrmTenantCrmService;
