/**
 * PersonalCrmService — User-scoped CRM service
 * Extends AuthenticatedApiSingleton for Auth0 cookie-based auth (USER context)
 * Endpoints: /api/personal/crm/*
 *
 * Aggregates tickets, tasks, alerts, and activities across all user's tenant memberships.
 * Also supports platform support tickets (user → platform).
 */
import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import type {
  CrmTicket, CrmTicketMessage, CrmTask, CrmActivity, CrmAlert,
} from '@/types/crm';

export interface PersonalCrmDashboard {
  assigned_ticket_count: number;
  pending_task_count: number;
  unread_alert_count: number;
  platform_ticket_count: number;
  recent_activities: (CrmActivity & { tenant_name?: string })[];
  tenants: { id: string; name: string }[];
}

export interface PersonalCrmTicket extends CrmTicket {
  tenant_name?: string;
  is_platform_ticket?: boolean;
}

export interface PersonalCrmTask extends CrmTask {
  tenant_name?: string;
}

export interface PersonalCrmAlert extends CrmAlert {
  tenant_name?: string;
}

export interface PersonalCrmActivity extends CrmActivity {
  tenant_name?: string;
}

class PersonalCrmService extends AuthenticatedApiSingleton {
  private static instance: PersonalCrmService;

  private constructor() {
    super('crm-personal', { ttl: 3 * 60 * 1000 });
  }

  static getInstance(): PersonalCrmService {
    if (!PersonalCrmService.instance) {
      PersonalCrmService.instance = new PersonalCrmService();
    }
    return PersonalCrmService.instance;
  }

  getServiceCachePatterns(): string[] {
    return [
      'crm-personal-dashboard',
      'crm-personal-tickets',
      'crm-personal-tasks',
      'crm-personal-alerts',
      'crm-personal-activities',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  private unwrap<T>(result: { success: boolean; data: any; error?: any }): T {
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data?.data as T;
  }

  // --- Dashboard ---

  async getDashboard(): Promise<PersonalCrmDashboard> {
    const cacheKey = 'crm-personal-dashboard';
    const result = await this.makeDefaultRequest<PersonalCrmDashboard>(
      '/api/personal/crm/dashboard',
      { method: 'GET' },
      cacheKey,
      3 * 60 * 1000,
    );
    return this.unwrap<PersonalCrmDashboard>(result);
  }

  // --- Tickets ---

  async listTickets(filters?: { status?: string; priority?: string }): Promise<PersonalCrmTicket[]> {
    const qs = filters
      ? new URLSearchParams(
          Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][],
        ).toString()
      : '';
    const cacheKey = `crm-personal-tickets-${qs}`;
    const result = await this.makeDefaultRequest<PersonalCrmTicket[]>(
      `/api/personal/crm/tickets${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      3 * 60 * 1000,
    );
    return this.unwrap<PersonalCrmTicket[]>(result);
  }

  async createPlatformTicket(data: {
    title: string;
    description?: string;
    category?: string;
    priority?: string;
  }): Promise<CrmTicket> {
    const result = await this.makeDefaultRequest<CrmTicket>(
      '/api/personal/crm/tickets',
      { method: 'POST', body: JSON.stringify(data) },
    );
    await this.invalidateServiceCaches();
    return this.unwrap<CrmTicket>(result);
  }

  async listTicketMessages(ticketId: string): Promise<CrmTicketMessage[]> {
    const cacheKey = `crm-personal-ticket-messages-${ticketId}`;
    const result = await this.makeDefaultRequest<CrmTicketMessage[]>(
      `/api/personal/crm/tickets/${ticketId}/messages`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000,
    );
    return this.unwrap<CrmTicketMessage[]>(result);
  }

  async createTicketMessage(ticketId: string, data: { content: string; is_internal?: boolean }): Promise<CrmTicketMessage> {
    const result = await this.makeDefaultRequest<CrmTicketMessage>(
      `/api/personal/crm/tickets/${ticketId}/messages`,
      { method: 'POST', body: JSON.stringify(data) },
    );
    await this.invalidateCache(`crm-personal-ticket-messages-${ticketId}`);
    return this.unwrap<CrmTicketMessage>(result);
  }

  // --- Tasks ---

  async listTasks(filters?: { status?: string }): Promise<PersonalCrmTask[]> {
    const qs = filters
      ? new URLSearchParams(
          Object.entries(filters).filter(([, v]) => v !== undefined) as [string, string][],
        ).toString()
      : '';
    const cacheKey = `crm-personal-tasks-${qs}`;
    const result = await this.makeDefaultRequest<PersonalCrmTask[]>(
      `/api/personal/crm/tasks${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      3 * 60 * 1000,
    );
    return this.unwrap<PersonalCrmTask[]>(result);
  }

  // --- Alerts ---

  async listAlerts(filters?: { type?: string; unreadOnly?: boolean }): Promise<PersonalCrmAlert[]> {
    const qs = filters
      ? new URLSearchParams(
          Object.entries(filters)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)] as [string, string]),
        ).toString()
      : '';
    const cacheKey = `crm-personal-alerts-${qs}`;
    const result = await this.makeDefaultRequest<PersonalCrmAlert[]>(
      `/api/personal/crm/alerts${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000,
    );
    return this.unwrap<PersonalCrmAlert[]>(result);
  }

  async markAlertRead(alertId: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/personal/crm/alerts/${alertId}/read`,
      { method: 'PUT' },
    );
    await this.invalidateCache('crm-personal-alerts');
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  async markAllAlertsRead(): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      '/api/personal/crm/alerts/read-all',
      { method: 'PUT' },
    );
    await this.invalidateCache('crm-personal-alerts');
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  async dismissAlert(alertId: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/personal/crm/alerts/${alertId}/dismiss`,
      { method: 'PUT' },
    );
    await this.invalidateCache('crm-personal-alerts');
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  // --- Activities ---

  async listActivities(filters?: { limit?: number }): Promise<PersonalCrmActivity[]> {
    const qs = filters
      ? new URLSearchParams(
          Object.entries(filters)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)] as [string, string]),
        ).toString()
      : '';
    const cacheKey = `crm-personal-activities-${qs}`;
    const result = await this.makeDefaultRequest<PersonalCrmActivity[]>(
      `/api/personal/crm/activities${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      cacheKey,
      2 * 60 * 1000,
    );
    return this.unwrap<PersonalCrmActivity[]>(result);
  }
}

export const personalCrmService = PersonalCrmService.getInstance();
export default PersonalCrmService;
