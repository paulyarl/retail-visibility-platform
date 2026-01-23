/**
 * Users Singleton - Producer Pattern
 * 
 * Produces and manages user data with UniversalSingleton integration
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

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

class UsersSingleton extends UniversalSingleton {
  private static instance: UsersSingleton;

  constructor() {
    super('users-singleton', {
      encrypt: true,
      userId: undefined
    });
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
    const cacheKey = `user-${userId}`;
    
    // Check cache first
    const cached = await this.getFromCache<User>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/users-singleton/${userId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }

      const result = await response.json();
      const user = result.data.user;

      // Cache the result
      await this.setCache(cacheKey, user);
      
      return user;
    } catch (error) {
      console.error('Error fetching user', error);
      return null;
    }
  }

  /**
   * Create new user
   */
  async createUser(request: CreateUserRequest): Promise<User> {
    try {
      const response = await fetch('/api/users-singleton', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Failed to create user: ${response.statusText}`);
      }

      const result = await response.json();
      const user = result.data.user;

      // Clear user list cache
      await this.clearCache('users-list');

      console.log('User created successfully', { userId: user.id });
      
      return user;
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
      const response = await fetch(`/api/users-singleton/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update user: ${response.statusText}`);
      }

      const result = await response.json();
      const user = result.data.user;

      // Update cache
      const cacheKey = `user-${userId}`;
      await this.setCache(cacheKey, user);

      // Clear user list cache
      await this.clearCache('users-list');

      console.log('User updated successfully', { userId });
      
      return user;
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
      const response = await fetch(`/api/users-singleton/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete user: ${response.statusText}`);
      }

      // Clear caches
      const cacheKey = `user-${userId}`;
      await this.clearCache(cacheKey);
      await this.clearCache('users-list');

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
    const cacheKey = `users-list-${JSON.stringify(filters)}`;
    
    // Check cache first
    const cached = await this.getFromCache<{ users: User[]; total: number }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      if (filters.role) params.append('role', filters.role);
      if (filters.status) params.append('status', filters.status);
      if (filters.tenantId) params.append('tenantId', filters.tenantId);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await fetch(`/api/users-singleton?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list users: ${response.statusText}`);
      }

      const result = await response.json();
      const data = result.data;

      // Cache the result
      await this.setCache(cacheKey, data);
      
      return data;
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
    const cacheKey = `user-activity-${userId}-${limit}`;
    
    // Check cache first
    const cached = await this.getFromCache<UserActivity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/users-singleton/${userId}/activity?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user activity: ${response.statusText}`);
      }

      const result = await response.json();
      const activities = result.data.activities;

      // Cache the result
      await this.setCache(cacheKey, activities);
      
      return activities;
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
      const response = await fetch(`/api/users-singleton/${userId}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(activity)
      });

      if (!response.ok) {
        throw new Error(`Failed to record activity: ${response.statusText}`);
      }

      const result = await response.json();
      const userActivity = result.data.activity;

      // Clear activity cache for this user
      await this.clearCache(`user-activity-${userId}-*`);

      console.log('User activity recorded', { userId, type: activity.type });
      
      return userActivity;
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
    const cacheKey = 'user-stats';
    
    // Check cache first
    const cached = await this.getFromCache<UserStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/api/users-singleton/stats', {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user stats: ${response.statusText}`);
      }

      const result = await response.json();
      const stats = result.data.stats;

      // Cache the result
      await this.setCache(cacheKey, stats);
      
      return stats;
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
      const response = await fetch(`/api/users-singleton?limit=${limit}&search=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to search users: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data.users;
    } catch (error) {
      console.error('Error searching users', error);
      throw error;
    }
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private getAuthToken(): string {
    // This would get the auth token from cookies, localStorage, or context
    // For now, return empty string - this would be implemented based on auth system
    return '';
  }
}

export default UsersSingleton;
