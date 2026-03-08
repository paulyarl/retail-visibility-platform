/**
 * Public API Singleton - Public Data Operations
 * 
 * Extends FlexibleApiSingleton with public-specific defaults:
 * - Default request type: PUBLIC
 * - Public request handling (no authentication required)
 * - Public-specific TTL (15 minutes)
 * - Optimized for public data that changes infrequently
 */

import { FlexibleApiSingleton, RequestType, RequestTarget, SingletonCacheOptions } from './FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '../../utils/contextCacheManager';

// ====================
// PUBLIC API SINGLETON
// ====================

export abstract class PublicApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.PUBLIC;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected defaultContext: AppContext = AppContext.GLOBAL;
  protected defaultIsolation: CacheIsolation = CacheIsolation.GLOBAL;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for public data
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 15 * 60 * 1000, // 15 minutes for public data
      ...cacheOptions
    });
  }
  
  // ✅ All makeRequest methods inherited from FlexibleApiSingleton
  // ✅ URL construction now handled in parent class fetchWithCache
  // ❌ REMOVED: Duplicate makePublicRequest() - already in parent
  // ❌ REMOVED: Duplicate makeApiRequest() - now handled by parent
}

export default PublicApiSingleton;
