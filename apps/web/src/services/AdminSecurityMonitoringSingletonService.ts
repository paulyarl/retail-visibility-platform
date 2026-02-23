/**
 * Admin Security Monitoring Singleton Service
 * 
 * Extends AdminApiSingleton to provide cached admin security monitoring operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

interface AdminSession {
  id: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  userLastName: string | null;
  userRole: string;
  deviceInfo: {
    type: string;
    browser: string;
    os: string;
    browserVersion?: string;
    osVersion?: string;
  };
  ipAddress: string;
  location: {
    city: string;
    region: string;
    country: string;
  };
  userAgent: string;
  isCurrent: boolean;
  lastActivity: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

interface AdminAlert {
  id: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  userLastName: string | null;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metadata: Record<string, any>;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  uniqueUsers: number;
  averageSessionDuration: number;
  sessionsByDevice: Record<string, number>;
  sessionsByLocation: Record<string, number>;
  activeUsers: number;
  sessionsLast24h: number;
  revokedSessions: number;
  deviceBreakdown: Array<{ type: string; count: number }>;
}

interface AlertStats {
  totalAlerts: number;
  unreadAlerts: number;
  alertsByType: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  recentAlerts: AdminAlert[];
  alertsLast24h: number;
  criticalAlerts: number;
  warningAlerts: number;
  typeBreakdown: Array<{ type: string; count: number }>;
}

interface FailedLogin {
  id: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  attemptedAt: string;
  reason: string;
  location?: {
    city: string;
    region: string;
    country: string;
  };
  metadata: Record<string, any>;
  createdAt: string;
}

class AdminSecurityMonitoringSingletonService extends AdminApiSingleton {
  private static instance: AdminSecurityMonitoringSingletonService;

  private constructor() {
    super('admin-security-monitoring-singleton');
  }

  public static getInstance(): AdminSecurityMonitoringSingletonService {
    if (!AdminSecurityMonitoringSingletonService.instance) {
      AdminSecurityMonitoringSingletonService.instance = new AdminSecurityMonitoringSingletonService();
    }
    return AdminSecurityMonitoringSingletonService.instance;
  }

  /**
   * Get admin security sessions with pagination
   */
  async getAdminSecuritySessions(page: number = 1, pageSize: number = 50, offset: number = 0): Promise<{
    sessions: AdminSession[];
    total: number;
    hasMore: boolean;
  } | null> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: pageSize.toString(),
      offset: offset.toString(),
    });

    const result = await this.makeDefaultRequest<{
      sessions: AdminSession[];
      total: number;
      hasMore: boolean;
    }>(
      `/api/admin/security/sessions?${params}`,
      {},
      `admin-security-sessions-${page}-${pageSize}-${offset}`
    );

    if (!result.success) {
      console.error('[AdminSecurityMonitoringSingleton] Failed to get admin security sessions:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<SessionStats | null> {
    const result = await this.makeDefaultRequest<SessionStats>(
      '/api/admin/security/sessions/stats',
      {},
      'admin-security-session-stats'
    );

    if (!result.success) {
      console.error('[AdminSecurityMonitoringSingleton] Failed to get session stats:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get admin security alerts
   */
  async getSecurityAlerts(): Promise<AdminAlert[] | null> {
    const result = await this.makeDefaultRequest<{
      data: AdminAlert[];
    }>(
      '/api/admin/security/alerts',
      {},
      'admin-security-alerts'
    );

    if (!result.success) {
      console.error('[AdminSecurityMonitoringSingleton] Failed to get security alerts:', result.error);
      return null;
    }

    return result.data?.data || null;
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<AlertStats | null> {
    const result = await this.makeDefaultRequest<AlertStats>(
      '/api/admin/security/alerts/stats',
      {},
      'admin-security-alert-stats'
    );

    if (!result.success) {
      console.error('[AdminSecurityMonitoringSingleton] Failed to get alert stats:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get failed login attempts
   */
  async getFailedLogins(limit: number = 20): Promise<FailedLogin[] | null> {
    const result = await this.makeDefaultRequest<FailedLogin[]>(
      `/api/admin/security/failed-logins?limit=${limit}`,
      {},
      `admin-security-failed-logins-${limit}`
    );

    if (!result.success) {
      console.error('[AdminSecurityMonitoringSingleton] Failed to get failed logins:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Invalidate admin security monitoring cache
   */
  public async invalidateAdminSecurityCache(): Promise<void> {
    await this.invalidateCache('admin-security-*');
  }

  /**
   * Invalidate sessions cache specifically
   */
  public async invalidateSessionsCache(): Promise<void> {
    await this.invalidateCache('admin-security-sessions*');
  }

  /**
   * Invalidate alerts cache specifically
   */
  public async invalidateAlertsCache(): Promise<void> {
    await this.invalidateCache('admin-security-alerts*');
  }

  /**
   * Get user tenants for admin user management
   * Uses the /api/admin/users/:userId/tenants endpoint
   */
  async getUserTenants(userId: string): Promise<any[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Add cache-busting timestamp to ensure fresh data
    const timestamp = Date.now();
    const result = await this.makeDefaultRequest<any[]>(
      `/api/admin/users/${userId}/tenants?t=${timestamp}`,
      {},
      `admin-user-tenants-${userId}-${timestamp}`
    );

    if (!result.success) {
      console.error('[AdminSecurityMonitoring] Failed to get user tenants:', result.error);
      return [];
    }

    return result.data || [];
  }

  /**
   * Get all available tenants for admin
   * Uses the /api/admin/tenants endpoint
   */
  async getAvailableTenants(): Promise<any[]> {
    const result = await this.makeDefaultRequest<any[]>(
      '/api/admin/tenants',
      {},
      'admin-available-tenants',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminSecurityMonitoring] Failed to get available tenants:', result.error);
      return [];
    }

    return result.data || [];
  }

  /**
   * Assign tenant to user
   * Uses the /api/admin/users/:userId/tenants endpoint
   */
  async assignTenantToUser(userId: string, tenantData: {
    tenant_id: string;
    role: string;
  }): Promise<any> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/admin/users/${userId}/tenants`,
        {
          method: 'POST',
          body: JSON.stringify(tenantData)
        },
        `admin-assign-tenant-${userId}-${tenantData.tenant_id}`
      );

      return result;
    } catch (error) {
      console.error('[AdminSecurityMonitoring] Failed to assign tenant to user:', error);
      return null;
    }
  }

  /**
   * Remove tenant from user
   * Uses the /api/admin/users/:userId/tenants/:tenantId endpoint
   */
  async removeTenantFromUser(userId: string, tenantId: string): Promise<any> {
    try {
      if (!userId || !tenantId) {
        throw new Error('User ID and Tenant ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/admin/users/${userId}/tenants/${tenantId}`,
        {
          method: 'DELETE'
        },
        `admin-remove-tenant-${userId}-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[AdminSecurityMonitoring] Failed to remove tenant from user:', error);
      return null;
    }
  }

  /**
   * Update user tenant role
   * Uses the /api/admin/users/:userId/tenants/:tenantId endpoint
   */
  async updateUserTenantRole(userId: string, tenantId: string, roleData: {
    role: string;
  }): Promise<any> {
    try {
      if (!userId || !tenantId) {
        throw new Error('User ID and Tenant ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/admin/users/${userId}/tenants/${tenantId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(roleData)
        },
        `admin-update-user-role-${userId}-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[AdminSecurityMonitoring] Failed to update user tenant role:', error);
      return null;
    }
  }

  /**
   * Get tier system features for admin tier management
   * Uses the /api/admin/**
   * Get tier system features
   */
  async getTierSystemFeatures(): Promise<any[]> {
    const result = await this.makeDefaultRequest<{
      features: any[];
    }>(
      '/api/admin/tier-system/features',
      {},
      'admin-tier-features',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminSecurityMonitoring] Failed to get tier system features:', result.error);
      return [];
    }

    return result.data?.features || [];
  }

  /**
   * Create tier for admin tier management
   * Uses the /api/admin/tier-system/tiers endpoint
   */
  async createTier(tierData: {
    name: string;
    description: string;
    price: number;
    features: string[];
    limits: any;
  }): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/admin/tier-system/tiers',
        {
          method: 'POST',
          body: JSON.stringify(tierData)
        },
        'admin-create-tier'
      );

      return result;
    } catch (error) {
      console.error('[AdminSecurityMonitoring] Failed to create tier:', error);
      return null;
    }
  }

  /**
   * Update tier for admin tier management
   * Uses the /api/admin/tier-system/tiers/:tierId endpoint
   */
  async updateTier(tierId: string, tierData: {
    name?: string;
    description?: string;
    price?: number;
    features?: string[];
    limits?: any;
  }): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/admin/tier-system/tiers/${tierId}`,
        {
          method: 'PUT',
          body: JSON.stringify(tierData)
        },
        `admin-update-tier-${tierId}`
      );

      return result;
    } catch (error) {
      console.error('[AdminSecurityMonitoring] Failed to update tier:', error);
      return null;
    }
  }

  /**
   * Delete tier for admin tier management
   * Uses the /api/admin/tier-system/tiers/:tierId endpoint
   */
  async deleteTier(tierId: string): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/admin/tier-system/tiers/${tierId}`,
        {
          method: 'DELETE'
        },
        `admin-delete-tier-${tierId}`
      );

      return result;
    } catch (error) {
      console.error('[AdminSecurityMonitoring] Failed to delete tier:', error);
      return null;
    }
  }
}

// Export singleton instance
export const adminSecurityMonitoringService = AdminSecurityMonitoringSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateAdminSecurityCache = async (): Promise<void> => {
  const service = AdminSecurityMonitoringSingletonService.getInstance();
  await service.invalidateAdminSecurityCache();
};

export const invalidateSessionsCache = async (): Promise<void> => {
  const service = AdminSecurityMonitoringSingletonService.getInstance();
  await service.invalidateSessionsCache();
};

export const invalidateAlertsCache = async (): Promise<void> => {
  const service = AdminSecurityMonitoringSingletonService.getInstance();
  await service.invalidateAlertsCache();
};
