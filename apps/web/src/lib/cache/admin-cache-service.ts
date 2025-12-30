/**
 * Admin Cache Service
 * Provides local storage caching for admin API calls to improve performance
 * Similar to tenant caching but optimized for admin use cases
 */

import { api } from '@/lib/api';
import { LocalStorageCache } from './local-storage-cache';

export interface AdminTenantsData {
  tenants: any[];
  total: number;
}

export interface AdminSyncStats {
  totalRuns: number;
  successRate: number;
  outOfSyncCount: number;
  failedRuns: number;
}

export interface AdminSecuritySessions {
  data: any[];
  total: number;
}

export interface AdminSecurityStats {
  activeSessions: number;
  activeUsers: number;
  sessionsLast24h: number;
  revokedSessions: number;
  deviceBreakdown: Array<{ type: string; count: number }>;
}

export interface AdminSecurityAlerts {
  data: any[];
  total: number;
}

export interface AdminSecurityAlertStats {
  totalAlerts: number;
  unreadAlerts: number;
  alertsLast24h: number;
  criticalAlerts: number;
  warningAlerts: number;
  typeBreakdown: Array<{ type: string; count: number }>;
}

export interface AdminFailedLogins {
  data: any[];
}

export interface ConsolidatedAdminData {
  tenants: AdminTenantsData;
  syncStats: AdminSyncStats;
  securitySessions: AdminSecuritySessions;
  securityStats: AdminSecurityStats;
  securityAlerts: AdminSecurityAlerts;
  securityAlertStats: AdminSecurityAlertStats;
  failedLogins: AdminFailedLogins;
  _timestamp: string;
  _cacheVersion: number;
}

export class AdminCacheService {
  private static readonly CACHE_VERSION = 1;

  // Admin-specific TTLs (shorter than tenant data since admin data can change more frequently)
  private static readonly TENANTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly SYNC_STATS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
  private static readonly SECURITY_CACHE_TTL = 1 * 60 * 1000; // 1 minute (security data is time-sensitive)

  /**
   * Get consolidated admin data with local storage caching
   * Fetches all admin data in parallel and caches results
   */
  static async getConsolidatedAdminData(useCache = true, userId?: string): Promise<ConsolidatedAdminData> {
    const cacheKey = 'admin-consolidated-data';

    // Try to get from cache first
    if (useCache) {
      const cached = await LocalStorageCache.get<ConsolidatedAdminData>(cacheKey, { userId });
      if (cached && cached._cacheVersion === this.CACHE_VERSION) {
        console.log('[AdminCacheService] Cache hit for consolidated admin data');
        return cached;
      }
    }

    console.log('[AdminCacheService] Cache miss for consolidated admin data, fetching fresh data');

    try {
      // Fetch all admin data in parallel for maximum performance
      const [
        tenantsData,
        syncStatsData,
        securitySessionsData,
        securityStatsData,
        securityAlertsData,
        securityAlertStatsData,
        failedLoginsData
      ] = await Promise.allSettled([
        this.getTenantsList(false, userId),
        this.getSyncStats(false, userId),
        this.getSecuritySessions(false, undefined, userId),
        this.getSecurityStats(false, userId),
        this.getSecurityAlerts(false, userId),
        this.getSecurityAlertStats(false, userId),
        this.getFailedLogins(false, userId)
      ]);

      // Build consolidated data object
      const consolidatedData: ConsolidatedAdminData = {
        tenants: tenantsData.status === 'fulfilled' ? tenantsData.value : { tenants: [], total: 0 },
        syncStats: syncStatsData.status === 'fulfilled' ? syncStatsData.value : {
          totalRuns: 0, successRate: 0, outOfSyncCount: 0, failedRuns: 0
        },
        securitySessions: securitySessionsData.status === 'fulfilled' ? securitySessionsData.value : { data: [], total: 0 },
        securityStats: securityStatsData.status === 'fulfilled' ? securityStatsData.value : {
          activeSessions: 0, activeUsers: 0, sessionsLast24h: 0, revokedSessions: 0, deviceBreakdown: []
        },
        securityAlerts: securityAlertsData.status === 'fulfilled' ? securityAlertsData.value : { data: [], total: 0 },
        securityAlertStats: securityAlertStatsData.status === 'fulfilled' ? securityAlertStatsData.value : {
          totalAlerts: 0, unreadAlerts: 0, alertsLast24h: 0, criticalAlerts: 0, warningAlerts: 0, typeBreakdown: []
        },
        failedLogins: failedLoginsData.status === 'fulfilled' ? failedLoginsData.value : { data: [] },
        _timestamp: new Date().toISOString(),
        _cacheVersion: this.CACHE_VERSION
      };

      // Cache the consolidated data
      await LocalStorageCache.set(cacheKey, consolidatedData, {
        ttl: Math.min(this.TENANTS_CACHE_TTL, this.SYNC_STATS_CACHE_TTL, this.SECURITY_CACHE_TTL),
        userId
      });

      return consolidatedData;

    } catch (error) {
      console.error('[AdminCacheService] Failed to fetch consolidated admin data:', error);
      // Return empty data structure on error
      return {
        tenants: { tenants: [], total: 0 },
        syncStats: { totalRuns: 0, successRate: 0, outOfSyncCount: 0, failedRuns: 0 },
        securitySessions: { data: [], total: 0 },
        securityStats: { activeSessions: 0, activeUsers: 0, sessionsLast24h: 0, revokedSessions: 0, deviceBreakdown: [] },
        securityAlerts: { data: [], total: 0 },
        securityAlertStats: { totalAlerts: 0, unreadAlerts: 0, alertsLast24h: 0, criticalAlerts: 0, warningAlerts: 0, typeBreakdown: [] },
        failedLogins: { data: [] },
        _timestamp: new Date().toISOString(),
        _cacheVersion: this.CACHE_VERSION
      };
    }
  }

