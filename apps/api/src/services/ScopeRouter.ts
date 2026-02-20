import UniversalSingleton from '../lib/UniversalSingleton';
import FeaturedProductsSingletonService from './FeaturedProductsSingletonService';
import ShopsFeaturedService from './ShopsFeaturedService';
import { PrismaClient } from '@prisma/client';
import { transformProductsWithVariants, ProductWithVariants } from '../utils/variant-transformer';

/**
 * Scope Router - Handles different discovery scopes with smart routing
 * 
 * Supported scopes:
 * - shop: Tenant-specific discovery (default)
 * - global: Cross-tenant discovery (shops directory)
 * - location: Location-based discovery (future)
 * - category: Category-based discovery (future)
 * - timezone: Timezone-based discovery (future)
 */
export interface DiscoveryOptions {
  scope?: 'shop' | 'global' | 'location' | 'category' | 'timezone';
  tenantId?: string;
  limit?: number;
  sortBy?: 'priority' | 'featuredAt' | 'expiresAt' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  
  // Location-based filters (future)
  location?: {
    latitude: any;
    longitude: any;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    radius?: number; // miles
  };
  
  // Category-based filters
  category?: {
    // Product category filters
    productId?: string;
    productName?: string;
    googleProductId?: string;
    
    // Shop category filters (GBP-based)
    shopCategoryId?: string;
    shopCategoryName?: string;
    shopGoogleCategoryId?: string;
    
    // Category type - specifies which category to use for filtering
    categoryType?: 'product' | 'shop' | 'both';
  };
  
  // Timezone-based filters (future)
  timezone?: {
    timezone?: string;
    offset?: number;
  };
  
  // Additional filters
  filters?: {
    priceRange?: [number, number];
    inStock?: boolean;
    featuredTypes?: string[];
  };
}

export class ScopeRouter extends UniversalSingleton {
  private static instance: ScopeRouter;
  private shopsService: ShopsFeaturedService;
  private baseService: FeaturedProductsSingletonService;
  private prisma: PrismaClient;

  private constructor() {
    super('ScopeRouter', {
      enableCache: true,
      defaultTTL: 300, // 5 minutes for discovery results
      maxCacheSize: 1000,
      enableMetrics: true,
      enableLogging: true
    });
    
    this.shopsService = ShopsFeaturedService.getInstance();
    this.baseService = FeaturedProductsSingletonService.getInstance();
    this.prisma = new PrismaClient();
  }

  static getInstance(): ScopeRouter {
    if (!ScopeRouter.instance) {
      ScopeRouter.instance = new ScopeRouter();
    }
    return ScopeRouter.instance;
  }

  /**
   * Route discovery request based on scope with caching
   */
  async routeDiscovery(bucketType: string, options: DiscoveryOptions) {
    // Apply defaults and fallbacks
    const resolvedOptions = this.resolveDefaults(bucketType, options);
    const { scope = 'shop' } = resolvedOptions;
    
    // Generate cache key from bucket type and options
    const cacheKey = `discovery:${bucketType}:${scope}:${JSON.stringify(resolvedOptions)}`;
    
    // Try cache first
    const cached = await this.getFromCache<any>(cacheKey);
    if (cached) {
   //   this.logInfo('Cache hit for discovery', { bucketType, scope });
      return cached;
    }
    
    /* this.logInfo('Routing discovery request', {
      bucketType,
      scope,
      tenantId: resolvedOptions.tenantId,
      limit: resolvedOptions.limit,
      resolvedFrom: options.scope || 'default'
    }); */

    try {
      // Execute with retry logic for reliability
      const result = await this.retry(async () => {
        switch (scope) {
          case 'shop':
            return this.handleShopScope(bucketType, resolvedOptions);
          case 'global':
            return this.handleGlobalScope(bucketType, resolvedOptions);
          case 'location':
            return this.handleLocationScope(bucketType, resolvedOptions);
          case 'category':
            return this.handleCategoryScope(bucketType, resolvedOptions);
          case 'timezone':
            return this.handleTimezoneScope(bucketType, resolvedOptions);
          default:
            this.logWarning(`Unknown scope: ${scope}, falling back to global`);
            return this.handleGlobalScope(bucketType, { ...resolvedOptions, scope: 'global' });
        }
      });

      // Cache the result
      await this.setCache(cacheKey, result, { ttl: 300 });
      
      return result;
    } catch (error) {
      this.logError(`Error in scope ${scope}, falling back to global`, error);
      return this.handleGlobalScope(bucketType, { ...resolvedOptions, scope: 'global' });
    }
  }

  /**
   * Resolve defaults and fallbacks for discovery options
   */
  private resolveDefaults(bucketType: string, options: DiscoveryOptions): DiscoveryOptions {
    const defaults = {
      scope: 'shop',
      limit: 12,
      sortBy: 'priority' as const,
      sortOrder: 'desc' as const,
      categoryType: 'product' as const
    };

    // Smart scope resolution
    const initialScope = options.scope || defaults.scope;
    let resolvedScope: 'shop' | 'global' | 'location' | 'category' | 'timezone' = initialScope as any;
    
    // If no tenantId provided, fallback from shop to global
    if (resolvedScope === 'shop' && !options.tenantId) {
      resolvedScope = 'global';
//      this.logInfo('[SCOPE ROUTER] No tenantId provided, falling back from shop to global scope');
    }

    // Smart bucket type resolution
    const resolvedBucketType = this.resolveBucketType(bucketType);

    // Handle category scope defaults
    const resolvedCategory = this.resolveCategoryDefaults(resolvedScope, options.category);

    return {
      ...defaults,
      ...options,
      scope: resolvedScope,
      category: resolvedCategory,
      limit: options.limit || defaults.limit,
      sortBy: options.sortBy || defaults.sortBy,
      sortOrder: options.sortOrder || defaults.sortOrder
    };
  }

