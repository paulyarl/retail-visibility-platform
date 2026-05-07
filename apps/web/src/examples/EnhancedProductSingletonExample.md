/**
 * Example: Enhanced Product Singleton using makeEnhancedDefaultRequest
 * 
 * Shows how existing makeDefaultRequest usage can be enhanced with zero migration
 */

import { EnhancedFlexibleApiSingleton, EnhancedCacheOptions } from '../base/EnhancedFlexibleApiSingleton';
import { RequestType, RequestTarget } from '../base/FlexibleApiSingleton';
import { CacheIsolation } from '../../utils/contextCacheManager';

/**
 * BEFORE: Existing ProductSingleton (continues to work unchanged)
 */
class ExistingProductSingleton extends FlexibleApiSingleton {
  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;

  async getProducts() {
    // Existing makeDefaultRequest usage - continues to work
    return this.makeDefaultRequest('/api/products');
  }

  async getProductById(id: string) {
    return this.makeDefaultRequest(`/api/products/${id}`, undefined, `product-${id}`);
  }
}

/**
 * AFTER: Enhanced ProductSingleton with context-aware caching
 */
class EnhancedProductSingleton extends EnhancedFlexibleApiSingleton {
  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;

  /**
   * Enhanced getProducts with tenant-aware caching
   */
  async getProductsEnhanced() {
    return this.makeEnhancedDefaultRequest('/api/products', undefined, undefined, undefined, {
      // Enhanced cache options
      context: 'product',
      isolation: CacheIsolation.GLOBAL,
      useTenantContext: true, // Auto-detect tenant
      compression: true,
      ttl: 30 * 60 * 1000, // 30 minutes
      priority: 'high'
    });
  }

  /**
   * Enhanced getProductById with user-specific caching
   */
  async getProductByIdEnhanced(id: string) {
    return this.makeEnhancedDefaultRequest(`/api/products/${id}`, undefined, `product-${id}`, undefined, {
      context: 'product',
      isolation: CacheIsolation.USER, // Per-user caching
      useAuthUser: true, // Auto-detect user
      compression: true,
      ttl: 15 * 60 * 1000, // 15 minutes
      priority: 'medium'
    });
  }

  /**
   * Mixed approach: Existing method + enhanced options
   */
  async getProductsWithTenantFallback(tenantId?: string) {
    return this.makeEnhancedDefaultRequest('/api/products', undefined, undefined, undefined, {
      context: 'product',
      isolation: CacheIsolation.TENANT,
      tenantId, // Explicit tenant or auto-detect
      useTenantContext: !tenantId, // Auto-detect if not provided
      compression: true,
      ttl: 60 * 60 * 1000, // 1 hour for tenant data
      priority: 'high'
    });
  }

  /**
   * Admin products with enhanced security
   */
  async getAdminProducts() {
    return this.makeEnhancedDefaultRequest('/api/admin/products', undefined, undefined, undefined, {
      requestType: RequestType.ADMIN, // Override default
      context: 'admin',
      isolation: CacheIsolation.ADMIN,
      useAuthUser: true, // Require authenticated user
      ttl: 5 * 60 * 1000, // 5 minutes for admin data
      priority: 'high'
    });
  }
}

/**
 * Migration Strategy Examples
 */

// STEP 1: Existing service continues unchanged
const existingService = new ExistingProductSingleton('products');
existingService.getProducts(); // ✅ Works exactly as before

// STEP 2: Gradually enhance specific methods
class PartiallyEnhancedProductSingleton extends EnhancedFlexibleApiSingleton {
  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;

  // Keep existing methods unchanged
  async getProducts() {
    return this.makeDefaultRequest('/api/products'); // ✅ Still works
  }

  // Enhance only new methods
  async getProductsEnhanced() {
    return this.makeEnhancedDefaultRequest('/api/products', undefined, undefined, undefined, {
      context: 'product',
      isolation: CacheIsolation.GLOBAL,
      useTenantContext: true
    });
  }
}

// STEP 3: Full enhancement when ready
const enhancedService = new EnhancedProductSingleton('enhanced-products');

// Enhanced cache keys generated automatically:
// - "products:/api/products:product:global:tenant-123"
// - "products:product-456:product:user:user-789"
// - "products:/api/products:product:tenant:tenant-123"

export { 
  ExistingProductSingleton, 
  EnhancedProductSingleton, 
  PartiallyEnhancedProductSingleton 
};
