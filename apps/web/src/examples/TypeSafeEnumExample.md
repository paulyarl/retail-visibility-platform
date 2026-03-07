/**
 * Enhanced Type Safety Example with AppContext Enum
 * 
 * Shows complete type safety with both AppContext and CacheIsolation enums
 */

import { EnhancedFlexibleApiSingleton, EnhancedCacheOptions } from '../base/EnhancedFlexibleApiSingleton';
import { RequestType, RequestTarget } from '../base/FlexibleApiSingleton';
import { CacheIsolation, AppContext } from '../../utils/contextCacheManager';

/**
 * Example: Complete Type Safety with Enums
 */
class TypeSafeProductSingleton extends EnhancedFlexibleApiSingleton {
  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;

  /**
   * ✅ COMPLETE TYPE SAFETY - No string literals allowed
   */
  async getProductsByContext(context: AppContext) {
    return this.makeEnhancedDefaultRequest('/api/products', undefined, undefined, undefined, {
      // ✅ Type-safe: Only AppContext enum values allowed
      context: context, // AppContext.ADMIN | AppContext.TENANT | AppContext.PRODUCT | etc.
      
      // ✅ Type-safe: Only CacheIsolation enum values allowed
      isolation: this.getIsolationForContext(context),
      
      // ✅ Auto-detection with type safety
      useTenantContext: context === AppContext.TENANT,
      useAuthUser: context === AppContext.USER || context === AppContext.ADMIN,
      
      ttl: this.getTTLForContext(context)
    });
  }

  /**
   * ✅ Type-safe context mapping
   */
  private getIsolationForContext(context: AppContext): CacheIsolation {
    switch (context) {
      case AppContext.ADMIN:
        return CacheIsolation.ADMIN;
      case AppContext.TENANT:
        return CacheIsolation.TENANT;
      case AppContext.USER:
        return CacheIsolation.USER;
      case AppContext.PRODUCT:
      case AppContext.STORE:
        return CacheIsolation.GLOBAL;
      case AppContext.SYSTEM:
        return CacheIsolation.GLOBAL;
      default:
        // ✅ TypeScript error: Not all cases handled
        const _exhaustiveCheck: never = context;
        return _exhaustiveCheck;
    }
  }

  /**
   * ✅ Type-safe TTL configuration
   */
  private getTTLForContext(context: AppContext): number {
    switch (context) {
      case AppContext.ADMIN:
        return 5 * 60 * 1000; // 5 minutes - security focused
      case AppContext.TENANT:
        return 60 * 60 * 1000; // 1 hour - tenant data
      case AppContext.USER:
        return 15 * 60 * 1000; // 15 minutes - user session
      case AppContext.PRODUCT:
        return 30 * 60 * 1000; // 30 minutes - product data
      case AppContext.STORE:
        return 20 * 60 * 1000; // 20 minutes - store data
      case AppContext.SYSTEM:
        return 24 * 60 * 60 * 1000; // 24 hours - system config
    }
  }

  /**
   * ✅ Type-safe method overloads
   */
  async getAdminProducts() {
    return this.getProductsByContext(AppContext.ADMIN);
  }

  async getTenantProducts() {
    return this.getProductsByContext(AppContext.TENANT);
  }

  async getUserProducts() {
    return this.getProductsByContext(AppContext.USER);
  }
}

/**
 * ✅ TYPE-SAFE USAGE EXAMPLES
 */

// ✅ Correct usage - type-safe
const service = new TypeSafeProductSingleton('type-safe-products');

// ✅ All these are type-safe:
service.getProductsByContext(AppContext.ADMIN);    // Admin context
service.getProductsByContext(AppContext.TENANT);   // Tenant context  
service.getProductsByContext(AppContext.PRODUCT);  // Product context
service.getProductsByContext(AppContext.STORE);    // Store context
service.getProductsByContext(AppContext.USER);      // User context
service.getProductsByContext(AppContext.SYSTEM);    // System context

// ❌ TYPE ERRORS (caught at compile time):
// service.getProductsByContext('admin');        // Error: string not assignable to AppContext
// service.getProductsByContext('invalid');      // Error: invalid context
// service.getProductsByContext('product' as any); // Error: type any not allowed

/**
 * ✅ ENHANCED CACHE KEY GENERATION
 * 
 * Before: "products-api-data" (string-based)
 * After:  "products:/api/data:admin:admin:tenant-123" (enum-based, type-safe)
 */
const cacheKeyExamples = {
  // ✅ Type-safe cache keys generated automatically
  admin: 'products:/api/data:admin:admin:system',
  tenant: 'products:/api/data:tenant:tenant:tenant-456',
  user: 'products:/api/data:user:user:user-789',
  product: 'products:/api/data:product:global:',
  store: 'products:/api/data:store:global:location-123',
  system: 'products:/api/data:system:global:'
};

/**
 * ✅ MIGRATION BENEFITS
 */

// BEFORE (string literals - error prone)
class OldService {
  async getData() {
    return this.makeDefaultRequest('/api/data', undefined, 'data', undefined, {
      // ❌ String literals - typos possible
      context: 'admin', // Could be 'admiin' by mistake
      isolation: 'admin' // Could be 'addmin' by mistake
    });
  }
}

// AFTER (enum-based - type safe)
class NewService extends EnhancedFlexibleApiSingleton {
  async getData() {
    return this.makeEnhancedDefaultRequest('/api/data', undefined, undefined, undefined, {
      // ✅ Type-safe enums - compile-time checking
      context: AppContext.ADMIN, // Only valid values allowed
      isolation: CacheIsolation.ADMIN, // Only valid values allowed
    });
  }
}

export { TypeSafeProductSingleton, cacheKeyExamples };