  /**
   * Get tenants list with caching
   */
  static async getTenantsList(useCache = true, userId?: string): Promise<AdminTenantsData> {
    const cacheKey = 'admin-tenants';

    if (useCache) {
      const cached = await LocalStorageCache.get<AdminTenantsData>(cacheKey, { userId });
      if (cached) {
        return cached;
      }
    }

    const response = await api.get('/api/tenants');
    if (!response.ok) {
      throw new Error(`Failed to fetch tenants list: ${response.status}`);
    }

    const data = await response.json();
    const tenantsData: AdminTenantsData = {
      tenants: Array.isArray(data) ? data : [],
      total: Array.isArray(data) ? data.length : 0
    };

    LocalStorageCache.set(cacheKey, tenantsData, { ttl: this.TENANTS_CACHE_TTL });

    return tenantsData;
  }

  /**
   * Get sync statistics with caching
   */
  static async getSyncStats(useCache = true, userId?: string): Promise<AdminSyncStats> {
    const cacheKey = 'admin-sync-stats';

    if (useCache) {
      const cached = await LocalStorageCache.get<AdminSyncStats>(cacheKey, { userId });
      if (cached) {
        return cached;
      }
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const response = await api.get(`${apiBaseUrl}/api/admin/sync-stats`);
    if (!response.ok) {
      throw new Error(`Failed to fetch sync stats: ${response.status}`);
    }

    const data = await response.json();
    const syncStats: AdminSyncStats = {
      totalRuns: data.stats?.totalRuns || 0,
      successRate: data.stats?.successRate || 0,
      outOfSyncCount: data.stats?.outOfSyncCount || 0,
      failedRuns: data.stats?.failedRuns || 0
    };

    LocalStorageCache.set(cacheKey, syncStats, { ttl: this.SYNC_STATS_CACHE_TTL });

    return syncStats;
  }

  /**
   * Get security sessions with caching
   */
  static async getSecuritySessions(useCache = true, params?: { limit?: number; offset?: number }, userId?: string): Promise<AdminSecuritySessions> {
    const cacheKey = `admin-security-sessions-${JSON.stringify(params || {})}`;

    if (useCache) {
      const cached = await LocalStorageCache.get<AdminSecuritySessions>(cacheKey, { userId });
      if (cached) {
        return cached;
      }
    }

    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const response = await api.get(`/api/admin/security/sessions?${queryParams}`);
    if (!response.ok) {
      // Handle 503 gracefully for security endpoints
      if (response.status === 503) {
        console.warn('Security sessions endpoint temporarily unavailable');
        return { data: [], total: 0 };
      }
      throw new Error(`Failed to fetch security sessions: ${response.status}`);
    }

    const data = await response.json();
    const sessionsData: AdminSecuritySessions = {
      data: data.data || [],
      total: data.total || 0
    };

    LocalStorageCache.set(cacheKey, sessionsData, { ttl: this.SECURITY_CACHE_TTL });

    return sessionsData;
  }

  /**
   * Get security statistics with caching
   */
  static async getSecurityStats(useCache = true, userId?: string): Promise<AdminSecurityStats> {
    const cacheKey = 'admin-security-stats';

    if (useCache) {
      const cached = await LocalStorageCache.get<AdminSecurityStats>(cacheKey, { userId });
      if (cached) {
        return cached;
      }
    }

    const response = await api.get('/api/admin/security/sessions/stats');
    if (!response.ok) {
      if (response.status === 503) {
        console.warn('Security stats endpoint temporarily unavailable');
        return { activeSessions: 0, activeUsers: 0, sessionsLast24h: 0, revokedSessions: 0, deviceBreakdown: [] };
      }
      throw new Error(`Failed to fetch security stats: ${response.status}`);
    }

    const data = await response.json();

    LocalStorageCache.set(cacheKey, data, { ttl: this.SECURITY_CACHE_TTL });

    return data;
  }

  /**
   * Get security alerts with caching
   */
  static async getSecurityAlerts(useCache = true, userId?: string): Promise<AdminSecurityAlerts> {
    const cacheKey = 'admin-security-alerts';

    if (useCache) {
      const cached = await LocalStorageCache.get<AdminSecurityAlerts>(cacheKey, { userId });
      if (cached) {
        return cached;
      }
    }

    const response = await api.get('/api/admin/security/alerts');
    if (!response.ok) {
      throw new Error(`Failed to fetch security alerts: ${response.status}`);
    }

    const data = await response.json();
    const alertsData: AdminSecurityAlerts = {
      data: data.data || [],
      total: data.total || 0
    };

    LocalStorageCache.set(cacheKey, alertsData, { ttl: this.SECURITY_CACHE_TTL });

    return alertsData;
  }

  /**
   * Get security alert statistics with caching
   */
  static async getSecurityAlertStats(useCache = true, userId?: string): Promise<AdminSecurityAlertStats> {
    const cacheKey = 'admin-security-alert-stats';

    if (useCache) {
      const cached = await LocalStorageCache.get<AdminSecurityAlertStats>(cacheKey, { userId });
      if (cached) {
        return cached;
      }
    }

    const response = await api.get('/api/admin/security/alerts/stats');
    if (!response.ok) {
      throw new Error(`Failed to fetch security alert stats: ${response.status}`);
    }

    const data = await response.json();

    LocalStorageCache.set(cacheKey, data, { ttl: this.SECURITY_CACHE_TTL });

    return data;
  }

  /**
   * Get failed login attempts with caching
   */
  static async getFailedLogins(useCache = true, userId?: string): Promise<AdminFailedLogins> {
    const cacheKey = 'admin-failed-logins';

    if (useCache) {
      const cached = await LocalStorageCache.get<AdminFailedLogins>(cacheKey, { userId });
      if (cached) {
        return cached;
      }
    }

    const response = await api.get('/api/admin/security/failed-logins?limit=20');
    if (!response.ok) {
      if (response.status === 503) {
        console.warn('Failed logins endpoint temporarily unavailable');
        return { data: [] };
      }
      throw new Error(`Failed to fetch failed logins: ${response.status}`);
    }

    const data = await response.json();
    const failedLoginsData: AdminFailedLogins = {
      data: data.data || []
    };

    LocalStorageCache.set(cacheKey, failedLoginsData, { ttl: this.SECURITY_CACHE_TTL });

    return failedLoginsData;
  }

  /**
   * Invalidate all admin caches
   */
  static invalidateAdminCache(): void {
    console.log('[AdminCacheService] Invalidating all admin caches');
    // Clear all admin-related cache entries
    const adminKeys = [
      'admin-consolidated-data',
      'admin-tenants',
      'admin-sync-stats',
      'admin-security-sessions',
      'admin-security-stats',
      'admin-security-alerts',
      'admin-security-alert-stats',
      'admin-failed-logins'
    ];

    adminKeys.forEach(key => {
      // Clear exact matches and pattern matches (for paginated sessions)
      LocalStorageCache.delete(key);
      // Also clear any keys that start with admin- pattern
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(localKey => {
        if (localKey.startsWith(`cache:${key}`)) {
          localStorage.removeItem(localKey);
        }
      });
    });
  }

  /**
   * Force refresh all admin data (bypass cache)
   */
  static async refreshAdminData(): Promise<ConsolidatedAdminData> {
    // Clear cache first
    this.invalidateAdminCache();

    // Fetch fresh data
    return this.getConsolidatedAdminData(false);
  }

  /**
   * Get cache statistics for debugging
   */
  static getCacheStats(): { entries: number; size: number; adminKeys: string[] } {
    const allKeys = Object.keys(localStorage);
    const adminKeys = allKeys.filter(key => key.startsWith('cache:admin-'));

    let totalSize = 0;
    adminKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) totalSize += value.length;
    });

    return { entries: adminKeys.length, size: totalSize, adminKeys };
  }
}