  /**
   * Resolve category defaults with random category selection
   */
  private resolveCategoryDefaults(scope: string, category: any): any {
    if (scope !== 'category' || !category) {
      return category;
    }

    const categoryType = category?.categoryType || 'product';
    let resolvedCategory = { ...category, categoryType };

    // If category scope but no category identifiers provided, select random categories
    const hasProductCategory = category?.productName || category?.productId || category?.googleProductId;
    const hasShopCategory = category?.shopCategoryName || category?.shopCategoryId || category?.shopGoogleCategoryId;

    if (!hasProductCategory && !hasShopCategory) {
      this.logInfo('[SCOPE ROUTER] No category provided, selecting random categories');
      
      if (categoryType === 'product' || categoryType === 'both') {
        resolvedCategory.productName = 'random';
        this.logInfo('[SCOPE ROUTER] Selected random product category');
      }
      
      if (categoryType === 'shop' || categoryType === 'both') {
        resolvedCategory.shopCategoryName = 'random';
        this.logInfo('[SCOPE ROUTER] Selected random shop category');
      }
    }

    return resolvedCategory;
  }

  /**
   * Resolve bucket type with fallbacks
   */
  private resolveBucketType(bucketType: string): string {
    const validBucketTypes = ['random', 'trending', 'new', 'sale', 'seasonal', 'staff', 'selection'];
    
    if (!bucketType) {
      this.logInfo('[SCOPE ROUTER] No bucketType provided, defaulting to trending');
      return 'trending';
    }
    
    if (!validBucketTypes.includes(bucketType)) {
      this.logWarning(`[SCOPE ROUTER] Invalid bucketType: ${bucketType}, falling back to trending`);
      return 'trending';
    }
    
    return bucketType;
  }

  /**
   * Handle shop-specific discovery
   */
  private async handleShopScope(bucketType: string, options: DiscoveryOptions) {
    const { tenantId, limit = 12, sortBy = 'priority', sortOrder = 'desc' } = options;
    
    if (!tenantId) {
      throw new Error('tenantId is required for shop scope');
    }

    this.logInfo(`[SCOPE ROUTER] Shop scope: fetching ${bucketType} for tenant ${tenantId}`);

    switch (bucketType) {
      case 'random':
        return this.shopsService.getShopRandomProducts({
          tenantId,
          limit,
          shopScope: 'shop'
        });
      case 'trending':
        return this.shopsService.getShopTrendingProducts({
          tenantId,
          limit,
          shopScope: 'shop'
        });
      case 'new':
        return this.shopsService.getShopNewProducts({
          tenantId,
          limit,
          shopScope: 'shop'
        });
      case 'sale':
        return this.shopsService.getShopSaleProducts({
          tenantId,
          limit,
          shopScope: 'shop'
        });
      case 'seasonal':
        return this.shopsService.getShopSeasonalProducts({
          tenantId,
          limit,
          shopScope: 'shop'
        });
      case 'staff':
        return this.shopsService.getShopStaffPicks({
          tenantId,
          limit,
          shopScope: 'shop'
        });
      case 'selection':
        return this.shopsService.getShopStoreSelections({
          tenantId,
          limit,
          shopScope: 'shop'
        });
      case 'random':
        return this.shopsService.getGlobalRandomProducts({
          limit
        });
      case 'random-weighted':
        return this.shopsService.getGlobalRandomProductsWeighted({
          limit
        });
      default:
        throw new Error(`Unknown bucket type: ${bucketType}`);
    }
  }

  /**
   * Handle global discovery (cross-tenant)
   */
  private async handleGlobalScope(bucketType: string, options: DiscoveryOptions) {
    const { limit = 12, sortBy = 'priority', sortOrder = 'desc' } = options;

    this.logInfo(`[SCOPE ROUTER] Global scope: fetching ${bucketType} from all tenants`);

    switch (bucketType) {
      case 'random':
        return this.shopsService.getShopRandomProducts({
          limit,
          shopScope: 'global'
        });
      case 'trending':
        return this.shopsService.getShopTrendingProducts({
          limit,
          shopScope: 'global'
        });
      case 'new':
        return this.shopsService.getShopNewProducts({
          limit,
          shopScope: 'global'
        });
      case 'sale':
        return this.shopsService.getShopSaleProducts({
          limit,
          shopScope: 'global'
        });
      case 'seasonal':
        return this.shopsService.getShopSeasonalProducts({
          limit,
          shopScope: 'global'
        });
      case 'staff':
        return this.shopsService.getShopStaffPicks({
          limit,
          shopScope: 'global'
        });
      case 'selection':
        return this.shopsService.getShopStoreSelections({
          limit,
          shopScope: 'global'
        });
      case 'random':
        return this.shopsService.getGlobalRandomProducts({
          limit
        });
      case 'random-weighted':
        return this.shopsService.getGlobalRandomProductsWeighted({
          limit
        });
      default:
        throw new Error(`Unknown bucket type: ${bucketType}`);
    }
  }

