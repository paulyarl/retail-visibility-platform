/**
 * Tenant Notification Service
 * Service for tenant-specific billing notifications
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';

export interface TenantNotification {
  id: string;
  type: 'payment_reminder' | 'payment_failed' | 'new_invoice' | 'monthly_statement' | 'risk_alert' | 'payment_success';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  created_at: string;
  read: boolean;
  action_url?: string;
  action_text?: string;
  metadata?: {
    amount?: number;
    due_date?: string;
    invoice_id?: string;
    risk_score?: number;
  };
}

export interface TenantNotificationsResponse {
  notifications: TenantNotification[];
  unread_count: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface TenantNotificationsFilters {
  page?: number;
  limit?: number;
  type?: string;
  read?: boolean;
  severity?: string;
}

class TenantNotificationService extends AuthenticatedApiSingleton {
  constructor() {
    super('tenant-notifications');
  }

  /**
   * Get tenant notifications with filtering and pagination
   */
  async getNotifications(tenantId: string, filters?: TenantNotificationsFilters): Promise<TenantNotificationsResponse> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.type) params.append('type', filters.type);
      if (filters?.read !== undefined) params.append('read', filters.read.toString());
      if (filters?.severity) params.append('severity', filters.severity);

      const endpoint = `/api/tenants/${tenantId}/notifications${params.toString() ? `?${params.toString()}` : ''}`;
      
      const result = await this.makeDefaultRequest(endpoint, {}, `tenant-notifications-${tenantId}-${filters?.page || 1}`, this.cacheTTL);
      
      if (!result.success) {
        return { 
          notifications: [], 
          unread_count: 0, 
          pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } 
        };
      }
      
      return result.data as TenantNotificationsResponse;
    } catch (error) {
      clientLogger.error('Error fetching tenant notifications:', { detail: error });
      return { 
        notifications: [], 
        unread_count: 0, 
        pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } 
      };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(tenantId: string, notificationId: string): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest(
        `/api/tenants/${tenantId}/notifications/${notificationId}/read`,
        { method: 'PATCH' },
        `tenant-notification-${notificationId}-read`,
        0 // No cache for write operations
      );
      
      if (result.success) {
        // Invalidate cache for this tenant's notifications
        this.invalidateCache(`tenant-notifications-${tenantId}-`);
      }
      
      return result.success;
    } catch (error) {
      clientLogger.error('Error marking notification as read:', { detail: error });
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(tenantId: string): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest(
        `/api/tenants/${tenantId}/notifications/mark-all-read`,
        { method: 'PATCH' },
        `tenant-notifications-${tenantId}-all-read`,
        0 // No cache for write operations
      );
      
      if (result.success) {
        // Invalidate cache for this tenant's notifications
        this.invalidateCache(`tenant-notifications-${tenantId}-`);
      }
      
      return result.success;
    } catch (error) {
      clientLogger.error('Error marking all notifications as read:', { detail: error });
      return false;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(tenantId: string, notificationId: string): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest(
        `/api/tenants/${tenantId}/notifications/${notificationId}`,
        { method: 'DELETE' },
        `tenant-notification-${notificationId}-delete`,
        0 // No cache for write operations
      );
      
      if (result.success) {
        // Invalidate cache for this tenant's notifications
        this.invalidateCache(`tenant-notifications-${tenantId}-`);
      }
      
      return result.success;
    } catch (error) {
      clientLogger.error('Error deleting notification:', { detail: error });
      return false;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(tenantId: string): Promise<{
    total: number;
    unread: number;
    by_type: Record<string, number>;
    by_severity: Record<string, number>;
  } | null> {
    try {
      const result = await this.makeDefaultRequest(
        `/api/tenants/${tenantId}/notifications/stats`,
        {},
        `tenant-notifications-${tenantId}-stats`,
        this.cacheTTL
      );
      
      return result.success ? (result.data as any) : null;
    } catch (error) {
      clientLogger.error('Error fetching notification stats:', { detail: error });
      return null;
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(tenantId: string): Promise<number> {
    try {
      const result = await this.makeDefaultRequest(
        `/api/tenants/${tenantId}/notifications/unread-count`,
        {},
        `tenant-notifications-${tenantId}-unread-count`,
        300 // 5 minutes cache for unread count
      );
      
      return result.success ? ((result.data as any)?.count || 0) : 0;
    } catch (error) {
      clientLogger.error('Error fetching unread count:', { detail: error });
      return 0;
    }
  }
}

// Export singleton instance
export const tenantNotificationService = new TenantNotificationService();

// React hook for tenant notifications
import { useState, useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';

export function useTenantNotifications(tenantId: string) {
  const [notifications, setNotifications] = useState<TenantNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0
  });

  useEffect(() => {
    if (tenantId) {
      loadNotifications();
    }
  }, [tenantId]);

  const loadNotifications = async (filters?: TenantNotificationsFilters) => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const response = await tenantNotificationService.getNotifications(tenantId, filters);
      setNotifications(response.notifications);
      setUnreadCount(response.unread_count);
      setPagination(response.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!tenantId) return false;
    
    try {
      const success = await tenantNotificationService.markAsRead(tenantId, notificationId);
      if (success) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
      return false;
    }
  };

  const markAllAsRead = async () => {
    if (!tenantId) return false;
    
    try {
      const success = await tenantNotificationService.markAllAsRead(tenantId);
      if (success) {
        // Update local state
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read');
      return false;
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!tenantId) return false;
    
    try {
      const success = await tenantNotificationService.deleteNotification(tenantId, notificationId);
      if (success) {
        // Update local state
        const notification = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (notification && !notification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
      return false;
    }
  };

  const refreshNotifications = () => {
    loadNotifications({ page: pagination.page, limit: pagination.limit });
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    pagination,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications
  };
}
