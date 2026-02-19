/**
 * RBAC Service - System-Level Service with Platform Caching
 * Uses singleton pattern with platform's built-in caching system
 * Provides RBAC functionality using platform cache integration
 */

import { SystemSingleton } from '../providers/base/SystemSingleton';

export interface RBACRoleGroups {
  [key: string]: string[];
}

export interface RBACUserPermissions {
  userRole: string;
  permissions: string[];
}

export interface RBACUserAccess {
  userRole: string;
  access: {
    groups: string[];
    permissions: string[];
  };
  summary: {
    totalGroups: number;
    totalPermissions: number;
    accessLevel: string;
  };
}

/**
 * System-level RBAC service using platform's built-in caching
 * Uses singleton pattern with SystemSingleton for unified system-level caching coordination
 * Provides RBAC functionality with platform cache integration
 */
export class RBACService extends SystemSingleton {
  private static readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private static instance: RBACService;

  private constructor() {
    super('rbac-service', {
      ttl: RBACService.CACHE_TTL,
      encrypt: false // RBAC data is not sensitive
    });
  }

  /**
   * Get singleton instance using platform singleton pattern
   */
  static getInstance(): RBACService {
    if (!RBACService.instance) {
      RBACService.instance = new RBACService();
    }
    return RBACService.instance;
  }

  /**
   * Get role groups with system-level caching
   * Uses platform's built-in caching via SystemSingleton
   */
  async getRoleGroups(): Promise<RBACRoleGroups> {
    try {
      console.log('[RBACService] Fetching role groups via system-level caching');
      
      // Use system-level API request with automatic caching
      const result = await this.makeSystemRequest<RBACRoleGroups>('/api/auth/role-groups', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=600', // 10 minutes
          'X-Service-Worker': 'rbac-cache',
          'X-Platform-Cache': 'enabled'
        }
      }, 'role-groups', RBACService.CACHE_TTL);