  /**
   * Handle location-based discovery (Phase 5C)
   * Supports two modes:
   * 1. Radius search using latitude/longitude coordinates (requires earthdistance)
   * 2. Direct filtering by city/state/zip (no geocoding needed)
   */
  private async handleLocationScope(bucketType: string, options: DiscoveryOptions) {
    const { location, limit = 12 } = options;
    
    if (!location) {
      throw new Error('Location filter is required for location scope');
    }

    // If coordinates provided, use radius search with earthdistance
    if (location.latitude && location.longitude) {
      const radius = location.radius || 25; // Default 25 miles

      this.logInfo(`[SCOPE ROUTER] Location scope (radius): fetching ${bucketType} within ${radius} miles`, {
        latitude: location.latitude,
        longitude: location.longitude,
        radius,
        bucketType,
        limit
      } as any);

      return this.shopsService.getProductsByLocation({
        city: location.city,
        state: location.state,
        limit
      });
    } 
    // Otherwise, use direct database filtering by city/state/zip (no geocoding)
    else if (location.city || location.state || location.zip) {
      this.logInfo(`[SCOPE ROUTER] Location scope (address): fetching ${bucketType} by address`, {
        city: location.city,
        state: location.state,
        zip: location.zip,
        bucketType,
        limit
      } as any);

      return this.shopsService.getProductsByLocationAddress({
        address: `${location.city || ''}${location.city && location.state ? ', ' : ''}${location.state || ''}`,
        limit
      });
    } else {
      throw new Error('Location filter requires either coordinates (latitude/longitude) or address (city/state/zip)');
    }
  }

  /**
   * Handle category-based discovery
   * Supports both product categories and shop categories (GBP-based)
   */
  private async handleCategoryScope(bucketType: string, options: DiscoveryOptions) {
    const { category, limit = 12 } = options;
    
    if (!category) {
      throw new Error('Category filter is required for category scope');
    }

    // Determine if filtering by product category or shop category
    const hasProductCategory = category.productName || category.productId;
    const hasShopCategory = category.shopCategoryName || category.shopCategoryId;
    
    this.logInfo(`[SCOPE ROUTER] Category scope: fetching ${bucketType}`, {
      hasProductCategory,
      hasShopCategory,
      category,
      bucketType,
      limit
    } as any);

    // Product category takes precedence
    if (hasProductCategory) {
      return this.shopsService.getProductsByProductCategory({
        category: category.productName,
        limit
      });
    } else if (hasShopCategory) {
      return this.shopsService.getProductsByShopCategory({
        category: category.shopCategoryName,
        limit
      });
    } else {
      throw new Error('Category filter requires either productName/productId or shopCategoryName/shopCategoryId');
    }
  }

  /**
   * Resolve random category selection
   */
  private async resolveRandomCategory(category: any): Promise<any> {
    const resolvedCategory = { ...category };

    // Handle random product category selection
    if (category.productName === 'random') {
      const randomProductCategory = await this.getRandomProductCategory();
      resolvedCategory.productName = randomProductCategory;
      this.logInfo(`[SCOPE ROUTER] Selected random product category: ${randomProductCategory}`);
    }

    // Handle random shop category selection
    if (category.shopCategoryName === 'random') {
      const randomShopCategory = await this.getRandomShopCategory();
      resolvedCategory.shopCategoryName = randomShopCategory;
      this.logInfo(`[SCOPE ROUTER] Selected random shop category: ${randomShopCategory}`);
    }

    return resolvedCategory;
  }

  /**
   * Get a random product category from available categories
   */
  private async getRandomProductCategory(): Promise<string> {
    try {
      // Get available product categories from the database
      const categories = await this.prisma?.platform_categories.findMany({
        where: { is_active: true },
        select: { name: true },
        orderBy: { name: 'asc' }
      });

      if (!categories || categories.length === 0) {
        this.logWarning('[SCOPE ROUTER] No product categories found, defaulting to "Electronics"');
        return 'Electronics';
      }

      // Select random category
      const randomIndex = Math.floor(Math.random() * categories.length);
      const randomCategory = categories[randomIndex].name;
      
      this.logInfo(`[SCOPE ROUTER] Randomly selected product category: ${randomCategory} from ${categories.length} available`);
      return randomCategory;
    } catch (error) {
      this.logError('[SCOPE ROUTER] Error getting random product category', error);
      return 'Electronics'; // Safe fallback
    }
  }

