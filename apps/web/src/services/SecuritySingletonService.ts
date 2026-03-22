/**
 * Security Singleton Service
 * 
 * Extends AdminApiSingleton to provide cached admin security operations
 * Uses the platform's singleton architecture for admin authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';
import { LoginSession, SecurityAlert, ApiResponse, MFAStatus, MFASetupData, MFAVerificationResult, MFASetupFormData } from '@/types/security';

class SecuritySingletonService extends AuthenticatedApiSingleton {
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

      if (!result.success) {
        console.error('[SecuritySingletonService] Failed to get active sessions:', result.error);
        return [];
      }

      return result.data?.sessions || result.data || [];
    } catch (error) {
      console.error('[SecuritySingletonService] Error fetching active sessions:', error);
      return [];
    }
  }

  /**
   * Get current session info (compatible with AuthContext)
   * Calls /api/auth/me to get user profile data
   */
  async getSessionInfo(bypassCache = false): Promise<{ isAuthenticated: boolean; user?: any; token?: any; expiresAt?: string; lastActivity?: string }> {
    try {
      const cacheOptions = bypassCache ? { ttl: 0, forceRefresh: true } : {};
      const result = await this.makeDefaultRequest<any>(
        '/api/auth/me',
        {},
        bypassCache ? undefined : 'security-session-info',
        bypassCache ? 0 : undefined
      );

      if (!result.success || !result.data?.user) {
        return { isAuthenticated: false };
      }

      const userData = result.data.user;
      
      return {
        isAuthenticated: true,
        user: {
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name || userData.firstName,
          lastName: userData.last_name || userData.lastName,
          businessName: userData.business_name || userData.businessName,
          businessType: userData.business_type || userData.businessType,
          phone: userData.phone,
          emailVerified: userData.email_verified ?? userData.emailVerified ?? true,
          role: userData.role,
          tenants: userData.user_tenants?.map((ut: any) => ({
            id: ut.tenant_id || ut.tenantId,
            name: ut.tenants?.name || ut.tenant?.name || 'Unknown',
            role: ut.role
          })) || userData.tenants || [],
          picture: userData.picture,
          auth0Id: userData.auth0_id || userData.auth0Id,
          onboardingCompleted: userData.onboarding_completed ?? userData.onboardingCompleted,
          tenant: userData.tenant
        }
      };
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting session info:', error);
      return { isAuthenticated: false };
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/auth/sessions/${sessionId}`,
        {
          method: 'DELETE',
        },
        'security-revoke-session'
      );
    } catch (error) {
      console.error('[SecuritySingletonService] Error revoking session:', error);
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
        {
          method: 'POST',
        },
        'security-revoke-all-sessions'
      );
    } catch (error) {
      console.error('[SecuritySingletonService] Error revoking all sessions:', error);
      throw error;
    }
  }

  /**
   * Get MFA status for the current user
   */
  async getMFAStatus(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/security/mfa/status',
        {},
        'security-mfa-status'
      );
      
      if (!result.success) {
        return { enabled: false };
      }
      
      return result.data || { enabled: false };
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting MFA status:', error);
      return { enabled: false };
    }
  }

  /**
   * Setup MFA - generates secret and QR code
   */
  async setupMFA(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/security/mfa/setup',
        {
          method: 'POST',
        },
        'security-mfa-setup'
      );
      
      if (!result.success) {
        const errorMessage = typeof result.error === 'string' ? result.error : 
                            result.error?.message || 'Failed to setup MFA';
        console.log(errorMessage);
        throw new Error(errorMessage);
      }
      
      return result.data;
    } catch (error) {
      console.error('[SecuritySingletonService] Error setting up MFA:', error);
      throw error;
    }
  }

  /**
   * Verify MFA setup with verification code
   */
  async verifyMFASetup(data: any): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest<boolean>(
        '/api/security/mfa/verify-setup',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
        'security-mfa-verify-setup'
      );
      
      return result.success && result.data;
    } catch (error) {
      console.error('[SecuritySingletonService] Error verifying MFA setup:', error);
      return false;
    }
  }

  /**
   * Verify MFA token during login
   */
  async verifyMFALogin(token: string, userId: string): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/security/mfa/verify-login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, userId }),
        },
        'security-mfa-verify-login'
      );
      
      if (!result.success) {
        const errorMessage = typeof result.error === 'string' ? result.error : 
                            result.error?.message || 'Failed to verify MFA login';
        throw new Error(errorMessage);
      }
      
      return result.data;
    } catch (error) {
      console.error('[SecuritySingletonService] Error verifying MFA login:', error);
      throw error;
    }
  }

  /**
   * Disable MFA for the current user
   */
  async disableMFA(): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/security/mfa/disable',
        {
          method: 'POST',
        },
        'security-mfa-disable'
      );
    } catch (error) {
      console.error('[SecuritySingletonService] Error disabling MFA:', error);
      throw error;
    }
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(verificationCode: string): Promise<string[]> {
    try {
      const result = await this.makeDefaultRequest<string[]>(
        '/api/security/mfa/regenerate-backup-codes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ verificationCode }),
        },
        'security-mfa-regenerate-backup-codes'
      );
      
      if (!result.success) {
        const errorMessage = typeof result.error === 'string' ? result.error : 
                            result.error?.message || 'Failed to regenerate backup codes';
        throw new Error(errorMessage);
      }
      
      return result.data || [];
    } catch (error) {
      console.error('[SecuritySingletonService] Error regenerating backup codes:', error);
      throw error;
    }
  }

  /**
   * Get security alerts for the current user
   */
  async getSecurityAlerts(): Promise<any[]> {
    try {
      const result = await this.makeDefaultRequest<any[]>(
        '/api/security/alerts',
        {},
        'security-alerts'
      );
      
      if (!result.success) {
        return [];
      }
      
      return result.data || [];
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting security alerts:', error);
      return [];
    }
  }

  /**
   * Mark a security alert as read
   */
  async markAlertAsRead(alertId: string): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/security/alerts/${alertId}/read`,
        {
          method: 'POST',
        },
        'security-mark-alert-read'
      );
    } catch (error) {
      console.error('[SecuritySingletonService] Error marking alert as read:', error);
      throw error;
    }
  }

  /**
   * Dismiss a security alert
   */
  async dismissAlert(alertId: string): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/security/alerts/${alertId}/dismiss`,
        {
          method: 'POST',
        },
        'security-dismiss-alert'
      );
    } catch (error) {
      console.error('[SecuritySingletonService] Error dismissing alert:', error);
      throw error;
    }
  }

  /**
   * Get security alert preferences
   */
  async getAlertPreferences(): Promise<Record<string, boolean>> {
    try {
      const result = await this.makeDefaultRequest<Record<string, boolean>>(
        '/api/security/alerts/preferences',
        {},
        'security-alert-preferences'
      );
      
      if (!result.success) {
        return {};
      }
      
      return result.data || {};
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting alert preferences:', error);
      return {};
    }
  }

  /**
   * Update security alert preferences
   */
  async updateAlertPreferences(preferences: Record<string, boolean>): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/security/alerts/preferences',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(preferences),
        },
        'security-update-alert-preferences'
      );
    } catch (error) {
      console.error('[SecuritySingletonService] Error updating alert preferences:', error);
      throw error;
    }
  }

  /**
   * Get admin stability insights
   */
  async getAdminStabilityInsights(timeframe: string): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/security/admin/stability-insights?timeframe=${timeframe}`,
        {},
        'security-admin-stability-insights'
      );
      
      if (!result.success) {
        return {
          summary: {
            totalIncidents: 0,
            criticalIncidents: 0,
            warningIncidents: 0,
            infoIncidents: 0
          },
          patterns: {
            topEndpoints: [],
            topIPs: [],
            userBehaviorPatterns: {
              authenticatedVsAnonymous: { authenticated: 0, anonymous: 0 },
              userMaturity: { newUsers: 0, establishedUsers: 0 },
              userTypes: { powerUsers: 0, regularUsers: 0 }
            },
            geographicPatterns: {
              topCountries: [],
              internationalDistribution: false
            },
            temporalPatterns: {
              hourlyDistribution: {},
              peakActivityHour: 0
            }
          }
        };
      }
      
      return result.data;
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting admin stability insights:', error);
      return {
        summary: {
          totalIncidents: 0,
          criticalIncidents: 0,
          warningIncidents: 0,
          infoIncidents: 0
        },
        patterns: {
          topEndpoints: [],
          topIPs: [],
          userBehaviorPatterns: {
            authenticatedVsAnonymous: { authenticated: 0, anonymous: 0 },
            userMaturity: { newUsers: 0, establishedUsers: 0 },
            userTypes: { powerUsers: 0, regularUsers: 0 }
          },
          geographicPatterns: {
            topCountries: [],
            internationalDistribution: false
          },
          temporalPatterns: {
            hourlyDistribution: {},
            peakActivityHour: 0
          }
        }
      };
    }
  }

  /**
   * Get admin tenants
   */
  async getAdminTenants(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/security/admin/tenants',
        {},
        'security-admin-tenants'
      );
      
      if (!result.success) {
        return [];
      }
      
      return result.data || [];
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting admin tenants:', error);
      return [];
    }
  }

  /**
   * Get admin sync stats
   */
  async getAdminSyncStats(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/security/admin/sync-stats',
        {},
        'security-admin-sync-stats'
      );
      
      if (!result.success) {
        return { total: 0, successful: 0, failed: 0 };
      }
      
      return result.data || { total: 0, successful: 0, failed: 0 };
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting admin sync stats:', error);
      return { total: 0, successful: 0, failed: 0 };
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
        `/api/security/admin/sessions?${queryParams}`,
        {},
        'security-admin-sessions'
      );
      
      if (!result.success) {
        return { sessions: [], total: 0 };
      }
      console.log('[SecuritySingletonService] Admin security sessions result:', JSON.stringify(result.data, null, 2));
      
      return result.data || { sessions: [], total: 0 };
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting admin security sessions:', error);
      return { sessions: [], total: 0 };
    }
  }

  /**
   * Get admin security sessions stats
   */
  async getAdminSecuritySessionsStats(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/security/admin/sessions/stats',
        {},
        'security-admin-sessions-stats'
      );
      
      if (!result.success) {
        return { total: 0, active: 0, expired: 0 };
      }
      
      return result.data || { total: 0, active: 0, expired: 0 };
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting admin security sessions stats:', error);
      return { total: 0, active: 0, expired: 0 };
    }
  }

  /**
   * Get admin security alerts
   */
  async getAdminSecurityAlerts(): Promise<any[]> {
    try {
      const result = await this.makeDefaultRequest<any[]>(
        '/api/security/admin/alerts',
        {},
        'security-admin-alerts'
      );
      
      if (!result.success) {
        return [];
      }
      
      return result.data || [];
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting admin security alerts:', error);
      return [];
    }
  }

  /**
   * Get admin security alerts stats
   */
  async getAdminSecurityAlertsStats(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/security/admin/alerts/stats',
        {},
        'security-admin-alerts-stats'
      );
      
      if (!result.success) {
        return { total: 0, critical: 0, warning: 0, info: 0 };
      }
      
      return result.data || { total: 0, critical: 0, warning: 0, info: 0 };
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting admin security alerts stats:', error);
      return { total: 0, critical: 0, warning: 0, info: 0 };
    }
  }

  /**
   * Get admin failed logins
   */
  async getAdminFailedLogins(): Promise<any[]> {
    try {
      const result = await this.makeDefaultRequest<any[]>(
        '/api/security/admin/failed-logins',
        {},
        'security-admin-failed-logins'
      );
      
      if (!result.success) {
        return [];
      }
      
      return result.data || [];
    } catch (error) {
      console.error('[SecuritySingletonService] Error getting admin failed logins:', error);
      return [];
    }
  }

  /**
   * PILOT: Declare cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'security-active-sessions',
      'security-session-info',
      'security-revoke-session',
      'security-revoke-all-sessions',
      'security-mfa-status',
      'security-mfa-setup',
      'security-mfa-verify-setup',
      'security-mfa-verify-login',
      'security-mfa-disable',
      'security-mfa-regenerate-backup-codes',
      'security-alerts',
      'security-mark-alert-read',
      'security-dismiss-alert',
      'security-alert-preferences',
      'security-update-alert-preferences',
      'security-admin-stability-insights',
      'security-admin-tenants',
      'security-admin-sync-stats',
      'security-admin-sessions',
      'security-admin-sessions-stats',
      'security-admin-alerts',
      'security-admin-alerts-stats',
      'security-admin-failed-logins'
    ];
  }

  /**
   * PILOT: Implement cache invalidation contract
   */
  public async invalidateServiceCaches(userId?: string, ...params: any[]): Promise<void> {
    if (userId) {
      await this.invalidateCache(`security-active-sessions-${userId}`);
      await this.invalidateCache(`security-session-info-${userId}`);
    } else {
      await this.invalidateCache('security-active-sessions');
      await this.invalidateCache('security-session-info');
      await this.invalidateCache('security-revoke-session');
      await this.invalidateCache('security-revoke-all-sessions');
      await this.invalidateCache('security-mfa-status');
      await this.invalidateCache('security-mfa-setup');
      await this.invalidateCache('security-mfa-verify-setup');
      await this.invalidateCache('security-mfa-verify-login');
      await this.invalidateCache('security-mfa-disable');
      await this.invalidateCache('security-mfa-regenerate-backup-codes');
      await this.invalidateCache('security-alerts');
      await this.invalidateCache('security-mark-alert-read');
      await this.invalidateCache('security-dismiss-alert');
      await this.invalidateCache('security-alert-preferences');
      await this.invalidateCache('security-update-alert-preferences');
      await this.invalidateCache('security-admin-stability-insights');
      await this.invalidateCache('security-admin-tenants');
      await this.invalidateCache('security-admin-sync-stats');
      await this.invalidateCache('security-admin-sessions');
      await this.invalidateCache('security-admin-sessions-stats');
      await this.invalidateCache('security-admin-alerts');
      await this.invalidateCache('security-admin-alerts-stats');
      await this.invalidateCache('security-admin-failed-logins');
    }
  }
}

// Export singleton instance
export const securitySingletonService = SecuritySingletonService.getInstance();
