import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'OWNER' | 'TENANT_ADMIN' | 'USER';
  isActive: boolean;
  is_active: boolean; // Alias for compatibility
  emailVerified: boolean;
  email_verified: boolean; // Alias for compatibility
  createdAt: string;
  created_at: string; // Alias for compatibility
  updatedAt: string;
  lastLogin?: string;
  last_login?: string; // Alias for compatibility
  tenants?: AdminUserTenant[];
}

export interface AdminUserTenant {
  id: string;
  name: string;
  role: string;
}

/**
 * Service for managing admin users
 * Handles administrative user operations across the platform
 */
export class AdminUserService extends AdminApiSingleton {
  private static instance: AdminUserService;

  private constructor() {
    super('AdminUserService');
  }

  static getInstance(): AdminUserService {
    if (!AdminUserService.instance) {
      AdminUserService.instance = new AdminUserService();
    }
    return AdminUserService.instance;
  }

  /**
   * Get all admin users
   */
  async getAdminUsers(): Promise<AdminUser[] | null> {
    const result = await this.makeDefaultRequest<{ users: AdminUser[] }>(
      '/api/admin/users',
      {},
      'platform-admin-users',
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminUserService] Failed to get admin users:', result.error);
      return null;
    }

    return result.data?.users || null;
  }

  /**
   * Delete an admin user
   */
  async deleteAdminUser(userId: string): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/admin/users/${userId}`,
      { method: 'DELETE' },
      `platform-delete-admin-user-${userId}`
    );

    if (!result.success) {
      console.error('[AdminUserService] Failed to delete admin user:', result.error);
      throw result.error;
    }

    // Invalidate admin users cache
    await this.invalidateCache('platform-admin-users*');
  }

  /**
   * Create a new admin user
   */
  async createAdminUser(userData: {
    email: string;
    name: string;
    role: string;
    permissions?: string[];
  }): Promise<AdminUser | null> {
    const result = await this.makeDefaultRequest<AdminUser>(
      '/api/admin/users',
      { 
        method: 'POST',
        body: JSON.stringify(userData)
      },
      'platform-create-admin-user'
    );

    if (!result.success) {
      console.error('[AdminUserService] Failed to create admin user:', result.error);
      throw result.error;
    }

    // Invalidate admin users cache
    await this.invalidateCache('platform-admin-users*');

    return result.data || null;
  }

  /**
   * Update admin user permissions
   */
  async updateAdminUserPermissions(userId: string, permissions: string[]): Promise<AdminUser | null> {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const result = await this.makeDefaultRequest<AdminUser>(
      `/api/admin/users/${userId}/permissions`,
      { 
        method: 'PATCH',
        body: JSON.stringify({ permissions })
      },
      `platform-admin-user-permissions-${userId}`
    );

    if (!result.success) {
      console.error('[AdminUserService] Failed to update admin user permissions:', result.error);
      throw result.error;
    }

    // Invalidate admin users cache
    await this.invalidateCache('platform-admin-users*');

    return result.data || null;
  }

  /**
   * Remove user from tenant
   */
  async removeUserFromTenant(userId: string, tenantId: string): Promise<void> {
    if (!userId || !tenantId) {
      throw new Error('User ID and Tenant ID are required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/admin/users/${userId}/tenants/${tenantId}`,
      { method: 'DELETE' },
      `remove-user-${userId}-from-${tenantId}`
    );

    if (!result.success) {
      console.error('[AdminUserService] Failed to remove user from tenant:', result.error);
      throw result.error;
    }

    console.log(`[AdminUserService] Removed user ${userId} from tenant ${tenantId}`);
  }

  /**
   * Add user to tenant
   */
  async addUserToTenant(userId: string, tenantId: string, role?: string): Promise<void> {
    if (!userId || !tenantId) {
      throw new Error('User ID and Tenant ID are required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/admin/users/${userId}/tenants`,
      { 
        method: 'POST',
        body: JSON.stringify({ tenantId, role })
      },
      `add-user-${userId}-to-${tenantId}`
    );

    if (!result.success) {
      console.error('[AdminUserService] Failed to add user to tenant:', result.error);
      throw result.error;
    }

    console.log(`[AdminUserService] Added user ${userId} to tenant ${tenantId}`);
  }
}

// Export singleton instance
export const adminUserService = AdminUserService.getInstance();