  /**
   * Get a random shop category from available GBP categories
   */
  private async getRandomShopCategory(): Promise<string> {
    try {
      // Common GBP categories as fallback
      const commonShopCategories = [
        'Restaurant',
        'Retail Store',
        'Electronics Store',
        'Clothing Store',
        'Bookstore',
        'Grocery',
        'Pharmacy',
        'Hardware Store',
        'Beauty Salon',
        'Fitness Center',
        'Auto Repair',
        'Pet Store',
        'Bakery',
        'Coffee Shop',
        'Gas Station'
      ];

      // Try to get actual shop categories from database
      const shops = await this.prisma?.tenants.findMany({
        where: { 
          metadata: {
            path: ['category'],
            not: undefined
          }
        },
        select: { metadata: true },
        take: 100
      });

      if (shops && shops.length > 0) {
        // Extract unique categories from shop metadata
        const extractedCategories = new Set<string>();
        shops.forEach((shop: any) => {
          const metadata = shop.metadata as any;
          if (metadata?.category) {
            extractedCategories.add(metadata.category);
          }
        });

        if (extractedCategories.size > 0) {
          const categoryArray = Array.from(extractedCategories);
          const randomIndex = Math.floor(Math.random() * categoryArray.length);
          const randomCategory = categoryArray[randomIndex];
          
          this.logInfo(`[SCOPE ROUTER] Randomly selected shop category: ${randomCategory} from ${categoryArray.length} available`);
          return randomCategory;
        }
      }

      // Fallback to common categories
      const randomIndex = Math.floor(Math.random() * commonShopCategories.length);
      const randomCategory = commonShopCategories[randomIndex];
      
      this.logInfo(`[SCOPE ROUTER] Randomly selected fallback shop category: ${randomCategory}`);
      return randomCategory;
    } catch (error) {
      this.logError('[SCOPE ROUTER] Error getting random shop category', error);
      return 'Retail Store'; // Safe fallback
    }
  }
  /**
   * Get featured products by product category (MV-OPTIMIZED with RICH DATA)
   */
  private async getFeaturedProductsByProductCategory(category: {
    productId?: string;
    productName?: string;
    googleProductId?: string;
  }, options: {
    featuredType?: string;
    isActive?: boolean;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { featuredType, isActive = true, limit = 12, sortBy = 'priority', sortOrder = 'desc' } = options;
    
    this.logInfo(`[SCOPE ROUTER] Getting products by product category: ${category.productName}`, {
      category,
      limit
    } as any);

    try {
      // Use optimized MV for product category discovery
      let whereConditions = [];
      let params: any[] = [];
      
      // Filter by category type (product or both)
      whereConditions.push(`category_type IN ('product', 'both')`);
      
      // Filter by active status
      if (isActive) {
        whereConditions.push(`featured_is_active = true`);
      }

      // Add category filtering conditions
      if (category.productName) {
        whereConditions.push(`product_category_name_lower ILIKE $${params.length + 1}`);
        params.push(`%${category.productName.toLowerCase()}%`);
      }
      
      if (category.productId) {
        whereConditions.push(`category_id = $${params.length + 1}`);
        params.push(category.productId);
      }
      
      if (category.googleProductId) {
        whereConditions.push(`product_google_category_id = $${params.length + 1}`);
        params.push(category.googleProductId);
      }

      // Filter by featured type if specified
      if (featuredType) {
        whereConditions.push(`featured_type = $${params.length + 1}`);
        params.push(featuredType);
      }

      // Build ORDER BY clause
      const orderBy = sortBy === 'priority' ? 'featured_priority DESC, featured_at DESC' :
                     sortBy === 'featuredAt' ? 'featured_at DESC' :
                     sortBy === 'expiresAt' ? 'featured_until DESC' :
                     sortBy === 'trending' ? 'trending_score DESC' :
                     'featured_priority DESC';

      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Execute optimized MV query with rich product data + variants
      const query = `
        SELECT 
          -- Basic Product Information
          mcd.inventory_item_id,
          mcd.product_name,
          mcd.product_title,
          mcd.product_description,
          mcd.sku,
          mcd.brand,
          mcd.stock,
          mcd.availability,
          mcd.weight,
          mcd.dimensions,
          mcd.tags,
          
          -- RICH PRICING DATA
          mcd.current_price_cents,
          mcd.list_price_cents,
          mcd.sale_price_cents,
          mcd.compare_at_price_cents,
          mcd.currency,
          mcd.cost_per_item_cents,
          mcd.margin_cents,
          mcd.discount_percentage,
          
          -- VARIANT METADATA
          mcd.variant_id,
          mcd.variant_name,
          mcd.variant_sku,
          mcd.variant_options,
          mcd.variant_color,
          mcd.variant_size,
          mcd.variant_material,
          mcd.variant_style,
          mcd.variant_weight,
          mcd.variant_price_cents,
          mcd.variant_compare_at_price_cents,
          mcd.variant_inventory_quantity,
          
          -- PRODUCT TYPE AND CLASSIFICATION
          mcd.product_type,
          mcd.product_category,
          mcd.product_subcategory,
          mcd.is_digital_product,
          mcd.is_physical_product,
          mcd.is_service,
          mcd.is_variant,
          mcd.is_bundle,
          mcd.is_customizable,
          mcd.is_trackable,
          mcd.is_taxable,
          mcd.is_shipping_required,
          
          -- MEDIA AND ASSETS
          mcd.image_url,
          mcd.image_urls,
          mcd.video_url,
          mcd.gallery_urls,
          mcd.thumbnail_url,
          mcd.featured_image_url,
          
          -- RICH METADATA
          mcd.product_metadata,
          mcd.specifications,
          mcd.attributes,
          mcd.custom_fields,
          mcd.search_keywords,
          mcd.seo_title,
          mcd.seo_description,
          mcd.seo_keywords,
          
          -- INVENTORY AND STOCK
          mcd.inventory_quantity,
          mcd.inventory_policy,
          mcd.inventory_tracking,
          mcd.inventory_quantity_tracked,
          mcd.allow_backorder,
          mcd.backorder_quantity,
          mcd.low_stock_threshold,
          mcd.requires_shipping,
          mcd.weight_unit,
          mcd.length,
          mcd.width,
          mcd.height,
          mcd.dimension_unit,
          
          -- FEATURED INFORMATION (ENHANCED)
          mcd.featured_type,
          mcd.featured_type_array,
          mcd.featured_priority,
          mcd.featured_at,
          mcd.featured_until,
          mcd.featured_is_active,
          mcd.is_actively_featured,
          mcd.featured_metadata,
          
          -- Category Information
          mcd.category_id,
          mcd.category_name,
          mcd.category_slug,
          mcd.product_google_category_id,
          mcd.category_description,
          mcd.category_image_url,
          mcd.parent_category_id,
          mcd.category_level,
          mcd.category_is_active,
          mcd.category_path,
          mcd.category_path_slugs,
          
          -- Tenant Information
          mcd.tenant_id,
          mcd.tenant_name,
          mcd.tenant_slug,
          mcd.shop_category,
          mcd.shop_category_id,
          mcd.shop_google_category_id,
          
          -- Location Information
          mcd.city,
          mcd.state,
          mcd.country,
          mcd.latitude,
          mcd.longitude,
          mcd.timezone,
          
          -- BUSINESS INFORMATION
          mcd.business_type,
          mcd.business_category,
          mcd.business_size,
          mcd.established_year,
          
          -- SALES AND PERFORMANCE METRICS
          mcd.view_count,
          mcd.click_count,
          mcd.add_to_cart_count,
          mcd.conversion_count,
          mcd.revenue_cents,
          mcd.units_sold,
          mcd.average_rating,
          mcd.review_count,
          mcd.wishlist_count,
          mcd.share_count,
          
          -- Computed Fields
          mcd.bucket_priority,
          mcd.trending_score,
          mcd.price_status,
          mcd.stock_status,
          
          -- Timestamps
          mcd.created_at,
          mcd.updated_at,
          mcd.published_at,
          mcd.archived_at,
          mcd.mv_refreshed_at,
          
          -- Variant fields from storefront_variants_mv
          sv.product_type as variant_product_type,
          sv.parent_item_id,
          sv.variant_attributes,
          sv.variant_name as variant_display_name,
          sv.variant_sort_order,
          sv.variant_is_active,
          sv.variant_group,
          sv.parent_product
        FROM mv_category_discovery mcd
        LEFT JOIN storefront_variants_mv sv ON mcd.inventory_item_id = sv.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${orderBy.replace('DESC', orderDirection)}
        LIMIT $${params.length + 1}
      `;
      
      params.push(limit);

      this.logInfo(`[SCOPE ROUTER] Executing MV-optimized product category query`, {
        query: query.replace(/\s+/g, ' ').substring(0, 200) + '...',
        paramCount: params.length
      } as any);

      const results = await this.prisma.$queryRawUnsafe(query, ...params) as ProductWithVariants[];
      
      this.logInfo(`[SCOPE ROUTER] MV product category query returned ${results.length} results`);
      
      // Transform products with computed variant fields
      const transformedResults = transformProductsWithVariants(results);
      
      return transformedResults;

    } catch (error) {
      this.logError('[SCOPE ROUTER] Error in MV product category query', { 
        error: (error as Error).message,
        category 
      } as any);
      
      // Fallback to original implementation
      return this.getFeaturedProductsByProductCategoryFallback(category, options);
    }
  }

  /**
   * Fallback implementation for product category (original method)
   */
  private async getFeaturedProductsByProductCategoryFallback(category: {
    productId?: string;
    productName?: string;
    googleProductId?: string;
  }, options: {
    featuredType?: string;
    isActive?: boolean;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { featuredType, isActive = true, limit = 12, sortBy = 'priority', sortOrder = 'desc' } = options;
    
      this.logWarning('[SCOPE ROUTER] Using fallback product category implementation');
    
    // Use the base service to get products and filter by product category
    const allFeaturedProducts = await this.shopsService['baseService'].getFeaturedProductsByType(featuredType || 'store_selection', {
      isActive,
      limit: 100, // Get more to filter by category
      sortBy: sortBy as 'priority' | 'featuredAt' | 'expiresAt',
      sortOrder: sortOrder as 'asc' | 'desc'
    });

    // Filter products by product category
    const categoryFilteredProducts = allFeaturedProducts.filter((product: any) => {
      // Check if product has product category information
      const productCategory = product.categoryName || product.category_path || product.tenantCategory;
      
      if (!productCategory) return false;
      
      // Match by product category name (case-insensitive)
      if (category.productName) {
        return productCategory.toLowerCase().includes(category.productName.toLowerCase());
      }
      
      // Match by Google Product Category ID
      if (category.googleProductId) {
        return product.googleProductId === category.googleProductId;
      }
      
      // Match by product category ID
      if (category.productId) {
        return product.categoryId === category.productId;
      }
      
      return false;
    });

    // Limit the results
    return categoryFilteredProducts.slice(0, limit);
  }

  /**
   * Get featured products by shop category (GBP-based) (MV-OPTIMIZED)
   */
  private async getFeaturedProductsByShopCategory(category: {
    shopCategoryId?: string;
    shopCategoryName?: string;
    shopGoogleCategoryId?: string;
  }, options: {
    featuredType?: string;
    isActive?: boolean;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { featuredType, isActive = true, limit = 12, sortBy = 'priority', sortOrder = 'desc' } = options;
    
    this.logInfo(`[SCOPE ROUTER] Getting products by shop category: ${category.shopCategoryName}`, {
      category,
      limit
    } as any);

    try {
      // Use optimized MV for shop category discovery
      let whereConditions = [];
      let params: any[] = [];
      
      // Filter by category type (shop or both)
      whereConditions.push(`category_type IN ('shop', 'both')`);
      
      // Filter by active status
      if (isActive) {
        whereConditions.push(`featured_is_active = true`);
      }

      // Add shop category filtering conditions
      if (category.shopCategoryName) {
        whereConditions.push(`shop_category_name_lower ILIKE $${params.length + 1}`);
        params.push(`%${category.shopCategoryName.toLowerCase()}%`);
      }
      
      if (category.shopCategoryId) {
        whereConditions.push(`shop_category_id = $${params.length + 1}`);
        params.push(category.shopCategoryId);
      }
      
      if (category.shopGoogleCategoryId) {
        whereConditions.push(`shop_google_category_id = $${params.length + 1}`);
        params.push(category.shopGoogleCategoryId);
      }

      // Filter by featured type if specified
      if (featuredType) {
        whereConditions.push(`featured_type = $${params.length + 1}`);
        params.push(featuredType);
      }

      // Build ORDER BY clause
      const orderBy = sortBy === 'priority' ? 'featured_priority DESC, featured_at DESC' :
                     sortBy === 'featuredAt' ? 'featured_at DESC' :
                     sortBy === 'expiresAt' ? 'featured_until DESC' :
                     sortBy === 'trending' ? 'trending_score DESC' :
                     'featured_priority DESC';

      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Execute optimized MV query with variants
      const query = `
        SELECT 
          mcd.inventory_item_id,
          mcd.product_name,
          mcd.product_title,
          mcd.product_description,
          mcd.price_cents,
          mcd.currency,
          mcd.image_url,
          mcd.sku,
          mcd.brand,
          mcd.stock,
          mcd.availability,
          mcd.featured_type,
          mcd.featured_priority,
          mcd.featured_at,
          mcd.featured_until,
          mcd.featured_is_active,
          mcd.is_actively_featured,
          mcd.category_id,
          mcd.category_name,
          mcd.category_slug,
          mcd.product_google_category_id,
          mcd.tenant_id,
          mcd.tenant_name,
          mcd.tenant_slug,
          mcd.shop_category,
          mcd.shop_category_id,
          mcd.shop_google_category_id,
          mcd.city,
          mcd.state,
          mcd.country,
          mcd.latitude,
          mcd.longitude,
          mcd.bucket_priority,
          mcd.trending_score,
          mcd.view_count,
          mcd.click_count,
          mcd.add_to_cart_count,
          mcd.conversion_count,
          mcd.created_at,
          mcd.updated_at,
          mcd.mv_refreshed_at,
          sv.product_type,
          sv.parent_item_id,
          sv.variant_attributes,
          sv.variant_name,
          sv.variant_sort_order,
          sv.variant_is_active,
          sv.variant_group,
          sv.parent_product
        FROM mv_category_discovery mcd
        LEFT JOIN storefront_variants_mv sv ON mcd.inventory_item_id = sv.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${orderBy.replace('DESC', orderDirection)}
        LIMIT $${params.length + 1}
      `;
      
      params.push(limit);

      this.logInfo(`[SCOPE ROUTER] Executing MV-optimized shop category query`, {
        query: query.replace(/\s+/g, ' ').substring(0, 200) + '...',
        paramCount: params.length
      } as any);

      const results = await this.prisma.$queryRawUnsafe(query, ...params) as ProductWithVariants[];
      
      this.logInfo(`[SCOPE ROUTER] MV shop category query returned ${results.length} results`);
      
      // Transform products with computed variant fields
      const transformedResults = transformProductsWithVariants(results);
      
      return transformedResults;

    } catch (error) {
      this.logError('[SCOPE ROUTER] Error in MV shop category query', { 
        error: (error as Error).message,
        category 
      } as any);
      
      // Fallback to original implementation
      return this.getFeaturedProductsByShopCategoryFallback(category, options);
    }
  }

  /**
   * Fallback implementation for shop category (original method)
   */
  private async getFeaturedProductsByShopCategoryFallback(category: {
    shopCategoryId?: string;
    shopCategoryName?: string;
    shopGoogleCategoryId?: string;
  }, options: {
    featuredType?: string;
    isActive?: boolean;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { featuredType, isActive = true, limit = 12, sortBy = 'priority', sortOrder = 'desc' } = options;
    
      this.logWarning('[SCOPE ROUTER] Using fallback shop category implementation');

    // First, get tenants that match the shop category
    const matchingTenants = await this.getTenantsByShopCategory(category);
    
    if (matchingTenants.length === 0) {
      this.logInfo(`[SCOPE ROUTER] No shops found for shop category: ${category.shopCategoryName}`);
      return [];
    }

      this.logInfo(`[SCOPE ROUTER] Found ${matchingTenants.length} shops for category: ${category.shopCategoryName}`);

    // Get featured products from these tenants
    const allFeaturedProducts = await this.shopsService['baseService'].getFeaturedProductsByType(featuredType || 'store_selection', {
      isActive,
      limit: 200, // Get more to filter by tenant
      sortBy: sortBy as 'priority' | 'featuredAt' | 'expiresAt',
      sortOrder: sortOrder as 'asc' | 'desc'
    });

    // Filter products by matching tenants
    const categoryFilteredProducts = allFeaturedProducts.filter((product: any) => {
      return matchingTenants.includes(product.tenantId);
    });

    // Limit the results
    return categoryFilteredProducts.slice(0, limit);
  }

  /**
   * Get featured products by both product and shop categories (MV-OPTIMIZED)
   */
  private async getFeaturedProductsByBothCategories(category: {
    productId?: string;
    productName?: string;
    googleProductId?: string;
    shopCategoryId?: string;
    shopCategoryName?: string;
    shopGoogleCategoryId?: string;
  }, options: {
    featuredType?: string;
    isActive?: boolean;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { featuredType, isActive = true, limit = 12, sortBy = 'priority', sortOrder = 'desc' } = options;
    
    this.logInfo(`[SCOPE ROUTER] Getting products by both product and shop categories`, {
      category,
      limit
    } as any);

    try {
      // Use optimized MV for both categories discovery
      let whereConditions = [];
      let params: any[] = [];
      
      // Filter by category type (both only)
      whereConditions.push(`category_type = 'both'`);
      
      // Filter by active status
      if (isActive) {
        whereConditions.push(`featured_is_active = true`);
      }

      // Add product category filtering conditions
      if (category.productName) {
        whereConditions.push(`product_category_name_lower ILIKE $${params.length + 1}`);
        params.push(`%${category.productName.toLowerCase()}%`);
      }
      
      if (category.productId) {
        whereConditions.push(`category_id = $${params.length + 1}`);
        params.push(category.productId);
      }
      
      if (category.googleProductId) {
        whereConditions.push(`product_google_category_id = $${params.length + 1}`);
        params.push(category.googleProductId);
      }

      // Add shop category filtering conditions
      if (category.shopCategoryName) {
        whereConditions.push(`shop_category_name_lower ILIKE $${params.length + 1}`);
        params.push(`%${category.shopCategoryName.toLowerCase()}%`);
      }
      
      if (category.shopCategoryId) {
        whereConditions.push(`shop_category_id = $${params.length + 1}`);
        params.push(category.shopCategoryId);
      }
      
      if (category.shopGoogleCategoryId) {
        whereConditions.push(`shop_google_category_id = $${params.length + 1}`);
        params.push(category.shopGoogleCategoryId);
      }

      // Filter by featured type if specified
      if (featuredType) {
        whereConditions.push(`featured_type = $${params.length + 1}`);
        params.push(featuredType);
      }

      // Build ORDER BY clause
      const orderBy = sortBy === 'priority' ? 'featured_priority DESC, featured_at DESC' :
                     sortBy === 'featuredAt' ? 'featured_at DESC' :
                     sortBy === 'expiresAt' ? 'featured_until DESC' :
                     sortBy === 'trending' ? 'trending_score DESC' :
                     'featured_priority DESC';

      const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Execute optimized MV query with variants
      const query = `
        SELECT 
          mcd.inventory_item_id,
          mcd.product_name,
          mcd.product_title,
          mcd.product_description,
          mcd.price_cents,
          mcd.currency,
          mcd.image_url,
          mcd.sku,
          mcd.brand,
          mcd.stock,
          mcd.availability,
          mcd.featured_type,
          mcd.featured_priority,
          mcd.featured_at,
          mcd.featured_until,
          mcd.featured_is_active,
          mcd.is_actively_featured,
          mcd.category_id,
          mcd.category_name,
          mcd.category_slug,
          mcd.product_google_category_id,
          mcd.tenant_id,
          mcd.tenant_name,
          mcd.tenant_slug,
          mcd.shop_category,
          mcd.shop_category_id,
          mcd.shop_google_category_id,
          mcd.city,
          mcd.state,
          mcd.country,
          mcd.latitude,
          mcd.longitude,
          mcd.bucket_priority,
          mcd.trending_score,
          mcd.view_count,
          mcd.click_count,
          mcd.add_to_cart_count,
          mcd.conversion_count,
          mcd.created_at,
          mcd.updated_at,
          mcd.mv_refreshed_at,
          sv.product_type,
          sv.parent_item_id,
          sv.variant_attributes,
          sv.variant_name,
          sv.variant_sort_order,
          sv.variant_is_active,
          sv.variant_group,
          sv.parent_product
        FROM mv_category_discovery mcd
        LEFT JOIN storefront_variants_mv sv ON mcd.inventory_item_id = sv.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY ${orderBy.replace('DESC', orderDirection)}
        LIMIT $${params.length + 1}
      `;
      
      params.push(limit);

      this.logInfo(`[SCOPE ROUTER] Executing MV-optimized both categories query`, {
        query: query.replace(/\s+/g, ' ').substring(0, 200) + '...',
        paramCount: params.length
      } as any);

      const results = await this.prisma.$queryRawUnsafe(query, ...params) as ProductWithVariants[];
      
      this.logInfo(`[SCOPE ROUTER] MV both categories query returned ${results.length} results`);
      
      // Transform products with computed variant fields
      const transformedResults = transformProductsWithVariants(results);
      
      return transformedResults;

    } catch (error) {
      this.logError('[SCOPE ROUTER] Error in MV both categories query', { 
        error: (error as Error).message,
        category 
      } as any);
      
      // Fallback to original implementation
      return this.getFeaturedProductsByBothCategoriesFallback(category, options);
    }
  }

  /**
   * Fallback implementation for both categories (original method)
   */
  private async getFeaturedProductsByBothCategoriesFallback(category: {
    productId?: string;
    productName?: string;
    googleProductId?: string;
    shopCategoryId?: string;
    shopCategoryName?: string;
    shopGoogleCategoryId?: string;
  }, options: {
    featuredType?: string;
    isActive?: boolean;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const { featuredType, isActive = true, limit = 12, sortBy = 'priority', sortOrder = 'desc' } = options;
    
      this.logWarning('[SCOPE ROUTER] Using fallback both categories implementation');

    // Get products by shop category first
    const shopCategoryProducts = await this.getFeaturedProductsByShopCategory(category, {
      featuredType,
      isActive,
      limit: 100, // Get more to filter further
      sortBy: options.sortBy,
      sortOrder: options.sortOrder
    });

    // Then filter by product category
    const bothCategoryProducts = (shopCategoryProducts as any[]).filter((product: any) => {
      // Check if product has product category information
      const productCategory = product.categoryName || product.category_path || product.tenantCategory;
      
      if (!productCategory) return false;
      
      // Match by product category name (case-insensitive)
      if (category.productName) {
        return productCategory.toLowerCase().includes(category.productName.toLowerCase());
      }
      
      // Match by Google Product Category ID
      if (category.googleProductId) {
        return product.googleProductId === category.googleProductId;
      }
      
      // Match by product category ID
      if (category.productId) {
        return product.categoryId === category.productId;
      }
      
      return false;
    });

    // Limit the results
    return bothCategoryProducts.slice(0, limit);
  }

  /**
   * Get tenants by shop category (GBP-based)
   */
  private async getTenantsByShopCategory(category: {
    shopCategoryId?: string;
    shopCategoryName?: string;
    shopGoogleCategoryId?: string;
  }): Promise<string[]> {
    // This would typically query the database directly
    // For now, we'll use a simplified approach with the shops service
    
    try {
      // Get all trending shops (as a proxy for all active shops)
      const allShops = await this.shopsService.getTrendingShops({ limit: 100 });
      
      // Filter shops by category
      const matchingShops = allShops.filter((shop: any) => {
        // Check if shop has category information
        const shopCategory = shop.primary_category || shop.category || shop.googleCategory;
        
        if (!shopCategory) return false;
        
        // Match by shop category name (case-insensitive)
        if (category.shopCategoryName) {
          return shopCategory.toLowerCase().includes(category.shopCategoryName.toLowerCase());
        }
        
        // Match by Google Category ID
        if (category.shopGoogleCategoryId) {
          return shop.googleCategoryId === category.shopGoogleCategoryId;
        }
        
        // Match by shop category ID
        if (category.shopCategoryId) {
          return shop.categoryId === category.shopCategoryId;
        }
        
        return false;
      });

      // Return tenant IDs
      return matchingShops.map((shop: any) => shop.tenantId);
      
    } catch (error) {
      this.logError('[SCOPE ROUTER] Error getting tenants by shop category', error);
      return [];
    }
  }

  /**
   * Map bucket type to featured type
   */
  private mapBucketToFeaturedType(bucketType: string): string {
    const bucketToFeaturedType: Record<string, string> = {
      'random': 'store_selection',
      'trending': 'trending',
      'new': 'new_arrival',
      'sale': 'sale',
      'seasonal': 'seasonal',
      'staff': 'staff_pick',
      'selection': 'store_selection'
    };
    
    return bucketToFeaturedType[bucketType] || 'store_selection';
  }

  /**
   * Handle timezone-based discovery (future implementation)
   */
  private async handleTimezoneScope(bucketType: string, options: DiscoveryOptions) {
    const { timezone, limit = 12 } = options;
    
    if (!timezone) {
      throw new Error('Timezone filter is required for timezone scope');
    }

    this.logInfo(`[SCOPE ROUTER] Timezone scope: fetching ${bucketType} in timezone ${timezone.timezone}`, {
      timezone,
      bucketType,
      limit
    } as any);

    // TODO: Implement timezone-based discovery
    // 1. Get tenants by timezone
    // 2. Get featured products from those tenants
    // 3. Rank by local relevance + popularity
    
    throw new Error('Timezone scope not yet implemented');
  }

  /**
   * Validate discovery options
   */
  private validateOptions(options: DiscoveryOptions, requiredFields: string[] = []) {
    for (const field of requiredFields) {
      if (!options[field as keyof DiscoveryOptions]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  /**
   * Get trending shops (scope-aware)
   */
  async getTrendingShops(options: DiscoveryOptions) {
    const { scope = 'global', limit = 12, location, category } = options;
    
    this.logInfo('[SCOPE ROUTER] Getting trending shops', {
      scope,
      limit,
      location,
      category
    } as any);

    switch (scope) {
      case 'global':
        return this.shopsService.getTrendingShops({ limit });
      case 'location':
        if (!location) {
          throw new Error('Location filter is required for location scope trending shops');
        }
        // TODO: Implement location-based trending shops
        throw new Error('Location scope trending shops not yet implemented');
      case 'category':
        if (!category) {
          throw new Error('Category filter is required for category scope trending shops');
        }
        // Get trending shops by category (supports both product and shop categories)
        return this.getTrendingShopsByCategory(category, { limit });
      default:
        throw new Error(`Unsupported scope for trending shops: ${scope}`);
    }
  }

  /**
   * Get trending shops by category (supports both product and shop categories)
   */
  private async getTrendingShopsByCategory(category: {
    productId?: string;
    productName?: string;
    googleProductId?: string;
    shopCategoryId?: string;
    shopCategoryName?: string;
    shopGoogleCategoryId?: string;
    categoryType?: 'product' | 'shop' | 'both';
  }, options: {
    limit?: number;
  }) {
    const { limit = 12 } = options;
    const categoryType = category.categoryType || 'shop';
    
    this.logInfo(`[SCOPE ROUTER] Getting trending shops for ${categoryType} category`, {
      category,
      categoryType,
      limit
    } as any);

    // Get all trending shops
    const allTrendingShops = await this.shopsService.getTrendingShops({ limit: 50 });
    
    let categoryFilteredShops = allTrendingShops;

    switch (categoryType) {
      case 'shop':
        // Filter shops by shop category (GBP-based)
        categoryFilteredShops = allTrendingShops.filter((shop: any) => {
          // Check if shop has category information
          const shopCategory = shop.primary_category || shop.category || shop.googleCategory;
          
          if (!shopCategory) return false;
          
          // Match by shop category name (case-insensitive)
          if (category.shopCategoryName) {
            return shopCategory.toLowerCase().includes(category.shopCategoryName.toLowerCase());
          }
          
          // Match by Google Category ID
          if (category.shopGoogleCategoryId) {
            return shop.googleCategoryId === category.shopGoogleCategoryId;
          }
          
          // Match by shop category ID
          if (category.shopCategoryId) {
            return shop.categoryId === category.shopCategoryId;
          }
          
          return false;
        });
        break;
      
      case 'product':
        // For product category, we need to get shops that have products in that category
        // This is more complex - for now, we'll return all shops (could be enhanced later)
        this.logInfo(`[SCOPE ROUTER] Product category shop filtering not fully implemented, returning all trending shops`);
        break;
      
      case 'both':
        // For both, filter by shop category first
        categoryFilteredShops = allTrendingShops.filter((shop: any) => {
          const shopCategory = shop.primary_category || shop.category || shop.googleCategory;
          
          if (!shopCategory) return false;
          
          if (category.shopCategoryName) {
            return shopCategory.toLowerCase().includes(category.shopCategoryName.toLowerCase());
          }
          
          return false;
        });
        break;
    }

    // Limit the results
    return categoryFilteredShops.slice(0, limit);
  }
}
