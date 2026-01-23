'use client';

import { createContext, useContext, ReactNode } from 'react';

// ====================
// BASE API SINGLETON CLASSES
// ====================

/**
 * Base class for all API singletons
 * Provides common functionality for caching, error handling, and state management
 */
abstract class ApiSingletonBase {
  // Make instances static public for metrics access
  public static instances: Map<string, ApiSingletonBase> = new Map();
  
  // Shared caching infrastructure
  protected cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes default
  
  // Performance tracking
  protected cacheHits: number = 0;
  protected cacheMisses: number = 0;
  protected apiCalls: number = 0;
  
  /**
   * Get singleton instance by key
   */
  protected static getInstance<T extends ApiSingletonBase>(
    key: string,
    constructor: () => T
  ): T {
    if (!ApiSingletonBase.instances.has(key)) {
      ApiSingletonBase.instances.set(key, constructor());
    }
    return ApiSingletonBase.instances.get(key) as T;
  }
  
  /**
   * Check if data is cached and valid
   */
  protected isCached(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < cached.ttl;
  }
  
  /**
   * Get cached data
   */
  protected getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if ((now - cached.timestamp) >= cached.ttl) {
      this.cache.delete(key);
      this.cacheMisses++;
      return null;
    }
    
    this.cacheHits++;
    return cached.data;
  }
  
  /**
   * Set cached data
   */
  protected setCachedData(key: string, data: any, customTTL?: number): void {
    const ttl = customTTL || this.cacheTTL;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  /**
   * Clear cache by key or all cache
   */
  protected clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
  
  /**
   * Make API request with error handling and caching
   */
  protected async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number
  ): Promise<T> {
    // Check cache first
    if (cacheKey && this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }
    
    // Make API request
    this.apiCalls++;
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Cache the result
      if (cacheKey) {
        this.setCachedData(cacheKey, data, customTTL);
      }
      
      return data;
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  }
  
  /**
   * Get performance metrics
   */
  public getMetrics() {
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      apiCalls: this.apiCalls,
      cacheSize: this.cache.size
    };
  }
  
  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.apiCalls = 0;
  }
}

/**
 * Base class for authenticated API singletons
 * Extends ApiSingletonBase with authentication-specific functionality
 */
abstract class AuthenticatedApiSingleton extends ApiSingletonBase {
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for authenticated data
  
  /**
   * Make authenticated API request
   */
  protected async makeAuthenticatedRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number
  ): Promise<T> {
    // Add authentication headers
    const authOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.getAuthToken()}`,
        'Content-Type': 'application/json',
      }
    };
    
    return this.makeRequest<T>(url, authOptions, cacheKey, customTTL);
  }
  
  /**
   * Get authentication token
   */
  protected getAuthToken(): string {
    // This would get the JWT token from localStorage, cookies, or auth context
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken') || '';
    }
    return '';
  }
  
  /**
   * Handle authentication errors
   */
  protected handleAuthError(error: any): void {
    if (error.status === 401) {
      // Token expired, trigger refresh or logout
      console.warn('Authentication token expired');
      // This would trigger token refresh or logout
    }
  }
}

/**
 * Base class for public API singletons
 * Extends ApiSingletonBase with public API specific functionality
 */
abstract class PublicApiSingleton extends ApiSingletonBase {
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for public data
  
  /**
   * Make public API request
   */
  protected async makePublicRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number
  ): Promise<T> {
    // Add public API headers
    const publicOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      }
    };
    
    return this.makeRequest<T>(url, publicOptions, cacheKey, customTTL);
  }
  
  /**
   * Handle public API errors
   */
  protected handlePublicError(error: any): void {
    console.error('Public API error:', error);
    // Public APIs might have different error handling needs
  }
}

/**
 * React context for API singleton instances
 */
const ApiSingletonContext = createContext<{
  getMetrics: () => any;
  resetMetrics: () => void;
} | null>(null);

/**
 * Provider for API singleton context
 */
export function ApiSingletonProvider({ children }: { children: ReactNode }) {
  const value = {
    getMetrics: () => {
      const metrics: Record<string, any> = {};
      ApiSingletonBase.instances.forEach((instance, key) => {
        metrics[key] = instance.getMetrics();
      });
      return metrics;
    },
    resetMetrics: () => {
      ApiSingletonBase.instances.forEach(instance => instance.resetMetrics());
    }
  };
  
  return (
    <ApiSingletonContext.Provider value={value}>
      {children}
    </ApiSingletonContext.Provider>
  );
}

/**
 * Hook to access API singleton metrics
 */
export function useApiSingletonMetrics() {
  const context = useContext(ApiSingletonContext);
  if (!context) {
    throw new Error('useApiSingletonMetrics must be used within ApiSingletonProvider');
  }
  return context;
}

// Export base classes for extension
export { ApiSingletonBase, AuthenticatedApiSingleton, PublicApiSingleton };

// Export instances map for metrics access
export const apiSingletonInstances = ApiSingletonBase['instances'];
