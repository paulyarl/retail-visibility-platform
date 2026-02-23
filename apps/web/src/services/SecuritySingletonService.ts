/**
 * Security Singleton Service
 * 
 * Extends AdminApiSingleton to provide cached admin security operations
 * Uses the platform's singleton architecture for admin authentication and caching
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { LoginSession, SecurityAlert, ApiResponse, MFAStatus, MFASetupData, MFAVerificationResult, MFASetupFormData } from '@/types/security';

class SecuritySingletonService extends AdminApiSingleton {
  private static instance: SecuritySingletonService;

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 5 * 60 * 1000, // 5 minutes for security operations
      ...cacheOptions
    });
  }

  public static getInstance(): SecuritySingletonService {
    if (!SecuritySingletonService.instance) {
      SecuritySingletonService.instance = new SecuritySingletonService('security-singleton');
    }
    return SecuritySingletonService.instance;
  }

  /**
   * Get active user sessions with caching
   */
  async getActiveSessions(): Promise<LoginSession[]> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/auth/sessions',
        {},
        'security-active-sessions'
      );

    //  console.log('[SecuritySingletonService] Raw sessions API response:', result);

      // Extract sessions array from nested API response structure
      const sessionsArray = result?.data || result || [];
     // console.log('[SecuritySingletonService] Extracted sessions array:', sessionsArray);

      // Ensure we have an array before mapping
      if (!Array.isArray(sessionsArray)) {
        console.warn('[SecuritySingletonService] Sessions API response is not an array:', sessionsArray);
        return [];
      }

      // Map API response to match LoginSession interface
      const mappedSessions = sessionsArray.map((session: any): LoginSession => {
        // Parse deviceInfo JSON string to object
        let deviceInfoObj: any = {};
        try {
          deviceInfoObj = session.deviceInfo ? JSON.parse(session.deviceInfo) : {};
        } catch (e) {
          console.warn('[SecuritySingletonService] Failed to parse deviceInfo:', session.deviceInfo);
        }

        return {
          id: session.id,
          device: deviceInfoObj?.type || 'Unknown',
          deviceInfo: deviceInfoObj ? {
            type: deviceInfoObj?.type || 'Unknown',
            browser: deviceInfoObj?.browser || 'Unknown',
            os: deviceInfoObj?.os || 'Unknown',
            browserVersion: deviceInfoObj?.browserVersion,
            osVersion: deviceInfoObj?.osVersion,
            device: deviceInfoObj?.device,
          } : {
            type: 'Unknown',
            browser: 'Unknown',
            os: 'Unknown'
          },
          location: session.location ? 
            `${session.location.city}, ${session.location.region}` : 
            'Unknown',
          ipAddress: session.ipAddress || 'Unknown',
          lastActivity: session.lastActive || session.lastActivity || new Date().toISOString(),
          isCurrent: session.isCurrent || false,
          userAgent: session.userAgent || 'Unknown',
          createdAt: session.createdAt || new Date().toISOString(),
          expiresAt: session.expiresAt
        };
      });
      
      return mappedSessions;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get active sessions:', error);
      return [];
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/auth/sessions/${sessionId}`,
        { method: 'DELETE' },
        `security-revoke-session-${sessionId}`
      );

      // Invalidate active sessions cache
      await this.invalidateCache('security-active-sessions*');
    } catch (error) {
      console.error('[SecuritySingleton] Failed to revoke session:', error);
      throw error;
    }
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllSessions(): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/auth/sessions/revoke-all',
        { method: 'POST' },
        'security-revoke-all-sessions'
      );

      // Invalidate active sessions cache
      await this.invalidateCache('security-active-sessions*');
    } catch (error) {
      console.error('[SecuritySingleton] Failed to revoke all sessions:', error);
      throw error;
    }
  }

  /**
   * Get security alerts for the current user
   */
  async getSecurityAlerts(): Promise<SecurityAlert[]> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/security/security-alerts',
        {},
        'security-alerts'
      );

      console.log('[SecuritySingletonService] Raw API response:', result);

      // Extract alerts array from nested API response structure
      const alertsArray = result?.data || result || [];
      console.log('[SecuritySingletonService] Extracted alerts array:', alertsArray);

      // Ensure we have an array before mapping
      if (!Array.isArray(alertsArray)) {
        console.warn('[SecuritySingletonService] API response is not an array:', alertsArray);
        return [];
      }

      // Map API response to match SecurityAlert interface
      const mappedAlerts = alertsArray.map((alert: any): SecurityAlert => ({
        id: alert.id,
        type: alert.type || 'suspicious_activity',
        title: alert.title || 'Security Alert',
        message: alert.message || 'A security event occurred',
        createdAt: alert.createdAt || new Date().toISOString(),
        severity: alert.severity || 'warning',
        read: alert.isRead !== undefined ? alert.isRead : (alert.read !== undefined ? alert.read : false),
        readAt: alert.readAt,
        metadata: alert.metadata || alert.details || {},
        actions: alert.actions,
        timestamp: alert.timestamp
      }));

      return mappedAlerts;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get security alerts:', error);
      return [];
    }
  }

  /**
   * Mark a security alert as read
   */
  async markAlertAsRead(alertId: string): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/security/security-alerts/${alertId}/read`,
        { method: 'PUT' },
        `security-mark-alert-read-${alertId}`
      );

      // Invalidate security alerts cache
      await this.invalidateCache('security-alerts*');
    } catch (error) {
      console.error('[SecuritySingleton] Failed to mark alert as read:', error);
      throw error;
    }
  }

  /**
   * Dismiss a security alert
   */
  async dismissAlert(alertId: string): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/security/security-alerts/${alertId}`,
        { method: 'DELETE' },
        `security-dismiss-alert-${alertId}`
      );

      // Invalidate security alerts cache
      await this.invalidateCache('security-alerts*');
    } catch (error) {
      console.error('[SecuritySingleton] Failed to dismiss alert:', error);
      throw error;
    }
  }

  /**
   * Get security alert preferences
   */
  async getAlertPreferences(): Promise<Record<string, boolean>> {
    try {
      const result = await this.makeDefaultRequest<Record<string, boolean>>(
        '/api/security/security-alerts/preferences',
        {},
        'security-alert-preferences'
      );

      return result.data || {};
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get alert preferences:', error);
      return {};
    }
  }

  /**
   * Update security alert preferences
   */
  async updateAlertPreferences(preferences: any): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/security/security-alerts/preferences',
        { 
          method: 'PUT',
          body: JSON.stringify(preferences)
        },
        'security-update-alert-preferences'
      );

      // Invalidate alert preferences cache
      await this.invalidateCache('security-alert-preferences*');
    } catch (error) {
      console.error('[SecuritySingleton] Failed to update alert preferences:', error);
      throw error;
    }
  }

  /**
   * Get MFA status for the current user
   */
  async getMFAStatus(): Promise<MFAStatus> {
    try {
      const result = await this.makeDefaultRequest<ApiResponse<MFAStatus>>(
        '/api/auth/mfa/status',
        {},
        'security-mfa-status',
        this.cacheTTL
      );

      if (!result?.data?.data) {
        throw new Error('No MFA status data returned');
      }

      return result.data.data;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get MFA status:', error);
      throw error;
    }
  }

  /**
   * Setup MFA - generates secret and QR code
   */
  async setupMFA(): Promise<MFASetupData> {
    try {
      const result = await this.makeDefaultRequest<ApiResponse<MFASetupData>>(
        '/api/auth/mfa/setup',
        { method: 'POST' },
        'security-mfa-setup'
      );

      if (!result?.data?.data) {
        throw new Error('No MFA setup data returned');
      }

      return result.data.data;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to setup MFA:', error);
      throw error;
    }
  }

  /**
   * Verify MFA setup with verification code
   */
  async verifyMFASetup(data: MFASetupFormData): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest<ApiResponse<{ verified: boolean }>>(
        '/api/auth/mfa/verify',
        { 
          method: 'POST',
          body: JSON.stringify({ token: data.verificationCode })
        },
        'security-mfa-verify-setup'
      );

      return result.data?.data?.verified || false;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to verify MFA setup:', error);
      throw error;
    }
  }

  /**
   * Verify MFA token during login
   */
  async verifyMFALogin(token: string, userId: string): Promise<MFAVerificationResult> {
    try {
      const result = await this.makeDefaultRequest<ApiResponse<MFAVerificationResult>>(
        '/api/auth/mfa/verify-login',
        { 
          method: 'POST',
          body: JSON.stringify({ token, userId })
        },
        'security-mfa-verify-login'
      );

      if (!result?.data?.data) {
        throw new Error('No data returned from MFA login verification');
      }

      return result.data.data;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to verify MFA login:', error);
      throw error;
    }
  }

  /**
   * Disable MFA for the current user
   */
  async disableMFA(): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/auth/mfa/disable',
        { method: 'POST' },
        'security-mfa-disable'
      );
    } catch (error) {
      console.error('[SecuritySingleton] Failed to disable MFA:', error);
      throw error;
    }
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(verificationCode: string): Promise<string[]> {
    try {
      const result = await this.makeDefaultRequest<ApiResponse<{ backupCodes: string[] }>>(
        '/api/auth/mfa/regenerate-backup',
        { 
          method: 'POST',
          body: JSON.stringify({ token: verificationCode })
        },
        'security-mfa-regenerate-backup'
      );

      return result.data?.data?.backupCodes || [];
    } catch (error) {
      console.error('[SecuritySingleton] Failed to regenerate backup codes:', error);
      throw error;
    }
  }

  /**
   * Invalidate all security-related cache
   */
  public async invalidateSecurityCache(): Promise<void> {
    await this.invalidateCache('security-*');
  }

  /**
   * Get admin stability insights
   */
  async getAdminStabilityInsights(timeframe: string): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/admin/security/stability-insights?timeframe=${timeframe}`,
        {},
        `security-admin-stability-insights-${timeframe}`,
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get admin stability insights:', error);
      throw error;
    }
  }

  /**
   * Get all tenants for admin
   */
  async getAdminTenants(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/tenants',
        {},
        'security-admin-tenants',
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get admin tenants:', error);
      throw error;
    }
  }

  /**
   * Get admin sync stats
   */
  async getAdminSyncStats(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/admin/sync-stats',
        {},
        'security-admin-sync-stats',
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get admin sync stats:', error);
      throw error;
    }
  }

  /**
   * Get admin security sessions
   */
  async getAdminSecuritySessions(params?: { limit?: number; offset?: number }): Promise<any> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      if (params?.offset) queryParams.set('offset', params.offset.toString());

      const result = await this.makeDefaultRequest<any>(
        `/api/admin/security/sessions?${queryParams}`,
        {},
        'security-admin-sessions',
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get admin security sessions:', error);
      throw error;
    }
  }

  /**
   * Get admin security sessions stats
   */
  async getAdminSecuritySessionsStats(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/admin/security/sessions/stats',
        {},
        'security-admin-sessions-stats',
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get admin security sessions stats:', error);
      throw error;
    }
  }

  /**
   * Get admin security alerts
   */
  async getAdminSecurityAlerts(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/admin/security/alerts',
        {},
        'security-admin-alerts',
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get admin security alerts:', error);
      throw error;
    }
  }

  /**
   * Get admin security alerts stats
   */
  async getAdminSecurityAlertsStats(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/admin/security/alerts/stats',
        {},
        'security-admin-alerts-stats',
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get admin security alerts stats:', error);
      throw error;
    }
  }

  /**
   * Get admin failed logins
   */
  async getAdminFailedLogins(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/admin/security/failed-logins?limit=20',
        {},
        'security-admin-failed-logins',
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get admin failed logins:', error);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/admin/performance/metrics',
        {},
        'security-admin-performance-metrics',
        this.cacheTTL
      );

      return result;
    } catch (error) {
      console.error('[SecuritySingleton] Failed to get performance metrics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const securityService = SecuritySingletonService.getInstance();

// Export cache invalidation helper for external use
export const invalidateSecurityCache = async (): Promise<void> => {
  const service = SecuritySingletonService.getInstance();
  await service.invalidateSecurityCache();
};
