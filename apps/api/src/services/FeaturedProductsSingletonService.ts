/**
 * Featured Products Service - UniversalSingleton Implementation
 * Handles product featuring, marketing features, and quality scoring
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { prisma } from '../prisma';

// Featured Product Types
export interface FeaturedProduct {
  id: string;
  inventoryItemId?: string;
  tenantId: string;
  featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  priority: number;
  featuredAt: Date;
  expiresAt?: Date;
  autoUnfeature: boolean;
  isActive: boolean;
  tenantName?: string;
  tenantLogoUrl?: string;
}

export interface FeaturedProductFilter {
  tenantId?: string;
  featuredType?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'featuredAt' | 'priority' | 'expiresAt';
  sortOrder?: 'asc' | 'desc';
}

export interface FeaturedProductStats {
  totalFeatured: number;
  byType: Record<string, number>;
  byTenant: Record<string, number>;
  expiringSoon: number;
  expired: number;
  averagePriority: number;
}

export interface FeaturedProductCreateRequest {
  inventoryItemId?: string;
  tenantId: string;
  featuredType: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  priority?: number;
  expiresAt?: Date;
  autoUnfeature?: boolean;
}

export interface FeaturedProductUpdateRequest {
  featuredType?: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  priority?: number;
  expiresAt?: Date;
  autoUnfeature?: boolean;
  isActive?: boolean;
}

class FeaturedProductsSingletonService extends UniversalSingleton {
  private static instance: FeaturedProductsSingletonService;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'public',
      defaultTTL: 1800, // 30 minutes
      maxCacheSize: 500,
      enableMetrics: true,
      enableLogging: true
    });
  }

  static getInstance(): FeaturedProductsSingletonService {
    if (!FeaturedProductsSingletonService.instance) {
      FeaturedProductsSingletonService.instance = new FeaturedProductsSingletonService('featured-products-service');
    }
    return FeaturedProductsSingletonService.instance;
  }

  // ====================
  // CORE FEATURED PRODUCT OPERATIONS
  // ====================

  /**
   * Create a new featured product
   */
  async createFeaturedProduct(request: FeaturedProductCreateRequest): Promise<FeaturedProduct> {
    try {
      let inventoryItemId = request.inventoryItemId;

      // If no inventory item is provided, find an existing one from the tenant
      if (!inventoryItemId) {
        const existingInventory = await prisma.inventory_items.findFirst({
          where: {
            tenant_id: request.tenantId,
            item_status: 'active'
          },
          orderBy: {
            created_at: 'desc'
          }
        });
        
        if (!existingInventory) {
          throw new Error(`No active inventory items found for tenant ${request.tenantId}. Please provide an inventoryItemId.`);
        }
        
        inventoryItemId = existingInventory.id;
        console.log(`Using existing inventory item: ${inventoryItemId} for featured product`);
      } else {
        // Check if the provided inventory item exists
        const inventoryItem = await prisma.inventory_items.findUnique({
          where: { id: inventoryItemId }
        });
        
        if (!inventoryItem) {
          throw new Error(`Inventory item ${inventoryItemId} not found`);
        }
      }

      const featuredProduct = await prisma.featured_products.create({
        data: {
          inventory_item_id: inventoryItemId,
          tenant_id: request.tenantId,
          featured_type: request.featuredType,
          featured_priority: request.priority || 1,
          featured_at: new Date(),
          featured_expires_at: request.expiresAt,
          auto_unfeature: request.autoUnfeature || false,
          is_active: true
        }
      });

      const mappedProduct = this.mapPrismaFeaturedProduct(featuredProduct);
      
      // Cache the new featured product
      const cacheKey = `featured-product-${featuredProduct.id}`;
      await this.setCache(cacheKey, mappedProduct);

      this.logInfo('Featured product created successfully', { 
        featuredProductId: featuredProduct.id, 
        tenantId: request.tenantId,
        inventoryItemId
      });
      
      return mappedProduct;
    } catch (error) {
      this.logError('Error creating featured product', error);
      throw error;
    }
  }

  /**
   * Get featured product by ID
   */
  async getFeaturedProduct(featuredProductId: string): Promise<FeaturedProduct | null> {
    try {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(featuredProductId)) {
        console.warn(`Invalid UUID format for featured product ID: ${featuredProductId}`);
        return null;
      }

      const cacheKey = `featured-product-${featuredProductId}`;
      const cached = await this.getFromCache<FeaturedProduct>(cacheKey);
      if (cached) {
        return cached;
      }

      const featuredProduct = await prisma.featured_products.findUnique({
        where: { id: featuredProductId },
        include: {
          inventory_items: {
            select: {
              id: true,
              title: true,
              sku: true,
              image_url: true
            }
          }
        }
      });

      if (!featuredProduct) {
        return null;
      }

      const mappedProduct = this.mapPrismaFeaturedProduct(featuredProduct);
      await this.setCache(cacheKey, mappedProduct);
      
      return mappedProduct;
    } catch (error) {
      this.logError('Error fetching featured product', error);
      throw error;
    }
  }

  /**
   * Update a featured product
   */
  async updateFeaturedProduct(featuredProductId: string, updates: FeaturedProductUpdateRequest): Promise<FeaturedProduct> {
    try {
      const existingFeaturedProduct = await prisma.featured_products.findUnique({
        where: { id: featuredProductId }
      });

      if (!existingFeaturedProduct) {
        throw new Error('Featured product not found');
      }

      const featuredProduct = await prisma.featured_products.update({
        where: { id: featuredProductId },
        data: {
          featured_type: updates.featuredType,
          featured_priority: updates.priority,
          featured_expires_at: updates.expiresAt,
          auto_unfeature: updates.autoUnfeature,
          is_active: updates.isActive !== undefined ? updates.isActive : existingFeaturedProduct.is_active
        }
      });

      const mappedProduct = this.mapPrismaFeaturedProduct(featuredProduct);
      
      // Update cache
      const cacheKey = `featured-product-${featuredProductId}`;
      await this.setCache(cacheKey, mappedProduct);

      this.logInfo('Featured product updated successfully', { featuredProductId });
      
      return mappedProduct;
    } catch (error) {
      this.logError('Error updating featured product', error);
      throw error;
    }
  }

  /**
   * Delete a featured product
   */
  async deleteFeaturedProduct(featuredProductId: string): Promise<void> {
    try {
      const featuredProduct = await prisma.featured_products.findUnique({
        where: { id: featuredProductId }
      });

      if (!featuredProduct) {
        throw new Error('Featured product not found');
      }

      await prisma.featured_products.delete({
        where: { id: featuredProductId }
      });

      // Clear cache
      const cacheKey = `featured-product-${featuredProductId}`;
      await this.clearCache(cacheKey);

      this.logInfo('Featured product deleted successfully', { featuredProductId });
    } catch (error) {
      this.logError('Error deleting featured product', error);
      throw error;
    }
  }

  /**
   * List featured products with filtering
   */
  async listFeaturedProducts(filters: FeaturedProductFilter = {}): Promise<FeaturedProduct[]> {
    try {
      const cacheKey = `featured-products-list-${JSON.stringify(filters)}`;
      const cached = await this.getFromCache<FeaturedProduct[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const where: any = {};
      
      if (filters.tenantId) where.tenant_id = filters.tenantId;
      if (filters.featuredType) where.featured_type = filters.featuredType;
      if (filters.isActive !== undefined) where.is_active = filters.isActive;

      const orderBy: any = {};
      if (filters.sortBy) {
        const field = filters.sortBy === 'featuredAt' ? 'featured_at' : 
                     filters.sortBy === 'priority' ? 'featured_priority' : 
                     filters.sortBy === 'expiresAt' ? 'featured_expires_at' : 'featured_at';
        orderBy[field] = filters.sortOrder || 'desc';
      } else {
        orderBy.featured_at = 'desc';
      }

      // Use mv_global_discovery for all cases since it has complete data including logos
      let query = `
        SELECT 
          inventory_item_id as id,
          inventory_item_id,
          product_name,
          product_title,
          sku,
          image_url,
          brand,
          current_price_cents,
          sale_price_cents,
          stock,
          tenant_id,
          tenant_name,
          tenant_logo_url,
          featured_type,
          featured_priority,
          featured_at
        FROM mv_global_discovery
        WHERE featured_is_active = true
      `;
      
      let queryParams: any[] = [];
      
      // Add featured type filter if specified
      if (filters.featuredType) {
        query += ` AND featured_type = $${queryParams.length + 1}`;
        queryParams.push(filters.featuredType);
      }
      
      // Add tenant filter if specified
      if (filters.tenantId) {
        query += ` AND tenant_id = $${queryParams.length + 1}`;
        queryParams.push(filters.tenantId);
      }
      
      // Add ordering
      if (filters.sortBy === 'priority') {
        query += ` ORDER BY featured_priority DESC`;
      } else {
        query += ` ORDER BY featured_at DESC`;
      }
      
      // Add limit and offset
      if (filters.limit) {
        query += ` LIMIT $${queryParams.length + 1}`;
        queryParams.push(filters.limit);
      }
      if (filters.offset) {
        query += ` OFFSET $${queryParams.length + 1}`;
        queryParams.push(filters.offset);
      }
      
      const { getDirectPool } = await import('../utils/db-pool');
      const pool = getDirectPool();
      const featuredProducts = await pool.query(query, queryParams);

      const mappedProducts = featuredProducts.rows.map(fp => this.mapPrismaFeaturedProduct(fp));
      await this.setCache(cacheKey, mappedProducts);
      
      return mappedProducts;
    } catch (error) {
      this.logError('Error listing featured products', error);
      throw error;
    }
  }

  /**
   * Get featured products by tenant
   */
  async getFeaturedProductsByTenant(tenantId: string, filters: Omit<FeaturedProductFilter, 'tenantId'> = {}): Promise<FeaturedProduct[]> {
    return this.listFeaturedProducts({
      ...filters,
      tenantId,
      isActive: true
    });
  }

  /**
   * Get featured products by type
   */
  async getFeaturedProductsByType(featuredType: string, filters: Omit<FeaturedProductFilter, 'featuredType'> = {}): Promise<FeaturedProduct[]> {
    return this.listFeaturedProducts({
      ...filters,
      featuredType,
      isActive: true
    });
  }

  // ====================
  // FEATURED PRODUCT ANALYTICS
  // ====================

  /**
   * Get featured products statistics
   */
  async getFeaturedProductsStats(tenantId?: string): Promise<FeaturedProductStats> {
    try {
      const cacheKey = `featured-products-stats-${tenantId || 'all'}`;
      const cached = await this.getFromCache<FeaturedProductStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const where = tenantId ? { tenant_id: tenantId } : {};

      const [totalResult, typeCounts, tenantCounts, expiringSoon, expired, avgPriority] = await Promise.all([
        prisma.featured_products.count({ where }),
        prisma.featured_products.groupBy({
          by: ['featured_type'],
          where,
          _count: { featured_type: true }
        }),
        prisma.featured_products.groupBy({
          by: ['tenant_id'],
          where,
          _count: { tenant_id: true }
        }),
        prisma.featured_products.count({
          where: {
            ...where,
            is_active: true,
            featured_expires_at: {
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
              gte: new Date()
            }
          }
        }),
        prisma.featured_products.count({
          where: {
            ...where,
            is_active: true,
            featured_expires_at: {
              lt: new Date()
            }
          }
        }),
        prisma.featured_products.aggregate({
          where,
          _avg: { featured_priority: true }
        })
      ]);

      // Build type counts
      const typeMap = typeCounts.reduce((acc, item) => {
        acc[item.featured_type] = item._count.featured_type;
        return acc;
      }, {} as Record<string, number>);

      // Build tenant counts
      const tenantMap = tenantCounts.reduce((acc, item) => {
        acc[item.tenant_id] = item._count.tenant_id;
        return acc;
      }, {} as Record<string, number>);

      const stats: FeaturedProductStats = {
        totalFeatured: totalResult,
        byType: typeMap,
        byTenant: tenantMap,
        expiringSoon,
        expired,
        averagePriority: avgPriority._avg.featured_priority || 0
      };

      await this.setCache(cacheKey, stats);
      return stats;
    } catch (error) {
      this.logError('Error fetching featured products stats', error);
      throw error;
    }
  }

  // ====================
  // HELPER METHODS
  // ====================

  /**
   * Map Prisma featured product to FeaturedProduct interface
   */
  private mapPrismaFeaturedProduct(mvProduct: any): FeaturedProduct {
    return {
      id: mvProduct.id,
      inventoryItemId: mvProduct.inventory_item_id,
      tenantId: mvProduct.tenant_id,
      featuredType: mvProduct.featured_type,
      priority: mvProduct.featured_priority,
      featuredAt: mvProduct.featured_at,
      expiresAt: undefined, // MVs don't have expires_at field
      autoUnfeature: false, // MVs don't have auto_unfeature field
      isActive: true, // MVs only return active products
      // Add tenant information for display
      tenantName: mvProduct.tenant_name,
      tenantLogoUrl: mvProduct.tenant_logo_url
    };
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      featuredProductsCreated: this.metrics.cacheHits,
      featuredProductsUpdated: this.metrics.cacheMisses,
      averagePriority: 2.5, // This would be calculated from actual data
      expiringSoonCount: 0
    };
  }
}

export default FeaturedProductsSingletonService;
