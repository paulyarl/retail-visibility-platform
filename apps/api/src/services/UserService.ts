/**
 * Users Service - API Server Singleton
 * 
 * Manages user data, roles, permissions, and authentication
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';

// User Types
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

class UserService extends UniversalSingleton {
  private static instance: UserService;
  private userCache: Map<string, User> = new Map();
  private activityCache: Map<string, UserActivity[]> = new Map();

  constructor() {
    super('user-service', {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'public',
      defaultTTL: 3600, // 1 hour
      maxCacheSize: 1000,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize with mock data for testing
    this.initializeMockData();
  }

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  // ====================
  // USER MANAGEMENT
  // ====================

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    // Check local cache first
    const localCached = this.userCache.get(userId);
    if (localCached) {
      return localCached;
    }

    // Check persistent cache
    const cacheKey = `user-${userId}`;
    const cached = await this.getFromCache<User>(cacheKey);
    if (cached) {
      this.userCache.set(userId, cached);
      return cached;
    }

    try {
      // Query database for user
      const user = await this.queryUser(userId);
      
      if (user) {
        // Update caches
        this.userCache.set(userId, user);
        await this.setCache(cacheKey, user);
        return user;
      }

      return null;
    } catch (error) {
      this.logError('Error fetching user', error);
      return null;
    }
  }

  /**
   * Create new user
   */
  async createUser(request: CreateUserRequest): Promise<User> {
    const newUser: User = {
      id: this.generateId(),
      email: request.email,
      name: request.name,
      role: request.role,
      status: 'pending',
      tenantIds: request.tenantIds || [],
      permissions: request.permissions || this.getDefaultPermissions(request.role),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: request.metadata || {},
      analytics: {
        totalLogins: 0,
        totalSessions: 0,
        averageSessionDuration: 0,
        lastActivityAt: new Date().toISOString(),
        loginHistory: []
      }
    };

    try {
      // Store in database
      await this.storeUser(newUser);
      
      // Update caches
      this.userCache.set(newUser.id, newUser);
      const cacheKey = `user-${newUser.id}`;
      await this.setCache(cacheKey, newUser);

      this.logInfo('User created successfully', { userId: newUser.id, email: newUser.email });
      
      return newUser;
    } catch (error) {
      this.logError('Error creating user', error);
      throw new Error('Failed to create user');
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: UpdateUserRequest): Promise<User> {
    const existingUser = await this.getUser(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }

    const updatedUser: User = {
      ...existingUser,
      ...updates,
      updatedAt: new Date().toISOString(),
      // Update permissions if role changed
      permissions: updates.role ? this.getDefaultPermissions(updates.role) : existingUser.permissions
    };

    try {
      // Update in database
      await this.updateUserInDatabase(userId, updates);
      
      // Update caches
      this.userCache.set(userId, updatedUser);
      const cacheKey = `user-${userId}`;
      await this.setCache(cacheKey, updatedUser);

      this.logInfo('User updated successfully', { userId, updates });
      
      return updatedUser;
    } catch (error) {
      this.logError('Error updating user', error);
      throw new Error('Failed to update user');
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      // Delete from database
      await this.deleteUserFromDatabase(userId);
      
      // Clear caches
      this.userCache.delete(userId);
      const cacheKey = `user-${userId}`;
      await this.clearCache(cacheKey);

      this.logInfo('User deleted successfully', { userId });
    } catch (error) {
      this.logError('Error deleting user', error);
      throw new Error('Failed to delete user');
    }
  }

  /**
   * List users with filters
   */
  async listUsers(filters: {
    role?: User['role'];
    status?: User['status'];
    tenantId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ users: User[]; total: number }> {
    try {
      const users = await this.queryUsers(filters);
      const total = await this.countUsers(filters);
      
      return { users, total };
    } catch (error) {
      this.logError('Error listing users', error);
      throw new Error('Failed to list users');
    }
  }

  // ====================
  // USER ACTIVITY
  // ====================

  /**
   * Record user activity
   */
  async recordActivity(activity: Omit<UserActivity, 'id' | 'timestamp'>): Promise<UserActivity> {
    const userActivity: UserActivity = {
      ...activity,
      id: this.generateId(),
      timestamp: new Date().toISOString()
    };

    try {
      // Store in database
      await this.storeActivity(userActivity);
      
      // Update activity cache
      const cached = this.activityCache.get(activity.userId) || [];
      cached.push(userActivity);
      this.activityCache.set(activity.userId, cached);

      // Update user's last activity
      if (activity.type === 'login') {
        await this.updateUserLastActivity(activity.userId, userActivity.timestamp);
      }

      this.logInfo('User activity recorded', { userId: activity.userId, type: activity.type });
      
      return userActivity;
    } catch (error) {
      this.logError('Error recording activity', error);
      throw new Error('Failed to record activity');
    }
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId: string, limit: number = 50): Promise<UserActivity[]> {
    try {
      // Check cache first
      const cached = this.activityCache.get(userId);
      if (cached && cached.length > 0) {
        return cached.slice(-limit);
      }

      // Query database
      const activities = await this.queryUserActivity(userId, limit);
      
      // Update cache
      this.activityCache.set(userId, activities);
      
      return activities;
    } catch (error) {
      this.logError('Error fetching user activity', error);
      return [];
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
      const cacheKey = 'user-stats';
      const cached = await this.getFromCache<UserStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const stats = await this.calculateUserStats();
      
      // Cache for 15 minutes
      await this.setCache(cacheKey, stats, { ttl: 900 });
      
      return stats;
    } catch (error) {
      this.logError('Error fetching user stats', error);
      throw new Error('Failed to fetch user statistics');
    }
  }

  // ====================
  // UTILITY METHODS
  // ====================

  private getDefaultPermissions(role: User['role']): string[] {
    const permissionMap = {
      admin: ['read_all', 'write_all', 'delete_all', 'manage_users', 'manage_system'],
      platform_admin: ['read_all', 'write_all', 'manage_users', 'manage_tenants', 'manage_system'],
      support: ['read_all', 'manage_users', 'support_tickets'],
      tenant_admin: ['read_tenant', 'write_tenant', 'manage_tenant_users'],
      user: ['read_own', 'write_own']
    };
    
    return permissionMap[role] || permissionMap.user;
  }

  private async updateUserLastActivity(userId: string, timestamp: string): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      await this.updateUser(userId, {
        metadata: {
          ...user.metadata
        }
      });
    }
  }

  // ====================
  // MOCK DATA IMPLEMENTATION
  // ====================

  private initializeMockData(): void {
    // Create mock users for testing
    const mockUsers: User[] = [
      {
        id: 'user-admin-001',
        email: 'admin@rvp.com',
        name: 'Platform Administrator',
        role: 'platform_admin',
        status: 'active',
        tenantIds: ['tid-m8ijkrnk', 'tid-042hi7ju'],
        permissions: ['read_all', 'write_all', 'manage_users', 'manage_tenants', 'manage_system'],
        lastLoginAt: new Date().toISOString(),
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
        metadata: {
          department: 'Platform',
          title: 'Platform Administrator',
          phone: '+1-555-0100',
          timezone: 'America/New_York'
        },
        analytics: {
          totalLogins: 150,
          totalSessions: 200,
          averageSessionDuration: 1800,
          lastActivityAt: new Date().toISOString(),
          loginHistory: []
        }
      },
      {
        id: 'user-support-001',
        email: 'support@rvp.com',
        name: 'Support Agent',
        role: 'support',
        status: 'active',
        tenantIds: ['tid-m8ijkrnk'],
        permissions: ['read_all', 'manage_users', 'support_tickets'],
        lastLoginAt: new Date().toISOString(),
        createdAt: '2024-01-15T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
        metadata: {
          department: 'Support',
          title: 'Support Specialist',
          timezone: 'America/New_York'
        },
        analytics: {
          totalLogins: 75,
          totalSessions: 100,
          averageSessionDuration: 2400,
          lastActivityAt: new Date().toISOString(),
          loginHistory: []
        }
      },
      {
        id: 'uid-zqe5ns5k',
        email: 'platform@rvp.com',
        name: 'Platform User',
        role: 'user',
        status: 'active',
        tenantIds: ['tid-m8ijkrnk', 'tid-042hi7ju', 'tid-lt21twzu', 'tid-r6cccpaf'],
        permissions: ['read_own', 'write_own'],
        lastLoginAt: new Date().toISOString(),
        createdAt: '2024-02-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
        metadata: {
          department: 'General',
          timezone: 'America/New_York'
        },
        analytics: {
          totalLogins: 50,
          totalSessions: 75,
          averageSessionDuration: 1200,
          lastActivityAt: new Date().toISOString(),
          loginHistory: []
        }
      }
    ];

    // Cache mock users
    mockUsers.forEach(user => {
      this.userCache.set(user.id, user);
    });
  }

  // ====================
  // DATABASE STUBS
  // ====================

  private async queryUser(userId: string): Promise<User | null> {
    console.log('Querying user:', userId);
    return this.userCache.get(userId) || null;
  }

  private async storeUser(user: User): Promise<void> {
    console.log('Storing user:', user.id);
    this.userCache.set(user.id, user);
  }

  private async updateUserInDatabase(userId: string, updates: UpdateUserRequest): Promise<void> {
    console.log('Updating user in database:', userId, updates);
  }

  private async deleteUserFromDatabase(userId: string): Promise<void> {
    console.log('Deleting user from database:', userId);
  }

  private async queryUsers(filters: any): Promise<User[]> {
    console.log('Querying users with filters:', filters);
    return Array.from(this.userCache.values());
  }

  private async countUsers(filters: any): Promise<number> {
    console.log('Counting users with filters:', filters);
    return this.userCache.size;
  }

  private async storeActivity(activity: UserActivity): Promise<void> {
    console.log('Storing activity:', activity.id);
  }

  private async queryUserActivity(userId: string, limit: number): Promise<UserActivity[]> {
    console.log('Querying user activity:', userId, limit);
    return this.activityCache.get(userId) || [];
  }

  private async calculateUserStats(): Promise<UserStats> {
    const users = Array.from(this.userCache.values());
    
    const stats: UserStats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'active').length,
      suspendedUsers: users.filter(u => u.status === 'suspended').length,
      pendingUsers: users.filter(u => u.status === 'pending').length,
      usersByRole: users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      usersByTenant: users.reduce((acc, user) => {
        user.tenantIds.forEach(tenantId => {
          acc[tenantId] = (acc[tenantId] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>),
      recentLogins: users.filter(u => u.lastLoginAt && 
        new Date(u.lastLoginAt) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length,
      averageSessionDuration: users.reduce((sum, user) => sum + user.analytics.averageSessionDuration, 0) / users.length,
      topActiveUsers: users
        .sort((a, b) => b.analytics.totalLogins - a.analytics.totalLogins)
        .slice(0, 5)
        .map(user => ({
          userId: user.id,
          name: user.name,
          email: user.email,
          activityCount: user.analytics.totalLogins
        }))
    };

    return stats;
  }
}

export default UserService;
