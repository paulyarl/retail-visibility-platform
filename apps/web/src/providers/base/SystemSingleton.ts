/**
 * System Singleton Base Class
 * Base class for system-level services that need caching and API capabilities
 * Extends FlexibleApiSingleton for system-level operations (no authentication required)
 * Provides unified caching, error handling, and platform integration
 */

import { FlexibleApiSingleton, RequestType, SingletonCacheOptions, SystemApiResponse } from './FlexibleApiSingleton';

export interface SystemSingletonCacheOptions {
  encrypt?: boolean;
  userId?: string;
  ttl?: number;
}

/**
 * Base class for system-level singletons
 * Extends FlexibleApiSingleton with system-specific functionality
 */
export abstract class SystemSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.SYSTEM;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for system data
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 15 * 60 * 1000, // 15 minutes for system data
      ...cacheOptions
    });
  }

  /**
   * Get custom metrics for system operations
   */
}
