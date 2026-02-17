/**
 * Security Dashboard Singleton - Consumer Pattern
 * 
 * Provides unified access to security data for dashboard components
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { AuthenticatedApiSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';
import { LoginSession, SecurityAlert, SecurityMetrics, SecurityThreat, BlockedIP } from '@/types/security';

// Security Dashboard Data Interfaces
export interface SecurityDashboardData {
  activeSessions: LoginSession[];
  securityMetrics: SecurityMetrics;
  recentThreats: SecurityThreat[];
  blockedIPs: BlockedIP[];
  securityAlerts: SecurityAlert[];
  lastUpdated: string;
}

export interface SecurityDashboardFilters {
  timeRange?: number; // hours
  threatStatus?: 'active' | 'resolved' | 'all';
  alertLevel?: 'low' | 'medium' | 'high' | 'critical' | 'all';
  sessionType?: 'current' | 'all';
}

/**
 * Security Dashboard Singleton - Consumer Pattern
 * 
 * Consumes security data from various sources and provides
 * unified access for dashboard components
 */
class SecurityDashboardSingleton extends AuthenticatedApiSingleton {
  private static instance: SecurityDashboardSingleton;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  static getInstance(): SecurityDashboardSingleton {
    if (!SecurityDashboardSingleton.instance) {
      SecurityDashboardSingleton.instance = new SecurityDashboardSingleton('security-dashboard-singleton');
    }
    return SecurityDashboardSingleton.instance;
  }

  // ====================
  // SECURITY DASHBOARD METHODS
  // ====================

