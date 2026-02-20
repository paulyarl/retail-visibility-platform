/**
 * Admin Operations Service
 * 
 * Extends AdminApiSingleton to provide cached admin operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalTenants: number;
  activeTenants: number;
  totalProducts: number;
  totalOrders: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastSync: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLogin?: string;
  tenants: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

interface AdminTenant {
  id: string;
  name: string;
  domain?: string;
  status: 'active' | 'inactive' | 'suspended';
  plan: string;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    name: string;
  };
  userCount: number;
  productCount: number;
  orderCount: number;
}

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SecurityMetrics {
  failedLogins: number;
  blockedIPs: number;
  activeSessions: number;
  securityAlerts: number;
  lastSecurityScan: string;
  threatsBlocked: number;
}

class AdminOperationsService extends AdminApiSingleton {
  private static instance: AdminOperationsService;

  private constructor() {
    super('admin-operations');
  }

  static getInstance(): AdminOperationsService {
    if (!AdminOperationsService.instance) {
      AdminOperationsService.instance = new AdminOperationsService();
    }
    return AdminOperationsService.instance;
  }

  /**
   * Get admin dashboard statistics
   */
  async getAdminStats(): Promise<AdminStats | null> {
    const result = await this.makeAdminRequest<AdminStats>(
      '/api/admin/stats',
      {},
      'admin-stats',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminOperationsService] Failed to get admin stats:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get all users with pagination
   */
  async getUsers(page: number = 1, limit: number = 50, filters?: {
    role?: string;
    status?: 'active' | 'inactive';
    search?: string;
  }): Promise<{ users: AdminUser[]; pagination: any }> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters?.role) params.append('role', filters.role);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const result = await this.makeAdminRequest<{ users: AdminUser[]; pagination: any }>(
      `/api/admin/users?${params.toString()}`,
      {},
      `admin-users-${page}-${limit}-${JSON.stringify(filters)}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminOperationsService] Failed to get users:', result.error);
      return { users: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    }

    return result.data || { users: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
  }

  /**
   * Get all tenants with pagination
   */
  async getTenants(page: number = 1, limit: number = 50, filters?: {
    status?: 'active' | 'inactive' | 'suspended';
    plan?: string;
    search?: string;
  }): Promise<{ tenants: AdminTenant[]; pagination: any }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters?.status) params.append('status', filters.status);
      if (filters?.plan) params.append('plan', filters.plan);
      if (filters?.search) params.append('search', filters.search);

      const result = await this.makeAdminRequest<{ tenants: AdminTenant[]; pagination: any }>(
        `/api/admin/tenants?${params.toString()}`,
        {},
        `admin-tenants-${page}-${limit}-${JSON.stringify(filters)}`,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[AdminOperationsService] Failed to get tenants:', result.error);
        return { tenants: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
      }

      return result.data || { tenants: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    } catch (error) {
      console.error('[AdminOperationsService] Failed to get tenants:', error);
      return { tenants: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    }
  }

  /**
   * Get system alerts
   */
  async getSystemAlerts(resolved: boolean = false, page: number = 1, limit: number = 50): Promise<{ alerts: SystemAlert[]; pagination: any }> {
    try {
      const result = await this.makeAdminRequest<{ alerts: SystemAlert[]; pagination: any }>(
        `/api/admin/alerts?resolved=${resolved}&page=${page}&limit=${limit}`,
        {},
        `admin-alerts-${resolved}-${page}-${limit}`,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[AdminOperationsService] Failed to get system alerts:', result.error);
        return { alerts: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
      }

      return result.data || { alerts: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    } catch (error) {
      console.error('[AdminOperationsService] Failed to get system alerts:', error);
      return { alerts: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    }
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(): Promise<SecurityMetrics | null> {
    const result = await this.makeAdminRequest<SecurityMetrics>(
      '/api/admin/security/metrics',
      {},
      'admin-security-metrics',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminOperationsService] Failed to get security metrics:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Resolve system alert
   */
  async resolveAlert(alertId: string, resolution: string): Promise<boolean> {
    const result = await this.makeAdminRequest<void>(
      `/api/admin/alerts/${alertId}/resolve`,
      {
        method: 'PUT',
        body: JSON.stringify({ resolution })
      },
      `admin-alert-${alertId}`,
      0 // No cache for updates
    );

    if (!result.success) {
      console.error('[AdminOperationsService] Failed to resolve alert:', result.error);
      return false;
    }

    // Invalidate alerts cache
    await this.invalidateCache('admin-alerts*');

    return true;
  }

  /**
   * Suspend/unsuspend user
   */
  async updateUserStatus(userId: string, isActive: boolean, reason?: string): Promise<boolean> {
    const result = await this.makeAdminRequest<void>(
      `/api/admin/users/${userId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ isActive, reason })
      },
      `admin-user-status-${userId}`,
      0 // No cache for updates
    );

    if (!result.success) {
      console.error('[AdminOperationsService] Failed to update user status:', result.error);
      return false;
    }

    // Invalidate user-related caches
    await this.invalidateCache('admin-users*');
    await this.invalidateCache('admin-stats*');

    return true;
  }

  /**
   * Suspend/unsuspend tenant
   */
  async updateTenantStatus(tenantId: string, status: 'active' | 'inactive' | 'suspended', reason?: string): Promise<boolean> {
    const result = await this.makeAdminRequest<void>(
      `/api/admin/tenants/${tenantId}/status`,
      {
        method: 'PUT',
        body: JSON.stringify({ status, reason })
      },
      `admin-tenant-status-${tenantId}`,
      0 // No cache for updates
    );

    if (!result.success) {
      console.error('[AdminOperationsService] Failed to update tenant status:', result.error);
      return false;
    }

    // Invalidate tenant-related caches
    await this.invalidateCache('admin-tenants*');
    await this.invalidateCache('admin-stats*');

    return true;
  }

  /**
   * Get admin activity logs
   */
  async getActivityLogs(page: number = 1, limit: number = 50, filters?: {
    userId?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ logs: any[]; pagination: any }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.action) params.append('action', filters.action);
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);

      const result = await this.makeAdminRequest<{ logs: any[]; pagination: any }>(
        `/api/admin/activity-logs?${params.toString()}`,
        {},
        `admin-activity-logs-${page}-${limit}-${JSON.stringify(filters)}`,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[AdminOperationsService] Failed to get activity logs:', result.error);
        return { logs: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
      }

      return result.data || { logs: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    } catch (error) {
      console.error('[AdminOperationsService] Failed to get activity logs:', error);
      return { logs: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
    }
  }

  /**
   * Export admin data (users, tenants, etc.)
   */
  async exportData(type: 'users' | 'tenants' | 'orders' | 'products', format: 'csv' | 'json' = 'csv', filters?: any): Promise<Blob> {
    try {
      const params = new URLSearchParams({
        format,
        ...(filters || {})
      });

      const result = await this.makeAdminRequest<Blob>(
        `/api/admin/export/${type}?${params.toString()}`,
        {},
        `admin-export-${type}-${format}`,
        0 // No cache for exports
      );

      if (!result.success) {
        console.error('[AdminOperationsService] Failed to export data:', result.error);
        throw new Error(result.error?.message || 'Failed to export data');
      }

      return result.data || (() => { throw new Error('No export data received'); })();
    } catch (error) {
      console.error('[AdminOperationsService] Failed to export data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const adminOperationsService = AdminOperationsService.getInstance();

// Export types
export type { 
  AdminStats, 
  AdminUser, 
  AdminTenant, 
  SystemAlert, 
  SecurityMetrics 
};
