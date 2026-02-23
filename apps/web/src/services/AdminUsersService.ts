/**
 * Admin Users Service - Admin API Pattern
 * 
 * Manages admin user operations for platform administration
 * Extends AdminApiSingleton for admin privilege validation and caching
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

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
  tenantId?: string;
  tenantName?: string;
  joinedAt?: string;
}

export interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  tenantIds?: string[];
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  tenantIds?: string[];
  message?: string;
  isActive?: boolean;
  emailVerified?: boolean;
}

export interface InvitationRequest {
  email: string;
  role?: string;
  tenantIds?: string[];
  message?: string;
}

/**
 * Admin Users Service - Authenticated API Pattern
 * 
 * Manages admin user operations for platform administration
 * Uses AuthenticatedApiSingleton for admin privilege validation and caching
 */
class AdminUsersService extends AdminApiSingleton {
  private static instance: AdminUsersService;

  // TTL constants for different data types
  private readonly USERS_TTL = 10 * 60 * 1000; // 10 minutes for users list
  private readonly USER_DETAILS_TTL = 5 * 60 * 1000; // 5 minutes for user details

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 10 * 60 * 1000, // 10 minutes cache
      ...cacheOptions
    });
  }

  static getInstance(): AdminUsersService {
    if (!AdminUsersService.instance) {
      AdminUsersService.instance = new AdminUsersService('admin-users-service');
    }
    return AdminUsersService.instance;
  }

  /**
   * Get all admin users
   */
  async getUsers(): Promise<AdminUser[]> {
    // Use default request type (ADMIN) for primary operation
    const response = await this.makeDefaultRequest<any>(
      '/api/admin/users',
      {},
      'admin-users-list',
      this.USERS_TTL
    );

    if (!response.success) {
      console.error('[AdminUsersService] Failed to get users:', response.error);
      return [];
    }

    // Extract users array from API response
    const usersArray = response.data?.users || response.data?.user_tenants || [];
    
    // Transform API response to match both property formats
    return (usersArray || []).map((user: any) => {
      const firstName = user.firstName || user.first_name;
      const lastName = user.lastName || user.last_name;
      const name = firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || 'Unnamed User';
      
      return {
        id: user.id,
        email: user.email,
        name,
        firstName,
        lastName,
        role: user.role,
        isActive: user.isActive || user.is_active,
        is_active: user.isActive || user.is_active,
        emailVerified: user.emailVerified || user.email_verified,
        email_verified: user.emailVerified || user.email_verified,
        createdAt: user.createdAt || user.created_at,
        created_at: user.createdAt || user.created_at,
        updatedAt: user.updatedAt || user.updated_at,
        lastLogin: user.lastLogin || user.last_login,
        last_login: user.lastLogin || user.last_login,
        tenants: user.tenants
      };
    });
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<AdminUser | null> {
    const response = await this.makeDefaultRequest<AdminUser>(
      `/api/admin/users/${userId}`,
      {},
      `admin-user-${userId}`,
      this.USER_DETAILS_TTL
    );

    if (!response.success) {
      console.error('[AdminUsersService] Failed to get user:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Create a new admin user
   */
  async createUser(userData: CreateUserRequest): Promise<AdminUser | null> {
    const response = await this.makeDefaultRequest<AdminUser>(
      '/api/admin/users/create',
      {
        method: 'POST',
        body: JSON.stringify(userData)
      },
      'admin-create-user',
      0 // No caching for write operations
    );

    if (!response.success) {
      console.error('[AdminUsersService] Failed to create user:', response.error);
      return null;
    }

    // Invalidate users list cache
    await this.invalidateCache('admin-users-list');
    
    return response.data || null;
  }

  /**
   * Update an admin user
   */
  async updateUser(userId: string, userData: UpdateUserRequest): Promise<AdminUser | null> {
    const response = await this.makeDefaultRequest<AdminUser>(
      `/api/admin/users/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify(userData)
      },
      `admin-update-user-${userId}`,
      0 // No caching for write operations
    );

    if (!response.success) {
      console.error('[AdminUsersService] Failed to update user:', response.error);
      return null;
    }

    // Invalidate relevant caches
    await this.invalidateCache('admin-users-list');
    await this.invalidateCache(`admin-user-${userId}`);
    
    return response.data || null;
  }

  /**
   * Delete an admin user
   */
  async deleteUser(userId: string): Promise<boolean> {
    const response = await this.makeDefaultRequest<void>(
      `/api/admin/users/${userId}`,
      { method: 'DELETE' },
      `admin-delete-user-${userId}`,
      0 // No caching for write operations
    );

    if (!response.success) {
      console.error('[AdminUsersService] Failed to delete user:', response.error);
      return false;
    }

    // Invalidate relevant caches
    await this.invalidateCache('admin-users-list');
    await this.invalidateCache(`admin-user-${userId}`);
    
    return true;
  }

  /**
   * Send invitation to a user
   */
  async sendInvitation(invitationData: InvitationRequest): Promise<boolean> {
    const response = await this.makeDefaultRequest<void>(
      '/api/admin/users/invite-by-email',
      {
        method: 'POST',
        body: JSON.stringify(invitationData)
      },
      'admin-send-invitation',
      0 // No caching for write operations
    );

    if (!response.success) {
      console.error('[AdminUsersService] Failed to send invitation:', response.error);
      return false;
    }

    return true;
  }

  /**
   * Reset user password
   */
  async resetPassword(userId: string): Promise<boolean> {
    const response = await this.makeDefaultRequest<void>(
      `/api/admin/users/${userId}/reset-password`,
      { method: 'POST' },
      `admin-reset-password-${userId}`,
      0 // No caching for write operations
    );

    if (!response.success) {
      console.error('[AdminUsersService] Failed to reset password:', response.error);
      return false;
    }

    return true;
  }

  /**
   * Get all users with their tenant information
   */
  async getUsersWithTenants(): Promise<AdminUser[]> {
    try {
      const users = await this.getUsers();
      
      // Fetch tenant data for each user in parallel
      const usersWithTenants = await Promise.all(
        users.map(async (user: AdminUser) => {
          try {
            const tenantsResponse = await this.makeDefaultRequest<{
              tenant?: any[];
              tenants?: any[];
            }>(
              `/api/admin/users/${user.id}/tenants`,
              {},
              `user-tenants-${user.id}`,
              this.USER_DETAILS_TTL
            );

            const tenantsArray = tenantsResponse.data?.tenant || tenantsResponse.data?.tenants || [];
            
            // Transform tenant data to match local interface
            const transformedTenants = tenantsArray.map((t: any) => ({
              id: t.tenant_id || t.id,
              name: t.tenantName || t.name,
              role: t.role
            }));
            
            return {
              ...user,
              tenants: transformedTenants
            };
          } catch (error) {
            console.error(`[AdminUsersService] Failed to get tenants for user ${user.id}:`, error);
            return user;
          }
        })
      );

      return usersWithTenants;
    } catch (error) {
      console.error('[AdminUsersService] Failed to get users with tenants:', error);
      return [];
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    verifiedUsers: number;
    unverifiedUsers: number;
  }> {
    try {
      const response = await this.makeDefaultRequest<{
        totalUsers: number;
        activeUsers: number;
        inactiveUsers: number;
        verifiedUsers: number;
        unverifiedUsers: number;
      }>(
        '/api/admin/users/stats',
        {},
        'admin-user-stats',
        this.USERS_TTL
      );

      return response.data || {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        verifiedUsers: 0,
        unverifiedUsers: 0
      };
    } catch (error) {
      console.error('[AdminUsersService] Failed to get user stats:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        verifiedUsers: 0,
        unverifiedUsers: 0
      };
    }
  }

  /**
   * Create a test tenant
   */
  async createTestTenant(data: {
    name: string;
    city?: string;
    state?: string;
    seedProducts?: boolean;
    scenario?: string;
    createAsDrafts?: boolean;
    generateImages?: boolean;
  }): Promise<any> {
    try {
      const response = await this.makeDefaultRequest<any>(
        '/api/admin/tools/tenants',
        {
          method: 'POST',
          body: JSON.stringify(data)
        },
        'create-test-tenant',
        0 // No caching for write operations
      );

      return response;
    } catch (error) {
      console.error('[AdminUsersService] Failed to create test tenant:', error);
      throw error;
    }
  }

  /**
   * Create a test chain
   */
  async createTestChain(data: {
    name: string;
    size: 'small' | 'medium' | 'large';
    scenario?: string;
    seedProducts?: boolean;
    createAsDrafts?: boolean;
    generateImages?: boolean;
  }): Promise<any> {
    try {
      const response = await this.makeDefaultRequest<any>(
        '/api/admin/tools/test-chains',
        {
          method: 'POST',
          body: JSON.stringify(data)
        },
        'create-test-chain',
        0 // No caching for write operations
      );

      return response;
    } catch (error) {
      console.error('[AdminUsersService] Failed to create test chain:', error);
      throw error;
    }
  }

  /**
   * Delete a test chain
   */
  async deleteTestChain(organizationId: string): Promise<any> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/admin/tools/test-chains/${organizationId}?confirm=true`,
        { method: 'DELETE' },
        'delete-test-chain',
        0 // No caching for write operations
      );

      return response;
    } catch (error) {
      console.error('[AdminUsersService] Failed to delete test chain:', error);
      throw error;
    }
  }

  /**
   * Delete a test tenant
   */
  async deleteTestTenant(tenantId: string): Promise<any> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/admin/tools/tenants/${tenantId}?confirm=true`,
        { method: 'DELETE' },
        'delete-test-tenant',
        0 // No caching for write operations
      );

      return response;
    } catch (error) {
      console.error('[AdminUsersService] Failed to delete test tenant:', error);
      throw error;
    }
  }

  /**
   * Get user tenants
   */
  async getUserTenants(userId: string): Promise<any[]> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/admin/users/${userId}/tenants`,
        {},
        `user-tenants-${userId}`,
        this.USER_DETAILS_TTL
      );

      // Extract tenants array from API response
      const tenantsArray = response.data?.tenants || response.data?.tenant || [];
      
      return tenantsArray || [];
    } catch (error) {
      console.error('[AdminUsersService] Failed to get user tenants:', error);
      return [];
    }
  }

  /**
   * Get all available tenants for admin management
   */
  async getAllTenants(): Promise<any[]> {
    try {
      const response = await this.makeDefaultRequest<any>(
        '/api/admin/tenants/all',
        {},
        'admin-all-tenants',
        this.USERS_TTL
      );

      // Extract tenants array from API response
      const tenantsArray = response.data?.tenants || [];
      
      return tenantsArray || [];
    } catch (error) {
      console.error('[AdminUsersService] Failed to get all tenants:', error);
      return [];
    }
  }

  /**
   * Assign tenant to user
   */
  async assignTenantToUser(userId: string, tenantId: string, role: string): Promise<any> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/admin/users/${userId}/tenants`,
        {
          method: 'POST',
          body: JSON.stringify({ tenantId, role })
        },
        'assign-tenant-to-user',
        0 // No caching for write operations
      );

      // Invalidate user tenants cache
      await this.invalidateCache(`user-tenants-${userId}`);
      
      return response;
    } catch (error) {
      console.error('[AdminUsersService] Failed to assign tenant to user:', error);
      throw error;
    }
  }

  /**
   * Remove tenant from user
   */
  async removeTenantFromUser(userId: string, tenantId: string): Promise<any> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/admin/users/${userId}/tenants/${tenantId}`,
        { method: 'DELETE' },
        'remove-tenant-from-user',
        0 // No caching for write operations
      );

      // Invalidate user tenants cache
      await this.invalidateCache(`user-tenants-${userId}`);
      
      return response;
    } catch (error) {
      console.error('[AdminUsersService] Failed to remove tenant from user:', error);
      throw error;
    }
  }

  /**
   * Update user tenant role
   */
  async updateUserTenantRole(userId: string, tenantId: string, newRole: string): Promise<any> {
    try {
      // First remove existing assignment
      await this.removeTenantFromUser(userId, tenantId);
      
      // Then add with new role
      return await this.assignTenantToUser(userId, tenantId, newRole);
    } catch (error) {
      console.error('[AdminUsersService] Failed to update user tenant role:', error);
      throw error;
    }
  }

  /**
   * Update user status (activate/deactivate)
   */
  async updateUserStatus(userId: string, isActive: boolean, emailVerified?: boolean): Promise<any> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/admin/users/${userId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            isActive,
            ...(emailVerified !== undefined && { emailVerified })
          })
        },
        `update-user-status-${userId}`,
        0 // No caching for write operations
      );

      // Invalidate user cache
      await this.invalidateCache(`admin-user-${userId}`);
      
      return response;
    } catch (error) {
      console.error('[AdminUsersService] Failed to update user status:', error);
      throw error;
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(userId: string): Promise<any> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/admin/users/${userId}/send-verification`,
        { method: 'POST' },
        'send-verification-email',
        0 // No caching for write operations
      );

      return response;
    } catch (error) {
      console.error('[AdminUsersService] Failed to send verification email:', error);
      throw error;
    }
  }

  /**
   * Mark user as verified/unverified
   */
  async updateUserVerificationStatus(userId: string, emailVerified: boolean): Promise<any> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/admin/users/${userId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ emailVerified })
        },
        `update-user-verification-${userId}`,
        0 // No caching for write operations
      );

      // Invalidate user cache
      await this.invalidateCache(`admin-user-${userId}`);
      
      return response;
    } catch (error) {
      console.error('[AdminUsersService] Failed to update user verification status:', error);
      throw error;
    }
  }

  /**
   * Invalidate all admin users cache
   */
  async invalidateUsersCache(): Promise<void> {
    await this.invalidateCache('admin-users-list');
  }

  /**
   * Invalidate specific user cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.invalidateCache(`admin-user-${userId}`);
    await this.invalidateCache(`admin-user-tenants-${userId}`);
  }
}

// Export singleton instance
export const adminUsersService = AdminUsersService.getInstance();
