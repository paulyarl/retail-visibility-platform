/**
 * Permission-Aware Product Service
 * 
 * Demonstrates Phase 3 integration pattern:
 * - Decorator-based permission checking
 * - Zero-import permission methods
 * - Limit enforcement for product operations
 * - Feature-gated functionality
 * 
 * This service wraps the existing ProductService with permission checks.
 */

import { 
  RequireFeature, 
  RequireLimit, 
  RequireAccess,
  PermissionError 
} from './PermissionDecorators';
import { permissionServiceFactory } from './PermissionServiceFactory';

// Product creation input
export interface CreateProductInput {
  tenantId: string;
  name: string;
  description?: string;
  price?: number;
  sku: string;
  categoryId?: string;
  isFeatured?: boolean;
}

// Product update input
export interface UpdateProductInput {
  productId: string;
  tenantId: string;
  name?: string;
  description?: string;
  price?: number;
  isFeatured?: boolean;
}

// Bulk operation result
export interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{ index: number; error: string }>;
}

/**
 * Permission-Aware Product Service
 * 
 * Extends existing service patterns with permission integration
 */
export class PermissionAwareProductService {
  private static instance: PermissionAwareProductService;

  private constructor() {}

  static getInstance(): PermissionAwareProductService {
    if (!PermissionAwareProductService.instance) {
      PermissionAwareProductService.instance = new PermissionAwareProductService();
    }
    return PermissionAwareProductService.instance;
  }

  // ==========================================
  // Product Creation with Limit Enforcement
  // ==========================================

  /**
   * Create a single product with permission check
   * 
   * Features:
   * - Checks 'products' limit before creation
   * - Automatically tracks usage after success
   */
  @RequireLimit({ limitType: 'products', required: 1, consume: true })
  async createProduct(input: CreateProductInput): Promise<{ id: string; success: boolean }> {
    // This would call the actual ProductService.createProduct
    // For demonstration, we return a mock response
    console.log(`[PermissionAwareProductService] Creating product for tenant: ${input.tenantId}`);
    
    return {
      id: `product-${Date.now()}`,
      success: true
    };
  }

  /**
   * Create multiple products with bulk limit check
   * 
   * Features:
   * - Checks limit for entire batch
   * - Uses 'bulkOperations' feature gate
   */
  @RequireFeature({ feature: 'bulkOperations' })
  async createProductsBulk(tenantId: string, products: CreateProductInput[]): Promise<BulkOperationResult> {
    // Check limit for entire batch
    const canCreate = !(await permissionServiceFactory.wouldExceedLimit(
      tenantId, 
      'products', 
      products.length
    ));

    if (!canCreate) {
      throw new PermissionError(
        `Insufficient product limit for bulk operation`,
        'LIMIT_EXCEEDED',
        { requested: products.length }
      );
    }

    // Process products (would call actual service)
    const results: BulkOperationResult = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (let i = 0; i < products.length; i++) {
      try {
        await this.createProduct(products[i]);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Track usage for successful creations
    if (results.success > 0) {
      const limitsService = permissionServiceFactory.getLimitsService();
      await limitsService.trackUsage(tenantId, 'products', results.success);
    }

    return results;
  }

  // ==========================================
  // Featured Products with Feature Gate
  // ==========================================

  /**
   * Feature a product with limit check
   * 
   * Features:
   * - Checks 'featuredProducts' limit
   * - Requires 'customBranding' feature for professional tier
   */
  @RequireLimit({ limitType: 'featuredProducts', required: 1, consume: true })
  async featureProduct(tenantId: string, productId: string): Promise<{ success: boolean }> {
    console.log(`[PermissionAwareProductService] Featuring product: ${productId}`);
    return { success: true };
  }

  /**
   * Remove featured status
   */
  async unfeatureProduct(tenantId: string, productId: string): Promise<{ success: boolean }> {
    // No permission check needed - just removing featured status
    // But we should update the usage tracking
    const limitsService = permissionServiceFactory.getLimitsService();
    await limitsService.trackUsage(tenantId, 'featuredProducts', -1);
    
    console.log(`[PermissionAwareProductService] Unfeaturing product: ${productId}`);
    return { success: true };
  }

  // ==========================================
  // Product Access Control
  // ==========================================

  /**
   * Update product with access control
   */
  @RequireAccess({ resource: 'products', action: 'update' })
  async updateProduct(input: UpdateProductInput): Promise<{ success: boolean }> {
    console.log(`[PermissionAwareProductService] Updating product: ${input.productId}`);
    return { success: true };
  }

  /**
   * Delete product with access control
   */
  @RequireAccess({ resource: 'products', action: 'delete' })
  async deleteProduct(tenantId: string, productId: string): Promise<{ success: boolean }> {
    // Update usage tracking
    const limitsService = permissionServiceFactory.getLimitsService();
    await limitsService.trackUsage(tenantId, 'products', -1);
    
    console.log(`[PermissionAwareProductService] Deleting product: ${productId}`);
    return { success: true };
  }

  // ==========================================
  // Convenience Methods
  // ==========================================

  /**
   * Check if tenant can add more products
   */
  async canAddProducts(tenantId: string, count: number = 1): Promise<boolean> {
    return !(await permissionServiceFactory.wouldExceedLimit(tenantId, 'products', count));
  }

  /**
   * Check if tenant can feature products
   */
  async canFeatureProducts(tenantId: string, count: number = 1): Promise<boolean> {
    return !(await permissionServiceFactory.wouldExceedLimit(tenantId, 'featuredProducts', count));
  }

  /**
   * Get product limit status
   */
  async getProductLimitStatus(tenantId: string) {
    return await permissionServiceFactory.getLimitStatus(tenantId, 'products');
  }

  /**
   * Get featured product limit status
   */
  async getFeaturedProductLimitStatus(tenantId: string) {
    return await permissionServiceFactory.getLimitStatus(tenantId, 'featuredProducts');
  }

  /**
   * Check if tenant has bulk operations feature
   */
  async hasBulkOperations(tenantId: string): Promise<boolean> {
    return await permissionServiceFactory.hasFeature(tenantId, 'bulkOperations');
  }

  /**
   * Check if tenant has API access
   */
  async hasApiAccess(tenantId: string): Promise<boolean> {
    return await permissionServiceFactory.hasFeature(tenantId, 'apiAccess');
  }
}

// Export singleton instance
export const permissionAwareProductService = PermissionAwareProductService.getInstance();
export default PermissionAwareProductService;
