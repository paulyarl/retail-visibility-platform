import { logger } from '../logger';
import FeaturedProductsSingletonService from './FeaturedProductsSingletonService';

/**
 * Base Discovery Service - Smart routing for product discovery
 * 
 * Handles different discovery scopes:
 * - shop: Tenant-specific discovery (default)
 * - global: Cross-tenant discovery (shops directory)
 * 
 * Routes requests to appropriate service methods based on scope.
 */
export abstract class BaseDiscoveryService {
  protected baseService: FeaturedProductsSingletonService;
  protected logger: any;

  constructor() {
    this.baseService = FeaturedProductsSingletonService.getInstance();
    this.logger = logger;
  }

  /**
   * Smart routing for featured products discovery
   */
  protected async routeFeaturedProducts(options: {
    tenantId?: string;
    scope?: 'shop' | 'global';
    featuredType: string;
    limit?: number;
    sortBy?: 'priority' | 'featuredAt' | 'expiresAt';
    sortOrder?: 'asc' | 'desc';
  }) {
    const { tenantId, scope = 'shop', featuredType, limit = 12, sortBy = 'priority', sortOrder = 'desc' } = options;
    
    this.logger.info('[DISCOVERY] Routing featured products request', {
      tenantId,
      scope,
      featuredType,
      limit,
      sortBy,
      sortOrder
    } as any);

    let featuredProducts;

    // Default behavior: tenant-specific discovery
    if (scope === 'shop') {
      if (!tenantId) {
        throw new Error('tenantId is required for shop scope');
      }
      
      this.logger.info(`[DISCOVERY] Shop scope: fetching products for tenant ${tenantId}`);
      featuredProducts = await this.baseService.getFeaturedProductsByTenant(tenantId, {
        featuredType,
        isActive: true,
        limit,
        sortBy,
        sortOrder
      });
      
      // Additional tenant filtering for safety
      return featuredProducts.filter((fp: any) => fp.tenantId === tenantId);
    }
    
    // Global scope: cross-tenant discovery
    if (scope === 'global') {
      this.logger.info(`[DISCOVERY] Global scope: fetching ${featuredType} products from all tenants`);
      featuredProducts = await this.baseService.getFeaturedProductsByType(featuredType, {
        isActive: true,
        limit,
        sortBy,
        sortOrder
      });
      
      // Return ALL products for global scope (no tenant filtering)
      return featuredProducts;
    }
    
    throw new Error(`Unsupported scope: ${scope}. Use 'shop' or 'global'.`);
  }

  /**
   * Get shop identifiers for URL generation
   */
  protected async getShopIdentifiers(tenantId: string, slug?: string) {
    return this.baseService.getTenantIdentifiers(tenantId, slug);
  }

  /**
   * Validate discovery options
   */
  protected validateOptions(options: any, requiredFields: string[] = []) {
    for (const field of requiredFields) {
      if (!options[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  /**
   * Get bucket name from featured type (for mapping)
   */
  protected getBucketName(featuredType: string): string {
    const typeToBucket: Record<string, string> = {
      'store_selection': 'store_selection',
      'trending': 'trending', 
      'new_arrival': 'new',
      'sale': 'sale',
      'seasonal': 'seasonal',
      'staff_pick': 'staff',
      'bestseller': 'bestseller',
      'clearance': 'clearance',
      'featured': 'featured', 
      'random': 'random',
      'recommended': 'recommended',
      'selection': 'selection'
    };
    
    return typeToBucket[featuredType] || featuredType;
  }
}
