/**
 * Notification Logs Service
 * 
 * Service for interacting with admin notification logs API endpoints
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface NotificationLog {
  id: string;
  tenant_id: string;
  tenant_name: string;
  type: string;
  sent: boolean;
  error_message?: string;
  created_at: string;
  metadata?: any;
}

export interface NotificationStats {
  summary: {
    total: number;
    sent: number;
    failed: number;
    successRate: number;
  };
  byType: Array<{
    type: string;
    total: number;
    sent: number;
    failed: number;
  }>;
}

export interface NotificationLogsResponse {
  logs: NotificationLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    types: string[];
  };
}

export interface NotificationLogsFilters {
  tenant_id?: string;
  type?: string;
  sent?: boolean;
  page?: number;
  limit?: number;
}

class NotificationLogsService extends AdminApiSingleton {
  constructor() {
    super('notification-logs');
  }

  /**
   * Get notification logs with filtering and pagination
   */
  async getLogs(filters?: NotificationLogsFilters): Promise<NotificationLogsResponse> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.tenant_id) params.append('tenant_id', filters.tenant_id);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.sent !== undefined) params.append('sent', filters.sent.toString());

      const endpoint = `/api/admin/notification-logs${params.toString() ? `?${params.toString()}` : ''}`;
      
      const result = await this.makeDefaultRequest(endpoint, {}, `notification-logs-${filters?.page || 1}`, this.cacheTTL);
      
      if (!result.success) {
        return { logs: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, filters: { types: [] } };
      }
      
      return result.data as NotificationLogsResponse;
    } catch (error) {
      console.error('Error fetching notification logs:', error);
      return { logs: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, filters: { types: [] } };
    }
  }

  /**
   * Get notification statistics
   */
  async getStats(startDate?: Date, endDate?: Date): Promise<NotificationStats | null> {
    try {
      const params = new URLSearchParams();
      
      if (startDate) params.append('start_date', startDate.toISOString());
      if (endDate) params.append('end_date', endDate.toISOString());

      const endpoint = `/api/admin/notification-logs/stats${params.toString() ? `?${params.toString()}` : ''}`;
      
      const result = await this.makeDefaultRequest(endpoint, {}, 'notification-logs-stats', this.cacheTTL);
      
      return result.success ? (result.data as NotificationStats) : null;
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      return null;
    }
  }

  /**
   * Get single notification log details
   */
  async getLogById(id: string): Promise<(NotificationLog & { tenant?: any }) | null> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/notification-logs/${id}`, {}, `notification-log-${id}`, this.cacheTTL);

      if (!result.success){
        return null;
      }
      
      return result.data as (NotificationLog & { tenant?: any });
    } catch (error) {
      console.error('Error fetching notification log:', error);
      return null;
    }
  }
}

// Export singleton instance
export const notificationLogsService = new NotificationLogsService();
