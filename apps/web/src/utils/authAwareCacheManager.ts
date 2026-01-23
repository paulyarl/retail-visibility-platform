/**
 * Auth-Aware Cache Manager
 * 
 * Extends CacheManager with automatic user ID detection from AuthContext
 * for seamless user-based encryption.
 */

import { CacheManager, CacheOptions } from './cacheManager';
import { useAuth } from '@/contexts/AuthContext';

interface AuthAwareCacheOptions extends CacheOptions {
  useAuthUser?: boolean; // Auto-detect user ID from AuthContext
}

class AuthAwareCacheManager extends CacheManager {
  /**
   * Get current user ID from AuthContext
   */
  private getCurrentUserId(): string | undefined {
    // This would be used in React components
    // For non-React usage, we'll need to pass the user ID explicitly
    return undefined;
  }

  /**
   * Enhanced get method with automatic user ID detection
   */
  async get<T>(key: string, options: AuthAwareCacheOptions = {}): Promise<T | null> {
    const finalOptions: CacheOptions = { ...options };

    // Auto-detect user ID if requested and not explicitly provided
    if (options.useAuthUser && !options.userId) {
      const authUserId = this.getCurrentUserId();
      if (authUserId) {
        finalOptions.userId = authUserId;
      }
    }

    return super.get(key, finalOptions);
  }

  /**
   * Enhanced set method with automatic user ID detection
   */
  async set<T>(key: string, data: T, options: AuthAwareCacheOptions = {}): Promise<void> {
    const finalOptions: CacheOptions = { ...options };

    // Auto-detect user ID if requested and not explicitly provided
    if (options.useAuthUser && !options.userId) {
      const authUserId = this.getCurrentUserId();
      if (authUserId) {
        finalOptions.userId = authUserId;
      }
    }

    return super.set(key, data, finalOptions);
  }
}

/**
 * React Hook for Auth-Aware Cache Manager
 * Automatically uses current user for encryption
 */
export function useAuthAwareCache() {
  const { user } = useAuth();
  
  const getCurrentUserId = (): string | undefined => {
    return user?.id;
  };

  const get = async <T>(key: string, options: AuthAwareCacheOptions = {}): Promise<T | null> =>{
    const finalOptions: CacheOptions = { ...options };

    // Auto-detect user ID if requested and not explicitly provided
    if (options.useAuthUser && !options.userId) {
      const authUserId = getCurrentUserId();
      if (authUserId) {
        finalOptions.userId = authUserId;
      }
    }

    // Use regular CacheManager with resolved options
    const cacheManager = new CacheManager({ 
      encrypt: options.encrypt, 
      userId: finalOptions.userId 
    });
    return cacheManager.get(key, finalOptions);
  };

  const set = async <T>(key: string, data: T, options: AuthAwareCacheOptions = {}): Promise<void> => {
    const finalOptions: CacheOptions = { ...options };

    // Auto-detect user ID if requested and not explicitly provided
    if (options.useAuthUser && !options.userId) {
      const authUserId = getCurrentUserId();
      if (authUserId) {
        finalOptions.userId = authUserId;
      }
    }

    // Use regular CacheManager with resolved options
    const cacheManager = new CacheManager({ 
      encrypt: options.encrypt, 
      userId: finalOptions.userId 
    });
    return cacheManager.set(key, data, finalOptions);
  };

  return { get, set };
}

export { AuthAwareCacheManager };
export type { AuthAwareCacheOptions };
