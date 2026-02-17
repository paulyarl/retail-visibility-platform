import { AuthenticatedApiSingleton } from '../providers/base/UniversalSingleton';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service for managing tenant users
 * Handles user operations within a specific tenant context
 */
export class TenantUserService extends AuthenticatedApiSingleton {
  private static instance: TenantUserService;

  private constructor() {
    super('TenantUserService');
  }

  static getInstance(): TenantUserService {
    if (!TenantUserService.instance) {
      TenantUserService.instance = new TenantUserService();
    }
    return TenantUserService.instance;
  }

  /**
   * Get all users for a specific tenant
   */
  async getTenantUsers(tenantId: string): Promise<User[] | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<{ users: User[] }>(
      `/api/tenants/${tenantId}/users`,
      {},
      `platform-tenant-users-${tenantId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[TenantUserService] Failed to get tenant users:', result.error);
      return null;
    }

    return result.data?.users || null;
  }

  /**
   * Add a new user to the tenant
   */
  async addTenantUser(tenantId: string, userData: {
    email: string;
    role: string;
    name?: string;
  }): Promise<User | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeAuthenticatedRequest<User>(
      `/api/tenants/${tenantId}/users`,
      { 
        method: 'POST',
        body: JSON.stringify(userData)
      },
      `platform-tenant-users-${tenantId}`
    );

    if (!result.success) {
      console.error('[TenantUserService] Failed to add tenant user:', result.error);
      throw result.error;
    }

    // Invalidate tenant users cache
    await this.invalidateCache(`platform-tenant-users-${tenantId}*`);

    return result.data || null;
  }

  /**
   * Update a user's role within the tenant
   */
  async updateTenantUserRole(tenantId: string, userId: string, role: string): Promise<User | null> {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    const result = await this.makeAuthenticatedRequest<User>(
      `/api/tenants/${tenantId}/users/${userId}`,
      { 
        method: 'PATCH',
        body: JSON.stringify({ role })
      },
      `platform-tenant-user-${userId}`
    );

    if (!result.success) {
      console.error('[TenantUserService] Failed to update tenant user role:', result.error);
      throw result.error;
    }

    // Invalidate tenant users cache
    await this.invalidateCache(`platform-tenant-users-${tenantId}*`);

    return result.data || null;
  }

  /**
   * Remove a user from the tenant
   */
  async removeTenantUser(tenantId: string, userId: string): Promise<void> {
    if (!tenantId || !userId) {
      throw new Error('Tenant ID and User ID are required');
    }

    const result = await this.makeAuthenticatedRequest<void>(
      `/api/tenants/${tenantId}/users/${userId}`,
      { method: 'DELETE' },
      `platform-remove-tenant-user-${userId}`
    );

    if (!result.success) {
      console.error('[TenantUserService] Failed to remove tenant user:', result.error);
      throw result.error;
    }

    // Invalidate tenant users cache
    await this.invalidateCache(`platform-tenant-users-${tenantId}*`);
  }
}

// Export singleton instance
export const tenantUserService = TenantUserService.getInstance();
