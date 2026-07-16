/**
 * Users Singleton - Producer Pattern
 * 
 * Produces and manages user data with AuthenticatedApiSingleton integration
 * Extends AuthenticatedApiSingleton for consistent caching and metrics
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import { SingletonCacheOptions } from '@/providers/base/FlexibleApiSingleton';
import { clientLogger } from '@/lib/client-logger';

// User Types (matching server-side)
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'support' | 'platform_admin' | 'tenant_admin' | 'user';
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  tenantIds: string[];
  permissions: string[];
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    department?: string;
    title?: string;
    phone?: string;
    timezone?: string;
    preferences?: Record<string, any>;
  };
  analytics: {
    totalLogins: number;
    totalSessions: number;
    averageSessionDuration: number;
    lastActivityAt: string;
    loginHistory: Array<{
      timestamp: string;
      ip: string;
      userAgent: string;
      success: boolean;
    }>;
  };
}

export interface UserActivity {
  id: string;
  userId: string;
  type: 'login' | 'logout' | 'page_view' | 'action' | 'error';
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  tenantId?: string;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  pendingUsers: number;
  usersByRole: Record<string, number>;
  usersByTenant: Record<string, number>;
  recentLogins: number;
  averageSessionDuration: number;
  topActiveUsers: Array<{
    userId: string;
    name: string;
    email: string;
    activityCount: number;
  }>;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  role: User['role'];
  tenantIds?: string[];
  permissions?: string[];
  metadata?: User['metadata'];
}

export interface UpdateUserRequest {
  name?: string;
  role?: User['role'];
  status?: User['status'];
  tenantIds?: string[];
  permissions?: string[];
  metadata?: User['metadata'];
}

class UsersSingleton extends TenantApiSingleton {
  private static instance: UsersSingleton;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'users-singleton*',
      'tenant-users*',
      'user-profiles*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('users-singleton*');
    await this.invalidateCachePattern('tenant-users*');
    await this.invalidateCachePattern('user-profiles*');
  }

  constructor() {
    super('users-singleton');
    this.cacheTTL = 15 * 60 * 1000; // 15 minutes for user data
  }

  static getInstance(): UsersSingleton {
    if (!UsersSingleton.instance) {
      UsersSingleton.instance = new UsersSingleton();
    }
    return UsersSingleton.instance;
  }

  // ====================
  // USER MANAGEMENT
  // ====================

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    const result = await this.makeDefaultRequest<{ user: User }>(
      `/api/users-singleton/${userId}`,
      {},
      `user-${userId}`
    );
    
    if (!result.success) {
      if (result.status === 404) {
        return null;
      }
      clientLogger.error('Error fetching user', { detail: result.error });
      return null;
    }
    
    return result.data?.user || null;
  }

  /**
   * Create new user
   */
  async createUser(request: CreateUserRequest): Promise<User> {
    const result = await this.makeDefaultRequest<{ user: User }>(
      '/api/users-singleton',
      {
        method: 'POST',
        body: JSON.stringify(request)
      },
      'user-create'
    );
    
    if (!result.success) {
      clientLogger.error('Error creating user', { detail: result.error });
      throw new Error(getErrorMessage(result.error) || 'Failed to create user');
    }

    console.log('User created successfully', { userId: result.data?.user.id });
    return result.data?.user || (() => { 
      throw new Error('No user data received'); 
    })();
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: UpdateUserRequest): Promise<User> {
    const result = await this.makeDefaultRequest<{ user: User }>(
      `/api/users-singleton/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates)
      },
      `user-update-${userId}`
    );
    
    if (!result.success) {
      clientLogger.error('Error updating user', { detail: result.error });
      throw new Error(getErrorMessage(result.error) || 'Failed to update user');
    }

    console.log('User updated successfully', { userId });
    return result.data?.user || (() => { 
      throw new Error('No user data received'); 
    })();
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/users-singleton/${userId}`,
      {
        method: 'DELETE'
      },
      `user-delete-${userId}`
    );
    
    if (!result.success) {
      clientLogger.error('Error deleting user', { detail: result.error });
      throw new Error(getErrorMessage(result.error) || 'Failed to delete user');
    }

    console.log('User deleted successfully', { userId });
  }

  /**
   * List users
   */
  async listUsers(filters: {
    role?: User['role'];
    status?: User['status'];
    tenantId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ users: User[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filters.role) params.append('role', filters.role);
      if (filters.status) params.append('status', filters.status);
      if (filters.tenantId) params.append('tenantId', filters.tenantId);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const cacheKey = `users-list-${params.toString()}`;

      const result = await this.makeDefaultRequest<{ users: User[]; total: number }>(
        `/api/users-singleton?${params}`,
        {},
        cacheKey
      );
      
      if (!result.success) {
        clientLogger.error('Error listing users', { detail: result.error });
        return { users: [], total: 0 };
      }

      return result.data || { users: [], total: 0 };
    } catch (error) {
      clientLogger.error('Error listing users', { detail: error });
      throw error;
    }
  }

  // ====================
  // USER ACTIVITY
  // ====================

  /**
   * Get user activity
   */
  async getUserActivity(userId: string, limit: number = 50): Promise<UserActivity[]> {
    const result = await this.makeDefaultRequest<{ activities: UserActivity[] }>(
      `/api/users-singleton/${userId}/activity?limit=${limit}`,
      {},
      `user-activity-${userId}-${limit}`
    );
    
    if (!result.success) {
      clientLogger.error('Error fetching user activity', { detail: result.error });
      return [];
    }

    return result.data?.activities || [];
  }

  /**
   * Record user activity
   */
  async recordActivity(userId: string, activity: Omit<UserActivity, 'id' | 'timestamp'>): Promise<UserActivity> {
    const result = await this.makeDefaultRequest<{ activity: UserActivity }>(
      `/api/users-singleton/${userId}/activity`,
      {
        method: 'POST',
        body: JSON.stringify(activity)
      },
      `user-activity-record-${userId}`
    );
    
    if (!result.success) {
      clientLogger.error('Error recording activity', { detail: result.error });
      throw new Error(getErrorMessage(result.error) || 'Failed to record activity');
    }

    console.log('User activity recorded', { userId, type: activity.type });
    return result.data?.activity || (() => { 
      throw new Error('No activity data received'); 
    })();
  }

  // ====================
  // USER ANALYTICS
  // ====================

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    const result = await this.makeDefaultRequest<{ stats: UserStats }>(
      '/api/users-singleton/stats',
      {},
      'user-stats'
    );
    
    if (!result.success) {
      clientLogger.error('Error fetching user stats', { detail: result.error });
      throw new Error(getErrorMessage(result.error) || 'Failed to fetch user stats');
    }

    return result.data?.stats || (() => { 
      throw new Error('No user stats data received'); 
    })();
  }

  // ====================
  // UTILITY METHODS
  // ====================

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    // This would typically get the current user from auth context
    // For now, return null - this would be implemented based on auth system
    return null;
  }

  /**
   * Search users
   */
  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    const result = await this.makeDefaultRequest<{ users: User[] }>(
      `/api/users-singleton?limit=${limit}&search=${encodeURIComponent(query)}`,
      {},
      `user-search-${query}-${limit}`
    );
    
    if (!result.success) {
      clientLogger.error('Error searching users', { detail: result.error });
      return [];
    }

    return result.data?.users || [];
  }

  // ====================
  // PRIVATE METHODS
  // ====================

}

export default UsersSingleton;
