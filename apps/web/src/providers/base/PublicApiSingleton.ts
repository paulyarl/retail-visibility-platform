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
import { ResolverType, ResolverResponse } from '../../types/resolver';

// ====================
// PUBLIC API SINGLETON
// ====================

export abstract class PublicApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.PUBLIC;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected defaultContext: AppContext = AppContext.PUBLIC;
  protected defaultIsolation: CacheIsolation = CacheIsolation.PUBLIC;
  protected defaultIncludeCredentials: boolean = false; // Public requests don't need auth cookies
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for public data
  
  // Resolver cache TTLs
  protected CACHE_TTL_LONG = 3600 * 1000; // 1 hour for successful resolutions
  protected CACHE_TTL_SHORT = 5 * 60 * 1000; // 5 minutes for failed resolutions
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 15 * 60 * 1000, // 15 minutes for public data
      ...cacheOptions
    });
  }

  /**
   * Type-safe identifier resolver
   * Resolves slugs to canonical IDs using existing working endpoint
   * Uses makeDefaultRequest for automatic context/isolation
   */
  protected async resolveIdentifier<T extends AppContext>(
    identifier: string, 
    type: T
  ): Promise<string> {
    const cacheKey = `resolved-${type}:${identifier}`;
    
    // Use existing working endpoint for tenant resolution
    const endpoint = type === AppContext.TENANT 
      ? `/api/directory/resolve-slug/${identifier}`
      : `/api/resolver/${type}/${identifier}`; // Fallback for other types
    
  //  console.log(`[PublicApiSingleton] Resolving ${type}/${identifier} via endpoint: ${endpoint}`);
    
    try {
      const response = await this.makeDefaultRequest<any>(
        endpoint,
        {},
        cacheKey,
        this.CACHE_TTL_LONG,
         {
          context: AppContext.SHOP,
          isolation: CacheIsolation.SHOP
        }
      );

    //  console.log(`[PublicApiSingleton] Resolver response for ${type}/${identifier}:`, response);

      // Handle different response formats
      let resolvedId: string;
      
      if (type === AppContext.TENANT) {
        // Directory resolve-slug endpoint returns { success: true, tenantId: "tid-..." }
        if (!response?.success || !response?.data.tenantId) {
          // console.log(`[PublicApiSingleton] Invalid response for ${type}/${identifier}:`, response);
          //throw new Error(`${type} not found for identifier: ${identifier}`);
          return identifier;
        }
        resolvedId = response.data.tenantId;
      } else {
        // Other resolvers return { success: true, data: { resolvedId: "..." } }
        if (!response?.success || !response?.data?.resolvedId) {
          // console.log(`[PublicApiSingleton] Invalid response for ${type}/${identifier}:`, response);
          //throw new Error(`${type} not found for identifier: ${identifier}`);
          return identifier;
        }
        resolvedId = response.data.resolvedId;
      }

     // console.log(`[PublicApiSingleton] Successfully resolved ${type}/${identifier} → ${resolvedId}`);
      return resolvedId;
      
    } catch (error) {
      console.error(`[PublicApiSingleton] Resolver failed for ${type}/${identifier}:`, error);
      // Don't cache failures immediately - let the next request try again
      // This prevents permanent cache poisoning on temporary failures
      throw error;
    }
  }
  
  // ✅ All makeRequest methods inherited from FlexibleApiSingleton
  // ✅ URL construction now handled in parent class fetchWithCache
  // ❌ REMOVED: Duplicate makePublicRequest() - already in parent
  // ❌ REMOVED: Duplicate makeApiRequest() - now handled by parent
}

export default PublicApiSingleton;
