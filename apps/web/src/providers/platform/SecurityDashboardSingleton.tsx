/**
 * Security Dashboard Singleton - Consumer Pattern
 * 
 * Provides unified access to security data for dashboard components
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';
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
class SecurityDashboardSingleton extends UniversalSingleton {
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
      const response = await fetch('/api/auth/sessions');
      
      if (!response.ok) {
        throw new Error('Failed to fetch active sessions');
      }

      const data = await response.json();
      const sessions = data.data || [];

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
    const cacheKey = `security-metrics-${hours}`;
    
    const cached = await this.getFromCache<SecurityMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/security/metrics?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch security metrics');
      }

      const result = await response.json();
      const metrics = result as unknown as SecurityMetrics;

      await this.setCache(cacheKey, metrics);
      return metrics;
    } catch (error) {
      console.error('Error fetching security metrics:', error);
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
  }

  /**
   * Get recent security threats
   */
  async getRecentThreats(
    threatStatus: 'active' | 'resolved' | 'all' = 'active',
    hours: number = 24
  ): Promise<SecurityThreat[]> {
    const cacheKey = `recent-threats-${threatStatus}-${hours}`;
    
    const cached = await this.getFromCache<SecurityThreat[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams({
        limit: '50',
        resolved: (threatStatus === 'resolved').toString(),
        hours: hours.toString(),
        page: '1'
      });

      const response = await fetch(`/api/security/threats?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch security threats');
      }

      const result = await response.json();
      const threats = result.threats || [];

      await this.setCache(cacheKey, threats);
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
    const cacheKey = `blocked-ips-${hours}`;
    
    const cached = await this.getFromCache<BlockedIP[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/security/blocked-ips?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch blocked IPs');
      }

      const result = await response.json();
      const blockedIPs = result.data || [];

      await this.setCache(cacheKey, blockedIPs);
      return blockedIPs;
    } catch (error) {
      console.error('Error fetching blocked IPs:', error);
      return [];
    }
  }

  /**
   * Get security alerts
   */
  async getSecurityAlerts(
    alertLevel: 'low' | 'medium' | 'high' | 'critical' | 'all' = 'all',
    hours: number = 24
  ): Promise<SecurityAlert[]> {
    const cacheKey = `security-alerts-${alertLevel}-${hours}`;
    
    const cached = await this.getFromCache<SecurityAlert[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams({
        hours: hours.toString(),
        level: alertLevel === 'all' ? '' : alertLevel
      });

      const response = await fetch(`/api/security/alerts?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch security alerts');
      }

      const result = await response.json();
      const alerts = result.data || [];

      await this.setCache(cacheKey, alerts);
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
    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }

      // Clear cache to refresh data
      await this.clearCache();
    } catch (error) {
      console.error('Error revoking session:', error);
      throw error;
    }
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllSessions(): Promise<void> {
    try {
      const response = await fetch('/api/auth/sessions/revoke-all', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to revoke all sessions');
      }

      // Clear cache to refresh data
      await this.clearCache();
    } catch (error) {
      console.error('Error revoking all sessions:', error);
      throw error;
    }
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
   * Get security health status (quick check)
   */
  async getSecurityHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
  }> {
    const cacheKey = 'security-health-status';
    
    const cached = await this.getFromCache<{
      status: 'healthy' | 'warning' | 'critical';
      score: number;
      issues: string[];
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/api/security/health');
      
      if (!response.ok) {
        throw new Error('Failed to fetch security health status');
      }

      const healthStatus = await response.json();
      
      await this.setCache(cacheKey, healthStatus);
      return healthStatus;
    } catch (error) {
      console.error('Error fetching security health status:', error);
      return {
        status: 'warning',
        score: 75,
        issues: ['Unable to fetch complete security status']
      };
    }
  }
}

// Export singleton instance
export const securityDashboardSingleton = SecurityDashboardSingleton.getInstance();

export default SecurityDashboardSingleton;
