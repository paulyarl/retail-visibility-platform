/**
 * Users Singleton - Producer Pattern
 * 
 * Produces and manages user data with AuthenticatedApiSingleton integration
 * Extends AuthenticatedApiSingleton for consistent caching and metrics
 */

import { AuthenticatedApiSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

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

class UsersSingleton extends AuthenticatedApiSingleton {
  private static instance: UsersSingleton;

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
    try {
      const result = await this.makeAuthenticatedRequest<{ user: User }>(
        `/api/users-singleton/${userId}`,
        {},
        `user-${userId}`
      );

      return result.user;
    } catch (error: any) {
      if (error.message?.includes('404')) {
        return null;
      }
      console.error('Error fetching user', error);
      return null;
    }
  }

  /**
   * Create new user
   */
  async createUser(request: CreateUserRequest): Promise<User> {
    try {
      const result = await this.makeAuthenticatedRequest<{ user: User }>(
        '/api/users-singleton',
        {
          method: 'POST',
          body: JSON.stringify(request)
        },
        'user-create'
      );

      console.log('User created successfully', { userId: result.user.id });
      return result.user;
    } catch (error) {
      console.error('Error creating user', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: UpdateUserRequest): Promise<User> {
    try {
      const result = await this.makeAuthenticatedRequest<{ user: User }>(
        `/api/users-singleton/${userId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates)
        },
        `user-update-${userId}`
      );

      console.log('User updated successfully', { userId });
      return result.user;
    } catch (error) {
      console.error('Error updating user', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await this.makeAuthenticatedRequest<void>(
        `/api/users-singleton/${userId}`,
        {
          method: 'DELETE'
        },
        `user-delete-${userId}`
      );

      console.log('User deleted successfully', { userId });
    } catch (error) {
      console.error('Error deleting user', error);
      throw error;
    }
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

      const result = await this.makeAuthenticatedRequest<{ users: User[]; total: number }>(
        `/api/users-singleton?${params}`,
        {},
        cacheKey
      );

      return result;
    } catch (error) {
      console.error('Error listing users', error);
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
    try {
      const result = await this.makeAuthenticatedRequest<{ activities: UserActivity[] }>(
        `/api/users-singleton/${userId}/activity?limit=${limit}`,
        {},
        `user-activity-${userId}-${limit}`
      );

      return result.activities;
    } catch (error) {
      console.error('Error fetching user activity', error);
      throw error;
    }
  }

  /**
   * Record user activity
   */
  async recordActivity(userId: string, activity: Omit<UserActivity, 'id' | 'timestamp'>): Promise<UserActivity> {
    try {
      const result = await this.makeAuthenticatedRequest<{ activity: UserActivity }>(
        `/api/users-singleton/${userId}/activity`,
        {
          method: 'POST',
          body: JSON.stringify(activity)
        },
        `user-activity-record-${userId}`
      );

      console.log('User activity recorded', { userId, type: activity.type });
      return result.activity;
    } catch (error) {
      console.error('Error recording activity', error);
      throw error;
    }
  }

  // ====================
  // USER ANALYTICS
  // ====================

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    try {
      const result = await this.makeAuthenticatedRequest<{ stats: UserStats }>(
        '/api/users-singleton/stats',
        {},
        'user-stats'
      );

      return result.stats;
    } catch (error) {
      console.error('Error fetching user stats', error);
      throw error;
    }
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
    try {
      const result = await this.makeAuthenticatedRequest<{ users: User[] }>(
        `/api/users-singleton?limit=${limit}&search=${encodeURIComponent(query)}`,
        {},
        `user-search-${query}-${limit}`
      );

      return result.users;
    } catch (error) {
      console.error('Error searching users', error);
      throw error;
    }
  }

  // ====================
  // PRIVATE METHODS
  // ====================

}

export default UsersSingleton;