  /**
   * Get comprehensive security dashboard data
   */
  async getSecurityDashboardData(filters?: SecurityDashboardFilters): Promise<SecurityDashboardData> {
    const cacheKey = `security-dashboard-${JSON.stringify(filters || {})}`;
    
    // Check cache first
    const cached = await this.getFromCache<SecurityDashboardData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Fetch all security data in parallel for optimal performance
      const [
        activeSessions,
        securityMetrics,
        recentThreats,
        blockedIPs,
        securityAlerts
      ] = await Promise.all([
        this.getActiveSessions(filters?.sessionType),
        this.getSecurityMetrics(filters?.timeRange),
        this.getRecentThreats(filters?.threatStatus, filters?.timeRange),
        this.getBlockedIPs(filters?.timeRange),
        this.getSecurityAlerts(filters?.alertLevel, filters?.timeRange)
      ]);

      const dashboardData: SecurityDashboardData = {
        activeSessions,
        securityMetrics,
        recentThreats,
        blockedIPs,
        securityAlerts,
        lastUpdated: new Date().toISOString()
      };

      // Cache the dashboard data
      await this.setCache(cacheKey, dashboardData);

      return dashboardData;
    } catch (error) {
      console.error('Error fetching security dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get active user sessions
   */
  async getActiveSessions(sessionType?: 'current' | 'all'): Promise<LoginSession[]> {
    const cacheKey = `active-sessions-${sessionType || 'all'}`;
    
    const cached = await this.getFromCache<LoginSession[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.makeAuthenticatedRequest<{ data: LoginSession[] }>('/api/auth/sessions', {}, 'active_sessions_raw');
      
      if (!result.success) {
        console.error('Error fetching active sessions:', result.error);
        return [];
      }
      
      const sessions = result.data?.data || [];

      // Parse deviceInfo JSON string for each session
      const parsedSessions = sessions.map((session: any) => ({
        ...session,
        deviceInfo: session.deviceInfo ? JSON.parse(session.deviceInfo) : {
          type: 'Unknown',
          browser: 'Unknown', 
          os: 'Unknown'
        }
      }));

      // Filter by session type if specified
      const filteredSessions = sessionType === 'current' 
        ? parsedSessions.filter((session: LoginSession) => session.isCurrent)
        : parsedSessions;

      await this.setCache(cacheKey, filteredSessions);
      return filteredSessions;
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return [];
    }
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(hours: number = 24): Promise<SecurityMetrics> {
    const result = await this.makeAuthenticatedRequest<SecurityMetrics>(`/api/security/metrics?hours=${hours}`, {}, `security-metrics-${hours}`);
    
    if (!result.success) {
      console.error('Error fetching security metrics:', result.error);
      return {
        failedLoginAttempts: 0,
        blockedRequests: 0,
        suspiciousActivities: 0,
        activeUsers: 0,
        mfaAdoptionRate: 0,
        averageResponseTime: 0,
        rateLimitHits: 0,
        previousPeriod: {
          failedLoginAttempts: 0,
          blockedRequests: 0,
          suspiciousActivities: 0,
          activeUsers: 0,
          rateLimitHits: 0
        }
      } as SecurityMetrics;
    }
    
    return result.data || (() => { 
      throw new Error('No security metrics data received'); 
    })();
  }

  /**
   * Get recent security threats
   */
  async getRecentThreats(
    threatStatus: 'active' | 'resolved' | 'all' = 'active',
    hours: number = 24
  ): Promise<SecurityThreat[]> {
    try {
      const params = new URLSearchParams({
        limit: '50',
        resolved: (threatStatus === 'resolved').toString(),
        hours: hours.toString(),
        page: '1'
      });

      const result = await this.makeAuthenticatedRequest<{ threats: SecurityThreat[] }>(`/api/security/threats?${params}`, {}, `recent-threats-${threatStatus}-${hours}`);
      
      if (!result.success) {
        console.error('Error fetching security threats:', result.error);
        return [];
      }
      
      const threats = result.data?.threats || [];

      return threats;
    } catch (error) {
      console.error('Error fetching security threats:', error);
      return [];
    }
  }

  /**
   * Get blocked IPs
   */
  async getBlockedIPs(hours: number = 24): Promise<BlockedIP[]> {
    const result = await this.makeAuthenticatedRequest<{ data: BlockedIP[] }>(`/api/security/blocked-ips?hours=${hours}`, {}, `blocked-ips-${hours}`);
    
    if (!result.success) {
      console.error('Error fetching blocked IPs:', result.error);
      return [];
    }
    
    const blockedIPs = result.data?.data || [];

    return blockedIPs;
  }

  /**
   * Get security alerts
   */
  async getSecurityAlerts(
    alertLevel: 'low' | 'medium' | 'high' | 'critical' | 'all' = 'all',
    hours: number = 24
  ): Promise<SecurityAlert[]> {
    try {
      const params = new URLSearchParams({
        hours: hours.toString(),
        level: alertLevel === 'all' ? '' : alertLevel
      });

      const result = await this.makeAuthenticatedRequest<{ data: SecurityAlert[] }>(`/api/security/alerts?${params}`, {}, `security-alerts-${alertLevel}-${hours}`);
      
      if (!result.success) {
        console.error('Error fetching security alerts:', result.error);
        return [];
      }
      
      const alerts = result.data?.data || [];

      return alerts;
    } catch (error) {
      console.error('Error fetching security alerts:', error);
      return [];
    }
  }

  // ====================
  // SESSION MANAGEMENT
  // ====================

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    const result = await this.makeAuthenticatedRequest(`/api/auth/sessions/${sessionId}`, {
      method: 'DELETE'
    });
    
    if (!result.success) {
      console.error('Error revoking session:', result.error);
      throw new Error(result.error?.message || 'Failed to revoke session');
    }

    // Clear cache to refresh data
    await this.clearCache();
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllSessions(): Promise<void> {
    const result = await this.makeAuthenticatedRequest('/api/auth/sessions/revoke-all', {
      method: 'POST'
    });
    
    if (!result.success) {
      console.error('Error revoking all sessions:', result.error);
      throw new Error(result.error?.message || 'Failed to revoke all sessions');
    }

    // Clear cache to refresh data
    await this.clearCache();
  }

  // ====================
  // SECURITY DASHBOARD SPECIFIC METRICS
  // ====================

  protected getCustomMetrics(): Record<string, any> {
    return {
      dashboardRefreshes: 0,
      lastDataFetch: null,
      activeSessionCount: 0,
      threatCount: 0,
      alertCount: 0
    };
  }

  /**
   * Refresh all security dashboard data
   */
  async refreshDashboardData(filters?: SecurityDashboardFilters): Promise<SecurityDashboardData> {
    // Clear cache first
    await this.clearCache();
    
    // Fetch fresh data
    return this.getSecurityDashboardData(filters);
  }

  /**
   * Get security health status
   */
  async getSecurityHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
  }> {
    const result = await this.makeAuthenticatedRequest<{
      status: 'healthy' | 'warning' | 'critical';
      score: number;
      issues: string[];
    }>('/api/security/health', {}, 'security-health-status');
    
    if (!result.success) {
      console.error('Error fetching security health status:', result.error);
      return {
        status: 'warning',
        score: 75,
        issues: ['Unable to fetch complete security status']
      };
    }
    
    return result.data || {
      status: 'warning',
      score: 75,
      issues: ['No health data received']
    };
  }
}

// Export singleton instance
export const securityDashboardSingleton = SecurityDashboardSingleton.getInstance();

export default SecurityDashboardSingleton;
