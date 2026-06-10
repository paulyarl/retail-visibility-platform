/**
 * CrmCustomerService — Customer CRM service
 * Extends CustomerApiSingleton for JWT Bearer auth with X-Customer-ID header
 * Endpoints: /api/customer/crm/*
 */
import { CustomerApiSingleton } from '@/providers/base/CustomerApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import type {
  CrmTicket, CreateTicketInput,
  CrmTicketMessage, CreateTicketMessageInput,
  CrmActivity, CrmInquiry, CreateInquiryInput,
  CrmOrder,
} from '@/types/crm';

class CrmCustomerService extends CustomerApiSingleton {
  private static instance: CrmCustomerService;

  private constructor() {
    super('crm-customer', { ttl: 3 * 60 * 1000 });
  }

  static getInstance(): CrmCustomerService {
    if (!CrmCustomerService.instance) {
      CrmCustomerService.instance = new CrmCustomerService();
    }
    return CrmCustomerService.instance;
  }

  getServiceCachePatterns(): string[] {
    return [
      'crm-customer-tickets',
      'crm-customer-ticket-messages',
      'crm-customer-activities',
      'crm-customer-orders',
      'crm-customer-inquiries',
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

  // --- Tickets ---
  async listTickets(filters?: { status?: string }): Promise<CrmTicket[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][]
    ).toString() : '';
    const cacheKey = `crm-customer-tickets-${qs}`;
    const result = await this.makeDefaultRequest<CrmTicket[]>(
      `/api/customer/crm/tickets${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      3 * 60 * 1000
    );
    return this.unwrap<CrmTicket[]>(result);
  }

  async createTicket(data: CreateTicketInput): Promise<CrmTicket> {
    const result = await this.makeDefaultRequest<CrmTicket>(
      '/api/customer/crm/tickets',
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTicket>(result);
  }

  async getTicketDetail(ticketId: string): Promise<CrmTicket> {
    const cacheKey = `crm-customer-ticket-${ticketId}`;
    const result = await this.makeDefaultRequest<CrmTicket>(
      `/api/customer/crm/tickets/${ticketId}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmTicket>(result);
  }

  // --- Ticket Messages ---
  async listTicketMessages(ticketId: string): Promise<CrmTicketMessage[]> {
    const cacheKey = `crm-customer-ticket-messages-${ticketId}`;
    const result = await this.makeDefaultRequest<CrmTicketMessage[]>(
      `/api/customer/crm/tickets/${ticketId}/messages`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000
    );
    return this.unwrap<CrmTicketMessage[]>(result);
  }

  async createTicketMessage(ticketId: string, data: CreateTicketMessageInput): Promise<CrmTicketMessage> {
    const result = await this.makeDefaultRequest<CrmTicketMessage>(
      `/api/customer/crm/tickets/${ticketId}/messages`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTicketMessage>(result);
  }

  // --- Orders ---
  async listOrders(): Promise<CrmOrder[]> {
    const cacheKey = 'crm-customer-orders';
    const result = await this.makeDefaultRequest<CrmOrder[]>(
      '/api/customer/crm/orders',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    return this.unwrap<CrmOrder[]>(result);
  }

  // --- Activities ---
  async listActivities(filters?: { limit?: number }): Promise<CrmActivity[]> {
    const qs = filters ? new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)] as [string, string])
    ).toString() : '';
    const cacheKey = `crm-customer-activities-${qs}`;
    const result = await this.makeDefaultRequest<CrmActivity[]>(
      `/api/customer/crm/activities${qs ? `?${qs}` : ''}`,
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
    const cacheKey = `crm-customer-inquiries-${qs}`;
    const result = await this.makeDefaultRequest<CrmInquiry[]>(
      `/api/customer/crm/inquiries${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      3 * 60 * 1000
    );
    return this.unwrap<CrmInquiry[]>(result);
  }

  async createInquiry(data: CreateInquiryInput): Promise<CrmInquiry> {
    const result = await this.makeDefaultRequest<CrmInquiry>(
      '/api/customer/crm/inquiries',
      { method: 'POST', body: JSON.stringify(data) }
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmInquiry>(result);
  }
}

export const crmCustomerService = CrmCustomerService.getInstance();
export default CrmCustomerService;
