import { AuthenticatedApiSingleton } from '../providers/base/AuthenticatedApiSingleton';

export interface UserInfo {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    showEmail: boolean;
    showPhone: boolean;
  };
}

export interface OnboardingData {
  step: number;
  completed: boolean;
  data: Record<string, any>;
  lastUpdated: string;
}

/**
 * Service for managing user operations
 * Handles user info, preferences, and onboarding data
 */
export class UserManagementService extends AuthenticatedApiSingleton {
  private static instance: UserManagementService;

  protected constructor() {
    super('UserManagementService');
  }

  static getInstance(): UserManagementService {
    if (!UserManagementService.instance) {
      UserManagementService.instance = new UserManagementService();
    }
    return UserManagementService.instance;
  }

  /**
   * Get current user information
   */
  async getUser(): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      '/auth/me',
      {},
      'platform-user-info',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[UserManagementService] Failed to get user:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      '/api/user/preferences',
      {},
      'platform-user-preferences',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[UserManagementService] Failed to get user preferences:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(preferences: any): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      '/api/user/preferences',
      { 
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences)
      },
      'platform-update-preferences',
      this.cacheTTL / 2 // Shorter cache for updates
    );

    if (!result.success) {
      console.error('[UserManagementService] Failed to update user preferences:', result.error);
      throw result.error;
    }

    // Invalidate user preferences cache
    await this.invalidateCache('platform-user-preferences*');

    return result.data || null;
  }

  /**
   * Get tenant data for onboarding
   */
  async getOnboardingTenantData(tenantId: string): Promise<any> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    // Note: This method would need to import and use other services
    // For now, we'll make direct API calls to maintain independence
    const [tenant, profile] = await Promise.all([
      this.getTenantById(tenantId),
      this.getTenantProfile(tenantId),
    ]);

    // Merge data with priority: profile > tenant.metadata > tenant.name
    const mergedData = {
      ...tenant,
      ...tenant?.metadata,
      business_name: profile?.businessName || tenant?.name || '',
      phone: profile?.phone || tenant?.metadata?.phone || '',
      email: profile?.email || tenant?.metadata?.email || '',
      website: profile?.website || tenant?.metadata?.website || '',
      contact_person: profile?.contactPerson || tenant?.metadata?.contact_person || '',
      ...profile,
    };

    return mergedData;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(profileData: {
    name?: string;
    email?: string;
    avatar?: string;
    bio?: string;
  }): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      '/api/user/profile',
      { 
        method: 'PATCH',
        body: JSON.stringify(profileData)
      },
      'platform-update-profile',
      this.cacheTTL / 2
    );

    if (!result.success) {
      console.error('[UserManagementService] Failed to update user profile:', result.error);
      throw result.error;
    }

    // Invalidate user info cache
    await this.invalidateCache('platform-user-info*');

    return result.data || null;
  }

  /**
   * Change user password
   */
  async changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      '/api/auth/change-password',
      { 
        method: 'POST',
        body: JSON.stringify(passwordData)
      },
      'platform-change-password',
      0 // No cache for security operations
    );

    if (!result.success) {
      console.error('[UserManagementService] Failed to change password:', result.error);
      throw result.error;
    }
  }

  /**
   * Enable two-factor authentication
   */
  async enable2FA(): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      '/api/auth/2fa/enable',
      { method: 'POST' },
      'platform-enable-2fa',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[UserManagementService] Failed to enable 2FA:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Verify two-factor authentication
   */
  async verify2FA(token: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      '/api/auth/2fa/verify',
      { 
        method: 'POST',
        body: JSON.stringify({ token })
      },
      'platform-verify-2fa'
    );

    if (!result.success) {
      console.error('[UserManagementService] Failed to verify 2FA:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Disable two-factor authentication
   */
  async disable2FA(password: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      '/api/auth/2fa/disable',
      { 
        method: 'POST',
        body: JSON.stringify({ password })
      },
      'platform-disable-2fa'
    );

    if (!result.success) {
      console.error('[UserManagementService] Failed to disable 2FA:', result.error);
      throw result.error;
    }
  }

  /**
   * Get user activity log
   */
  async getUserActivity(limit: number = 50): Promise<any[]> {
    const result = await this.makeDefaultRequest<any[]>(
      `/api/user/activity?limit=${limit}`,
      {},
      'platform-user-activity',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[UserManagementService] Failed to get user activity:', result.error);
      return [];
    }

    return result.data || [];
  }

  /**
   * Delete user account
   */
  async deleteAccount(password: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      '/api/user/delete-account',
      { 
        method: 'DELETE',
        body: JSON.stringify({ password })
      },
      'platform-delete-account'
    );

    if (!result.success) {
      console.error('[UserManagementService] Failed to delete account:', result.error);
      throw result.error;
    }

    // Invalidate all user caches
    await this.invalidateCache('platform-user-*');
  }

  // Helper methods for onboarding data
  private async getTenantById(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}`,
      {},
      `platform-tenant-${tenantId}`,
      this.cacheTTL
    );

    return result.success ? result.data : null;
  }

  private async getTenantProfile(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenant/profile?tenant_id=${encodeURIComponent(tenantId)}`,
      {},
      `platform-tenant-profile-${tenantId}`,
      this.cacheTTL
    );

    return result.success ? result.data : null;
  }
}

// Export singleton instance
export const userManagementService = UserManagementService.getInstance();