      if (result.success && result.data) {
        console.log('[RBACService] Role groups retrieved from system cache');
        return result.data;
      } else {
        throw new Error(result.error?.message || 'Failed to fetch role groups');
      }

    } catch (error) {
      console.error('[RBACService] Failed to fetch role groups:', error);
      
      // Return fallback role groups as last resort
      console.error('[RBACService] Using fallback role groups');
      return this.getFallbackRoleGroups();
    }
  }

  /**
   * Get user permissions with system-level caching
   */
  async getUserPermissions(): Promise<RBACUserPermissions> {
    try {
      console.log('[RBACService] Fetching user permissions via system-level caching');
      
      const result = await this.makeSystemRequest<RBACUserPermissions>('/api/auth/user-permissions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=600',
          'X-Service-Worker': 'rbac-cache',
          'X-Platform-Cache': 'enabled'
        }
      }, 'user-permissions', RBACService.CACHE_TTL);

      if (result.success && result.data) {
        console.log('[RBACService] User permissions retrieved from system cache');
        return result.data;
      } else {
        throw new Error(result.error?.message || 'Failed to fetch user permissions');
      }

    } catch (error) {
      console.error('[RBACService] Failed to fetch user permissions:', error);
      return this.getFallbackUserPermissions();
    }
  }

  /**
   * Get unified user access with system-level caching
   * This is the preferred method - gets both groups and permissions
   */
  async getUserAccess(): Promise<RBACUserAccess> {
    try {
      console.log('[RBACService] Fetching user access via system-level caching');
      
      const result = await this.makeSystemRequest<RBACUserAccess>('/api/auth/user-access', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=600',
          'X-Service-Worker': 'rbac-cache',
          'X-Platform-Cache': 'enabled'
        }
      }, 'user-access', RBACService.CACHE_TTL);

      if (result.success && result.data) {
        console.log('[RBACService] User access retrieved from system cache');
        return result.data;
      } else {
        throw new Error(result.error?.message || 'Failed to fetch user access');
      }

    } catch (error) {
      console.error('[RBACService] Failed to fetch user access:', error);
      return this.getFallbackUserAccess();
    }
  }

  /**
   * Validate user role against role groups using system-level caching
   */
  async validateRoleAgainstGroup(userRole: string, requiredGroup: string): Promise<boolean> {
    try {
      const roleGroups = await this.getRoleGroups();
      const allowedRoles = roleGroups[requiredGroup];
      
      if (!allowedRoles) {
        console.error(`[RBACService] Role group '${requiredGroup}' not found`);
        return false;
      }
      
      return allowedRoles.includes(userRole);
    } catch (error) {
      console.error('[RBACService] Failed to validate role against group:', error);
      return false;
    }
  }

  /**
   * Check if user has specific permission using system-level caching
   */
  async hasPermission(userRole: string, permission: string): Promise<boolean> {
    try {
      const userAccess = await this.getUserAccess();
      return userAccess.access.permissions.includes(permission);
    } catch (error) {
      console.error('[RBACService] Failed to check permission:', error);
      return false;
    }
  }

  /**
   * Invalidate all RBAC caches using system-level cache manager
   */
  invalidateAllCaches(): void {
    console.log('[RBACService] Invalidating all RBAC caches via system cache manager');
    
    // Invalidate all RBAC cache keys
    this.invalidateCache('role-groups');
    this.invalidateCache('user-permissions');
    this.invalidateCache('user-access');
    
    // Clear platform storage if needed
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('rbac-platform-cache');
    }
  }

  /**
   * Invalidate specific cache entry using system-level cache manager
   */
  async invalidateCache(key: string): Promise<void> {
    console.log(`[RBACService] Invalidating system cache for key: ${key}`);
    await super.invalidateCache(key);
  }

  /**
   * Get cache statistics from system-level cache manager
   */
  getCacheStats() {
    // Use UniversalSingleton's metrics
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      apiCalls: this.apiCalls,
      cacheHitRate: this.cacheHits > 0 ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) : 0,
      totalEntries: 0, // UniversalSingleton doesn't expose this
      expiredEntries: 0, // UniversalSingleton doesn't expose this
      memorySize: 0, // UniversalSingleton doesn't expose this
      persistentCacheSize: 0, // UniversalSingleton doesn't expose this
    };
  }

  /**
   * Preload all RBAC data using system-level cache
   */
  async preloadAllData(): Promise<void> {
    console.log('[RBACService] Preloading all RBAC data to system cache');
    
    try {
      await Promise.all([
        this.getRoleGroups(),
        this.getUserAccess()
      ]);
      
      console.log('[RBACService] All RBAC data preloaded to system cache');
    } catch (error) {
      console.error('[RBACService] Failed to preload RBAC data:', error);
    }
  }

  // Private helper methods

  private getFallbackRoleGroups(): RBACRoleGroups {
    return {
      IS_TENANT_ADMIN: ['OWNER', 'TENANT_ADMIN', 'TENANT_OWNER', 'PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'ADMIN'],
      IS_TENANT_OWNER: ['OWNER', 'TENANT_ADMIN', 'TENANT_OWNER', 'PLATFORM_ADMIN', 'ADMIN'],
      IS_TENANT_MANAGER: ['OWNER', 'TENANT_ADMIN', 'TENANT_OWNER', 'PLATFORM_ADMIN', 'ADMIN', 'PLATFORM_SUPPORT'],
      IS_TENANT_USER: ['OWNER', 'TENANT_ADMIN', 'TENANT_OWNER', 'ADMIN', 'PLATFORM_ADMIN', 'USER'],
      IS_PLATFORM_ADMIN: ['PLATFORM_ADMIN', 'ADMIN'],
      IS_PLATFORM_SUPPORT: ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'ADMIN']
    };
  }

  private getFallbackUserPermissions(): RBACUserPermissions {
    return {
      userRole: 'USER',
      permissions: []
    };
  }

  private getFallbackUserAccess(): RBACUserAccess {
    return {
      userRole: 'USER',
      access: {
        groups: [],
        permissions: []
      },
      summary: {
        totalGroups: 0,
        totalPermissions: 0,
        accessLevel: 'USER'
      }
    };
  }
}
