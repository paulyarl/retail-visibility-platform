import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface ErrorLogEntry {
  id: string;
  occurred_at: string;
  level: string;
  message: string;
  error_name: string | null;
  tenant_id: string | null;
  user_id: string | null;
  request_method: string | null;
  request_path: string | null;
  status_code: number | null;
  correlation_id: string | null;
  service: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface ErrorLogDetail extends ErrorLogEntry {
  stack_trace?: string | null;
  context?: any;
  extra?: any;
}

export interface ErrorLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ErrorLogResponse {
  errors: ErrorLogEntry[];
  pagination: ErrorLogPagination;
}

export interface ErrorLogStats {
  period: { days: number; since: string };
  total: number;
  unresolved: number;
  byLevel: Array<{ level: string; count: number }>;
  byService: Array<{ service: string | null; count: number }>;
  byTenant: Array<{ tenantId: string | null; count: number }>;
}

export interface ErrorLogFilters {
  page?: number;
  limit?: number;
  tenant_id?: string;
  level?: string;
  service?: string;
  resolved?: boolean;
  correlation_id?: string;
  from?: string;
  to?: string;
}

class AdminErrorLogService extends AdminApiSingleton {
  constructor() {
    super('admin-error-logs');
  }

  async getErrors(filters?: ErrorLogFilters): Promise<ErrorLogResponse> {
    try {
      const params = new URLSearchParams();
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.tenant_id) params.append('tenant_id', filters.tenant_id);
      if (filters?.level) params.append('level', filters.level);
      if (filters?.service) params.append('service', filters.service);
      if (filters?.resolved !== undefined) params.append('resolved', filters.resolved.toString());
      if (filters?.correlation_id) params.append('correlation_id', filters.correlation_id);
      if (filters?.from) params.append('from', filters.from);
      if (filters?.to) params.append('to', filters.to);

      const endpoint = `/api/admin/errors${params.toString() ? `?${params.toString()}` : ''}`;
      const result = await this.makeDefaultRequest(endpoint, {}, `error-logs-${filters?.page || 1}`, 0);

      if (!result.success) {
        return { errors: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
      }
      return result.data as ErrorLogResponse;
    } catch (error) {
      clientLogger.error('[AdminErrorLogService] Error fetching errors:', { detail: error });
      return { errors: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    }
  }

  async getStats(days?: number): Promise<ErrorLogStats | null> {
    try {
      const params = new URLSearchParams();
      if (days) params.append('days', days.toString());
      const endpoint = `/api/admin/errors/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const result = await this.makeDefaultRequest(endpoint, {}, 'error-logs-stats', 0);

      return result.success ? (result.data as ErrorLogStats) : null;
    } catch (error) {
      clientLogger.error('[AdminErrorLogService] Error fetching stats:', { detail: error });
      return null;
    }
  }

  async getErrorById(id: string): Promise<ErrorLogDetail | null> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/errors/${id}`, {}, `error-log-${id}`, 0);
      return result.success ? (result.data as ErrorLogDetail) : null;
    } catch (error) {
      clientLogger.error('[AdminErrorLogService] Error fetching error detail:', { detail: error });
      return null;
    }
  }

  async resolveError(id: string): Promise<ErrorLogEntry | null> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/errors/${id}/resolve`, {
        method: 'POST',
      }, `error-log-resolve-${id}`, 0);

      return result.success ? (result.data as ErrorLogEntry) : null;
    } catch (error) {
      clientLogger.error('[AdminErrorLogService] Error resolving error:', { detail: error });
      return null;
    }
  }
}

export const adminErrorLogService = new AdminErrorLogService();
