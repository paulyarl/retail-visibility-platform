/**
 * Security Monitoring Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached security monitoring operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';
import {
  SecurityMetrics,
  SecurityThreat,
  BlockedIP,
  SecurityHealthStatus,
  ApiResponse,
  PaginatedResponse,
  PaginationInfo,
} from '@/types/security';

class SecurityMonitoringSingletonService extends AuthenticatedApiSingleton {
  private static instance: SecurityMonitoringSingletonService;

  private constructor() {
    super('security-monitoring-singleton');
    this.cacheTTL = 3 * 60 * 1000; // 3 minutes for monitoring data (changes frequently)
  }

  public static getInstance(): SecurityMonitoringSingletonService {
    if (!SecurityMonitoringSingletonService.instance) {
      SecurityMonitoringSingletonService.instance = new SecurityMonitoringSingletonService();
    }
    return SecurityMonitoringSingletonService.instance;
  }

  /**
   * Get security metrics for the specified time range
   */
  async getSecurityMetrics(hours: number = 24): Promise<SecurityMetrics> {
    try {
      const result = await this.makeAuthenticatedRequest<any>(
        `/api/security/metrics?hours=${hours}`,
        {},
        `security-metrics-${hours}h`
      );

      // API returns { success: true, data: { metrics: {...}, timeRange: "24 hours" } }
      return result?.data?.metrics || result?.data || {};
    } catch (error) {
      console.error('[SecurityMonitoringSingleton] Failed to get security metrics:', error);
      return {} as SecurityMetrics;
    }
  }

  /**
   * Get security threats with optional filters and pagination
   */
  async getSecurityThreats(
    limit: number = 50,
    resolved: boolean = false,
    hours: number = 24,
    page: number = 1
  ): Promise<{ threats: SecurityThreat[]; pagination: PaginationInfo }> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        page: page.toString(),
        resolved: resolved.toString(),
        hours: hours.toString(),
      });

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/security/threats?${params}`,
        {},
        `security-threats-${resolved}-${hours}h-${page}`
      );

      // API returns { success: true, data: { threats: [], pagination: {...}, ... } }
      return {
        threats: result?.data?.threats || result?.data || [],
        pagination: result?.data?.pagination || { 
          page: 1, 
          limit, 
          total: 0, 
          totalPages: 0, 
          hasNext: false, 
          hasPrev: false 
        }
      };
    } catch (error) {
      console.error('[SecurityMonitoringSingleton] Failed to get security threats:', error);
      return {
        threats: [],
        pagination: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
      };
    }
  }

  /**
   * Resolve a security threat
   */
  async resolveThreat(threatId: string, notes: string): Promise<SecurityThreat> {
    try {
      const result = await this.makeAuthenticatedRequest<SecurityThreat>(
        `/api/security/threats/${threatId}/resolve`,
        { 
          method: 'POST',
          body: JSON.stringify({ notes })
        },
        `security-resolve-threat-${threatId}`
      );

      if (!result?.data) {
        throw new Error('No data returned from threat resolution');
      }

      await this.invalidateCache('security-threats-*');

      return result.data;
    } catch (error) {
      console.error('[SecurityMonitoringSingleton] Failed to resolve threat:', error);
      throw error;
    }
  }

  /**
   * Get blocked IP addresses with pagination
   */
  async getBlockedIPs(
    hours: number = 24,
    page: number = 1,
    limit: number = 50
  ): Promise<{ blockedIPs: BlockedIP[]; pagination: PaginationInfo }> {
    try {
      const params = new URLSearchParams({
        hours: hours.toString(),
        page: page.toString(),
        limit: limit.toString(),
      });

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/security/blocked-ips?${params}`,
        {},
        `security-blocked-ips-${hours}h-${page}`
      );

      // API returns { success: true, data: { blockedIPs: [], pagination: {...}, ... } }
      return {
        blockedIPs: result?.data?.blockedIPs || result?.data || [],
        pagination: result?.data?.pagination || { 
          page: 1, 
          limit, 
          total: 0, 
          totalPages: 0, 
          hasNext: false, 
          hasPrev: false 
        }
      };
    } catch (error) {
      console.error('[SecurityMonitoringSingleton] Failed to get blocked IPs:', error);
      return {
        blockedIPs: [],
        pagination: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
      };
    }
  }

  /**
   * Unblock an IP address
   */
  async unblockIP(ipAddress: string, notes: string): Promise<void> {
    try {
      await this.makeAuthenticatedRequest<void>(
        `/api/security/blocked-ips/${ipAddress}/unblock`,
        { 
          method: 'POST',
          body: JSON.stringify({ notes })
        },
        `security-unblock-ip-${ipAddress}`
      );

      // Invalidate blocked IPs cache
      await this.invalidateCache('security-blocked-ips-*');
    } catch (error) {
      console.error('[SecurityMonitoringSingleton] Failed to unblock IP address:', error);
      throw error;
    }
  }

  /**
   * Get security health status
   */
  async getSecurityHealth(): Promise<SecurityHealthStatus> {
    try {
      const result = await this.makeAuthenticatedRequest<SecurityHealthStatus>(
        '/api/security/health',
        {},
        'security-health'
      );

      if (!result) {
        throw new Error('No data returned from security health');
      }

      return result.data || {} as SecurityHealthStatus;
    } catch (error) {
      console.error('[SecurityMonitoringSingleton] Failed to get security health:', error);
      return {} as SecurityHealthStatus;
    }
  }

  /**
   * Get alerts grouped by type with counts and recent examples
   */
  async getAlertsByType(limit: number = 5, hours: number = 168): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        hours: hours.toString(),
      });

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/admin/security/alerts/by-type?${params}`,
        {},
        `security-alerts-by-type-${limit}-${hours}h`
      );

      return result?.data || [];
    } catch (error) {
      console.error('[SecurityMonitoringSingleton] Failed to get alerts by type:', error);
      return [];
    }
  }

  /**
   * Export security report
   */
  async exportSecurityReport(
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' = 'csv'
  ): Promise<Blob | null> {
    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        format,
      });

      // For blob responses, we need to handle differently
      const response = await this.makeAuthenticatedRequest<Response>(
        `/api/security/export?${params}`,
        {},
        `security-export-${format}-${startDate.toISOString()}-${endDate.toISOString()}`
      );

      if (!response.success) {
        console.error('[SecurityMonitoringSingleton] Failed to export security report:', response.error);
        throw new Error('No response from security export');
      }

      return await response.data!.blob()||new Blob();
    } catch (error) {
      console.error('[SecurityMonitoringSingleton] Failed to export security report:', error);
      throw error;
    }
  }

  /**
   * Invalidate all security monitoring cache
   */
  public async invalidateMonitoringCache(): Promise<void> {
    await this.invalidateCache('security-*');
  }

  /**
   * Invalidate threats cache specifically
   */
  public async invalidateThreatsCache(): Promise<void> {
    await this.invalidateCache('security-threats-*');
  }

  /**
   * Invalidate blocked IPs cache specifically
   */
  public async invalidateBlockedIPsCache(): Promise<void> {
    await this.invalidateCache('security-blocked-ips-*');
  }
}

// Export singleton instance
export const securityMonitoringService = SecurityMonitoringSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateSecurityMonitoringCache = async (): Promise<void> => {
  const service = SecurityMonitoringSingletonService.getInstance();
  await service.invalidateMonitoringCache();
};

export const invalidateThreatsCache = async (): Promise<void> => {
  const service = SecurityMonitoringSingletonService.getInstance();
  await service.invalidateThreatsCache();
};

export const invalidateBlockedIPsCache = async (): Promise<void> => {
  const service = SecurityMonitoringSingletonService.getInstance();
  await service.invalidateBlockedIPsCache();
};
