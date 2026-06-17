/**
 * Public API Routes - Singleton System
 * 
 * These routes provide public access to singleton-managed data
 * with appropriate caching and performance optimizations.
 */

import { Router } from 'express';
import { z } from 'zod';
import shopsRoutes from './shops';
import tenantsRoutes from './public/tenants';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { DEFAULT_SETTINGS } from './storefront-options-settings';
import ProductOptionsService from '../services/ProductOptionsService';

const router = Router();

// ====================
// VALIDATION SCHEMAS
// ====================

const ProductQuerySchema = z.object({
  limit: z.string().transform(Number).default(10),
  offset: z.string().transform(Number).default(0),
  category: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['name', 'price', 'created']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc')
});

const FeaturedProductsQuerySchema = z.object({
  limit: z.string().transform(Number).default(5),
  lat: z.string().optional(), // Keep as string for service compatibility
  lng: z.string().optional(), // Keep as string for service compatibility
  radius: z.string().transform(Number).default(50),
  tenantId: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.string().transform(Number).optional(),
  maxPrice: z.string().transform(Number).optional()
});

const StoreQuerySchema = z.object({
  limit: z.string().transform(Number).default(10),
  offset: z.string().transform(Number).default(0),
  search: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  sort: z.enum(['rating', 'newest', 'products']).optional(),
  category: z.string().optional(),
  page: z.string().transform(Number).optional()
});

// ====================
// PUBLIC PRODUCTS ENDPOINTS
// ====================

/**
 * GET /api/public/products/:id
 * Get single product by ID or product_slug with full details - Universal Identifier Pattern
 * Supports both UUID and product_slug lookup for cross-tenant awareness
 */
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.query; // Optional tenant filter for slug lookup

    console.log(`[Public API] Single product request for ID/slug: ${id}`);

    // Use SingleProductService with caching
    const { SingleProductService } = await import('../services/SingleProductService');
    const productService = SingleProductService.getInstance();

    // Trust the ID format - try direct ID lookup first, then slug lookup
    // ID format is flexible (text) and can change at any time, so we don't parse it
    let product = await productService.getProductById(id);
    let lookupType: 'id' | 'slug' = 'id';
    
    if (!product) {
      // Not found by ID, try as product slug
      product = await productService.getProductBySlug(id, tenant_id as string | undefined);
      lookupType = 'slug';
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
        message: `No product found with ID/slug: ${id}`
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
    res.setHeader('X-Service-Source', 'SingleProductService');
    res.setHeader('X-Lookup-Type', lookupType);

    res.json({
      success: true,
      data: product,
      metadata: {
        productId: product.id,
        productSlug: product.productSlug,
        lookupType: lookupType,
        cacheTTL: 15 * 60 * 1000 // 15 minutes
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Single product error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

/**
 * GET /api/public/products/featured
 * Get featured products with location awareness - Universal Identifier Pattern
 */
router.get('/products/featured', async (req, res) => {
  try {
    const query = FeaturedProductsQuerySchema.parse(req.query);

    // console.log(`[Public API] Featured products request with query:`, query);

    // Use FeaturedService with intelligent caching
    const { FeaturedService } = await import('../services/FeaturedService');
    const featuredService = FeaturedService.getInstance();

    const result = await featuredService.getFeaturedProducts({
      limit: query.limit,
      tenantId: query.tenantId,
      lat: query.lat,
      lng: query.lng,
      radius: query.radius,
      category: query.category,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice
    });

    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.setHeader('X-Service-Source', 'FeaturedService');

    res.json({
      success: true,
      ...result,
      metadata: {
        cacheTTL: 5 * 60 * 1000, // 5 minutes
        cacheStats: featuredService.getCacheStats()
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Featured products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured products'
    });
  }
});

/**
 * GET /api/public/products/search/global
 * Global product search across all tenants
 */
router.get('/products/search/global', async (req, res) => {
  try {
    const query = ProductQuerySchema.parse(req.query);

    if (!query.search) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // console.log(`[Public API] Global product search: "${query.search}"`);

    // Use ProductService for global search
    const { ProductService } = await import('../services/ProductService');
    const productService = ProductService.getInstance();

    const result = await productService.searchProducts({
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
      order: query.order,
      search: query.search,
      category: (query as any).category,
      minPrice: (query as any).minPrice,
      maxPrice: (query as any).maxPrice
    });

    res.setHeader('Cache-Control', 'public, max-age=180'); // 3 min cache for search
    res.setHeader('X-Service-Source', 'ProductService');

    res.json({
      success: true,
      ...result,
      metadata: {
        searchQuery: query.search,
        cacheTTL: 3 * 60 * 1000 // 3 minutes
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Global product search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search products'
    });
  }
});

/**
 * GET /api/public/products
 * Get general product listing (featured products across all tenants)
 */
router.get('/products', async (req, res) => {
  try {
    const query = ProductQuerySchema.parse(req.query);

    // console.log(`[Public API] General products request with query:`, query);

    // Use FeaturedService to get general product listing
    const { FeaturedService } = await import('../services/FeaturedService');
    const featuredService = FeaturedService.getInstance();

    const result = await featuredService.getFeaturedProducts({
      limit: query.limit || 20,
      lat: undefined,
      lng: undefined,
      radius: undefined,
      category: query.category,
      tenantId: undefined // Get from all tenants
    });

    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.setHeader('X-Service-Source', 'FeaturedService');

    res.json({
      success: true,
      products: result.products || [],
      message: 'General product listing retrieved successfully'
    });
  } catch (error) {
    console.error('[PUBLIC API] General products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch general products'
    });
  }
});

router.get('/stores', async (req, res) => {
  try {
    const query = StoreQuerySchema.parse(req.query);

    // console.log(`[Public API] Stores request with query:`, query);

    // Use StoreService
    const { StoreService } = await import('../services/StoreService');
    const storeService = StoreService.getInstance();

    const result = await storeService.getStores({
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      city: query.city,
      state: query.state,
      sort: query.sort,
      category: query.category,
      page: query.page
    });

    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.setHeader('X-Service-Source', 'StoreService');

    res.json({
      success: true,
      ...result,
      metadata: {
        cacheTTL: 5 * 60 * 1000 // 5 minutes
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Stores error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stores'
    });
  }
});

/**
 * GET /api/public/stores/search
 * Search stores - Universal Identifier Pattern
 */
router.get('/stores/search', async (req, res) => {
  try {
    const query = StoreQuerySchema.parse(req.query);

    if (!query.search) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // console.log(`[Public API] Store search: "${query.search}"`);

    // Use StoreService for search
    const { StoreService } = await import('../services/StoreService');
    const storeService = StoreService.getInstance();

    const result = await storeService.searchStores({
      limit: query.limit,
      offset: query.offset,
      search: query.search
    });

    res.setHeader('Cache-Control', 'public, max-age=180'); // 3 min cache for search
    res.setHeader('X-Service-Source', 'StoreService');

    res.json({
      success: true,
      ...result,
      metadata: {
        searchQuery: query.search,
        cacheTTL: 3 * 60 * 1000 // 3 minutes
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Store search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search stores'
    });
  }
});

/**
 * GET /api/public/stores/:identifier
 * Get single store by any identifier (tenant-id, slug, auto-id) - Universal Identifier Pattern
 */
router.get('/stores/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;

    console.log(`[Public API] Store lookup request for identifier: ${identifier}`);

    // Use StoreService with Universal Identifier support
    const { StoreService } = await import('../services/StoreService');
    const storeService = StoreService.getInstance();

    const store = await storeService.getStoreByIdentifier(identifier);

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found',
        message: `No store found for identifier: ${identifier}`
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
    res.setHeader('X-Service-Source', 'StoreService');

    res.json({
      success: true,
      store,
      metadata: {
        identifier,
        cacheTTL: 15 * 60 * 1000 // 15 minutes
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Store by identifier error:', error);
    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch store'
    });
  }
});

/**
 * GET /api/public/stores/:identifier/profile
 * Get rich store profile data from mv_global view
 */
router.get('/stores/:identifier/profile', async (req, res) => {
  try {
    const { identifier } = req.params;

    console.log(`[Public API] Store profile request for identifier: ${identifier}`);

    // Use the existing database connection pattern
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    // Query mv_global for rich store data and product count
    const storeQuery = `
      SELECT DISTINCT
        tenant_id,
        tenant_name,
        tenant_slug,
        tenant_logo_url,
        tenant_city,
        tenant_state,
        tenant_country,
        tenant_zip,
        tenant_address,
        tenant_latitude,
        tenant_longitude,
        subscription_tier,
        shop_category,
        store_average_rating,
        store_review_count,
        business_type,
        business_category,
        created_at,
        updated_at,
        mv_refreshed_at,
        -- Get product count
        (SELECT COUNT(DISTINCT inventory_item_id)
         FROM mv_storefront_discovery 
         WHERE tenant_id = $1 
           AND item_status = 'active' 
           AND visibility = 'public') as product_count,
        -- Check if any products are featured
        (SELECT BOOL_OR(is_actively_featured)
         FROM mv_storefront_discovery 
         WHERE tenant_id = $1 
           AND item_status = 'active' 
           AND visibility = 'public') as has_featured_products
      FROM mv_storefront_discovery
      WHERE tenant_id = $1
        AND item_status = 'active'
        AND visibility = 'public'
      LIMIT 1
    `;

    const result = await pool.query(storeQuery, [identifier]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Store profile not found'
      });
    }

    const storeData = result.rows[0];

    // Transform data to match expected format
    const transformedStore = {
      id: storeData.tenant_id,
      name: storeData.tenant_name,
      slug: storeData.tenant_slug,
      logo_url: storeData.tenant_logo_url,
      city: storeData.tenant_city,
      state: storeData.tenant_state,
      country: storeData.tenant_country,
      zip: storeData.tenant_zip,
      address: storeData.tenant_address,
      latitude: storeData.tenant_latitude,
      longitude: storeData.tenant_longitude,
      subscription_tier: storeData.subscription_tier,
      shop_category: storeData.shop_category,
      average_rating: storeData.store_average_rating,
      review_count: storeData.store_review_count,
      business_type: storeData.business_type,
      business_category: storeData.business_category,
      created_at: storeData.created_at,
      updated_at: storeData.updated_at,
      mv_refreshed_at: storeData.mv_refreshed_at,
      // Additional fields
      product_count: parseInt(storeData.product_count || '0'),
      has_featured_products: storeData.has_featured_products || false,
      // TODO: Add phone, payment methods, delivery options when available in mv_global
      phone: null,
      payment_methods: [],
      delivery_options: []
    };

    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
    res.setHeader('X-Service-Source', 'mv_global');

    res.json({
      success: true,
      data: transformedStore,
      metadata: {
        identifier,
        cacheTTL: 15 * 60 * 1000 // 15 minutes
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Store profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


// ====================
// SHOPS ENDPOINTS
// ====================

/**
 * GET /api/public/shops
 * Get public shops with filtering - Universal Identifier Pattern
 */
router.get('/shops', async (req, res) => {
  try {
    const query = StoreQuerySchema.parse(req.query);

    console.log(`[Public API] Shops request with query:`, query);

    // Use StoreService with Universal Identifier support
    const { StoreService } = await import('../services/StoreService');
    const storeService = StoreService.getInstance();

    const result = await storeService.getStores({
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      city: query.city,
      state: query.state,
      sort: query.sort,
      category: query.category,
      page: query.page
    });

    // Transform to match existing response format for backward compatibility
    const shops = result.stores.map(store => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      business_name: store.businessName || store.name,
      logo_url: store.logoUrl || null,
      address: store.address || null,
      city: store.city || null,
      state: store.state || null,
      zip_code: store.zipCode || null,
      phone: store.phone || null,
      website: store.website || null,
      rating_avg: undefined, // Not available in current schema
      rating_count: undefined, // Not available in current schema
      product_count: store.productCount,
      is_published: true, // All active tenants are considered published for shops
      primary_category: store.primaryCategory || null
    }));

    const currentPage = query.page || Math.floor((query.offset || 0) / (query.limit || 10)) + 1;

    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.setHeader('X-Service-Source', 'StoreService');

    res.json({
      success: true,
      shops,
      pagination: {
        page: currentPage,
        limit: query.limit,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
        hasMore: result.pagination.hasMore
      },
      metadata: {
        cacheTTL: 5 * 60 * 1000 // 5 minutes
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Shops error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shops'
    });
  }
});

/**
 * GET /api/public/shops/trending
 * Get trending shops
 */
router.get('/shops/trending', async (req, res) => {
  const startTime = Date.now();
  try {
    const limit = parseInt((req.query.limit as string) || '12');
    
    // Use unified ShopService with UniversalSingleton caching
    const { default: ShopService } = await import('../services/ShopService');
    const shopService = ShopService.getInstance();
    
    const shops = await shopService.getTrendingShops({ limit });
    
    const responseTime = Date.now() - startTime;
    
    res.setHeader('Cache-Control', 'public, max-age=600'); // 10 minutes cache
    res.setHeader('X-Response-Time', responseTime.toString());
    res.setHeader('X-Service-Source', 'ShopService');
    
    res.json({
      success: true,
      data: shops,
      count: shops.length,
      metadata: {
        cacheTTL: 10 * 60 * 1000, // 10 minutes
        responseTime,
        limit
      }
    });
  } catch (error) {
    console.error('[PUBLIC SHOPS API] Error fetching trending shops:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch trending shops';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// ====================
// UNIVERSAL IDENTIFIER ROUTES
// ====================

/**
 * Batch testing route for identifier resolution
 */
router.post('/test/batch-resolve', async (req, res) => {
  try {
    const { identifiers } = req.body;
    
    if (!Array.isArray(identifiers)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'identifiers must be an array'
      });
    }
    
    const { resolveMultipleIdentifiers } = await import('../middleware/universalIdentifierResolver');
    const results = await resolveMultipleIdentifiers(identifiers);
    
    res.json({
      success: true,
      data: results,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Batch Test] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Batch test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/public/shops/:identifier
 * Get shop by any identifier (tenant-id, slug, auto-id) - public access
 */
router.get('/shops/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log('[Public API] Shop lookup request for identifier:', identifier);

    // Use UniversalIdentifierCache for proper caching and identifier resolution
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();

    let resolvedTenant: any = null;

    // Add timeout for identifier resolution to prevent hanging
    const identifierPromise = cache.resolveIdentifier(identifier);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Identifier resolution timeout')), 10000); // 10 second timeout
    });

    try {
      resolvedTenant = await Promise.race([identifierPromise, timeoutPromise]);
      console.log('[Public API] Successfully resolved identifier:', identifier, '->', resolvedTenant?.id);
    } catch (error) {
      console.error('[Public API] Error resolving identifier:', identifier, error);
      return res.status(404).json({
        success: false,
        error: `Identifier not found: ${identifier}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    if (!resolvedTenant) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found',
        message: `No shop found for identifier: ${identifier}`
      });
    }

    // Simple approach: just return the resolved tenant info
    // No need for expensive ShopService queries for basic identifier validation
    const shop = {
      id: resolvedTenant.id,
      name: resolvedTenant.name,
      slug: resolvedTenant.slug,
      business_name: resolvedTenant.name,
      imageUrl: undefined, // Not needed for basic validation
      location: undefined,
      productCount: undefined,
      rating: undefined,
      rating_count: undefined,
      is_published: true,
      primary_category: undefined,
      created_at: new Date()
    };

    console.log(`[Public API] Successfully resolved identifier ${identifier} -> ${resolvedTenant.id}`);

    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache

    res.json({
      success: true,
      shop,
      metadata: {
        identifier,
        cacheTTL: 15 * 60 * 1000 // 15 minutes
      }
    });
  } catch (error) {
    console.error('[Public API] Error fetching shop by identifier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ====================
// PUBLIC TENANT ENDPOINTS (Universal Identifier Pattern)
// ====================

/**
 * GET /api/public/tenant/:identifier
 * Get basic tenant information by any identifier (tenant-id, slug, auto-id)
 */
router.get('/tenant/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log(`[Public API] Tenant lookup request for identifier: ${identifier}`);
    
    // Use the universal identifier resolver
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();
    
    // Add timeout for identifier resolution to prevent hanging
    const identifierPromise = cache.resolveIdentifier(identifier);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Identifier resolution timeout')), 10000); // 10 second timeout
    });
    
    let resolvedTenant: any = null;
    try {
      resolvedTenant = await Promise.race([identifierPromise, timeoutPromise]);
      console.log(`[Public API] Successfully resolved identifier: ${identifier} -> ${resolvedTenant?.id}`);
    } catch (error) {
      console.error(`[Public API] Error resolving identifier: ${identifier}`, error);
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }
    
    if (!resolvedTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }
    
      let hasDirectory = false;
       let tenantResult: any = null;
       let profileResult: any = null;
      const tenant = await prisma.tenants.findUnique({
        where: { id: resolvedTenant.id },
        select: {
          id: true,
          name: true,
          slug: true,
          subscription_status: true,
          metadata: true,
          created_at: true,
          language: true,
          currency: true,
          region: true,
          trial_ends_at: true,
          subscription_ends_at: true,
          manual_subscription_control: true,
          manual_subscription_expires_at: true,
          manual_subscription_reason: true,
          organization_id: true,
          location_status: true,
          status_changed_at: true,
          gbp_primary_category_id: true,
          gbp_primary_category_name: true,
          gbp_secondary_categories: true
        }
      });

      if (!tenant) {
        console.log(`[TenantService] Tenant not found: ${resolvedTenant.id}`);
        return null;
      } else {
        tenantResult = await prisma.directory_settings_list.findUnique({
        where: { tenant_id: resolvedTenant.id },
        select: {
          is_published: true,
          primary_category: true,
          secondary_categories: true,
          seo_keywords: true,
          seo_description: true,
          is_featured: true,
          featured_until: true,
          slug: true,
        }});
        profileResult = await prisma.tenant_business_profiles_list.findUnique({
          where: { tenant_id: resolvedTenant.id },
          select: {
            business_name: true,
            address_line1: true,
            address_line2: true,
            city: true,
            state: true,
            phone_number: true,
            email: true,
            website: true,
            logo_url: true,
            banner_url: true,
            business_description: true,
            hours: true,
            social_links: true,
            latitude: true,
            longitude: true,
            gbp_category_name: true,
            country_code: true,
            postal_code: true,
            contact_person: true
          }
        });

		   hasDirectory = tenantResult?.is_published === true; 
      }
    // Return basic tenant information
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
    res.setHeader('X-Service-Source', 'Universal-Identifier-Cache');

    // Compute subscription status info for panel display
    const subscriptionStatus = tenant?.subscription_status || resolvedTenant.subscriptionStatus;
    const organizationId = tenant?.organization_id;
    const statusChangedAt = tenant?.status_changed_at;

    // Determine if subscription status should trigger panel
    let subscriptionStatusInfo: any = null;
    let showSubscriptionPanel = false;

    if (subscriptionStatus === 'canceled' && !organizationId) {
      // Canceled and not part of an organization - show panel
      showSubscriptionPanel = true;
      subscriptionStatusInfo = {
        status: 'canceled',
        label: 'Subscription Canceled',
        description: 'This store\'s subscription has been canceled and is no longer active.',
        showStorefront: false,
        showInDirectory: false
      };
    } else if (subscriptionStatus === 'past_due' && statusChangedAt) {
      // Past due - check if 30-day grace period has passed
      const gracePeriodEnd = new Date(statusChangedAt);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);
      const now = new Date();

      if (now > gracePeriodEnd) {
        showSubscriptionPanel = true;
        subscriptionStatusInfo = {
          status: 'past_due',
          label: 'Subscription Past Due',
          description: 'This store\'s subscription is past due. Please contact the store owner.',
          showStorefront: false,
          showInDirectory: false,
          gracePeriodEnded: true
        };
      }
    }

    // Calculate effective expiration for public API response
    const effectiveExpiration = tenant.manual_subscription_control 
      ? {
          expiresAt: tenant.manual_subscription_expires_at,
          type: 'manual' as const,
          source: 'manual_override' as const
        }
      : tenant.subscription_status === 'trial' && tenant.trial_ends_at
        ? {
            expiresAt: tenant.trial_ends_at,
            type: 'trial' as const,
            source: 'automatic_trial' as const
          }
        : tenant.subscription_ends_at
          ? {
              expiresAt: tenant.subscription_ends_at,
              type: 'subscription' as const,
              source: 'automatic_subscription' as const
            }
          : null;

    res.json({
      success: true,
      data: {
        id: resolvedTenant.id,
        name: resolvedTenant.name,
        slug: resolvedTenant.slug,
        subscriptionStatus: subscriptionStatus,
        subscriptionTier: resolvedTenant.subscriptionTier,
        trialEndsAt: resolvedTenant.trialEndsAt,
        locationStatus: resolvedTenant.locationStatus,
        statusInfo: resolvedTenant.statusInfo,
        organizationId: organizationId,
        statusChangedAt: statusChangedAt?.toISOString() || null,
        subscriptionStatusInfo: subscriptionStatusInfo,
        showSubscriptionPanel: showSubscriptionPanel,
        hasDirectory: hasDirectory,
        directoryData: tenantResult,
        profileData: profileResult,
        metadata: resolvedTenant.metadata,
        createdAt: new Date().toISOString(), // We don't have created_at in cache
        updatedAt: new Date().toISOString(),
        // Manual subscription control fields
        manualSubscriptionControl: tenant.manual_subscription_control,
        manualSubscriptionExpiresAt: tenant.manual_subscription_expires_at,
        manualSubscriptionReason: tenant.manual_subscription_reason,
        // Effective expiration fields
        effectiveExpiresAt: effectiveExpiration?.expiresAt,
        effectiveExpiresType: effectiveExpiration?.type,
        effectiveExpiresSource: effectiveExpiration?.source,
        // GBP categories from dedicated columns
        gbpPrimaryCategoryId: tenant.gbp_primary_category_id,
        gbpPrimaryCategoryName: tenant.gbp_primary_category_name,
        gbpSecondaryCategories: tenant.gbp_secondary_categories || []
      },
      metadata: {
        tenant: {
          id: resolvedTenant.id,
          name: resolvedTenant.name,
          slug: resolvedTenant.slug,
          type: resolvedTenant.type
        },
        identifierType: resolvedTenant.type
      }
    });
  } catch (error) {
    console.error('[Public API] Error fetching tenant by identifier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tenant',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/public/tenant/:identifier/profile
 * Get tenant profile by any identifier (tenant-id, slug, auto-id)
 */
router.get('/tenant/:identifier/profile', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log(`[Public API] Tenant profile request for identifier: ${identifier}`);
    
    // Use the universal identifier resolver
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();
    
    // Add timeout for identifier resolution to prevent hanging
    const identifierPromise = cache.resolveIdentifier(identifier);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Identifier resolution timeout')), 10000); // 10 second timeout
    });
    
    let resolvedTenant: any = null;
    try {
      resolvedTenant = await Promise.race([identifierPromise, timeoutPromise]);
      console.log(`[Public API] Successfully resolved identifier: ${identifier} -> ${resolvedTenant?.id}`);
    } catch (error) {
      console.error(`[Public API] Error resolving identifier: ${identifier}`, error);
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }
    
    if (!resolvedTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }
    
    // Use TenantService to get complete profile
    const { TenantService } = await import('../services/TenantService');
    const tenantService = TenantService.getInstance();
    
    // Add timeout for profile retrieval
    const profilePromise = tenantService.getTenantProfile(resolvedTenant.id);
    const profileTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Profile retrieval timeout')), 15000); // 15 second timeout
    });
    
    let profile: any = null;
    try {
      profile = await Promise.race([profilePromise, profileTimeoutPromise]);
      // console.log(`[Public API] Successfully retrieved profile for tenant: ${resolvedTenant.id}`);
      // console.log(`[Public API] Profile:`, profile);
      // Add the field to the profile
      // if (profile) {
      //   profile.has_published_directory = profile.has_published_directory || false;
      // }
      
    } catch (error) {
      console.error(`[Public API] Error retrieving profile for tenant: ${resolvedTenant.id}`, error);
      return res.status(404).json({
        success: false,
        error: 'Tenant profile not found',
        message: 'Unable to retrieve tenant profile'
      });
    }
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Tenant profile not found',
        message: 'Unable to retrieve tenant profile'
      });
    }
    
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
    res.setHeader('X-Service-Source', 'Universal-Identifier-Cache');
    
    res.json({
      success: true,
      data: profile,
      metadata: {
        tenant: {
          id: resolvedTenant.id,
          name: resolvedTenant.name,
          slug: resolvedTenant.slug,
          type: resolvedTenant.type
        },
        identifierType: resolvedTenant.type
      }
    });
  } catch (error) {
    console.error('[Public API] Error fetching tenant profile by identifier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tenant profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/public/tenant/:identifier/payment-gateways
 * Get tenant payment gateways by any identifier (tenant-id, slug, auto-id)
 */
router.get('/tenant/:identifier/payment-gateways', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log(`[Public API] Payment gateways request for identifier: ${identifier}`);

    // Use the universal identifier resolver
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();
    
    // Add timeout for identifier resolution to prevent hanging
    const identifierPromise = cache.resolveIdentifier(identifier);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Identifier resolution timeout')), 10000); // 10 second timeout
    });
    
    let resolvedTenant: any = null;
    try {
      resolvedTenant = await Promise.race([identifierPromise, timeoutPromise]);
      // console.log(`[Public API] Successfully resolved identifier: ${identifier} -> ${resolvedTenant?.id}`);
    } catch (error) {
      console.error(`[Public API] Error resolving identifier: ${identifier}`, error);
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }

    if (!resolvedTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }

    // For now, return empty gateways array since payment gateway logic isn't implemented yet
    // In the future, this would query tenant payment gateway configurations
    const gateways: any[] = [];

    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
    res.setHeader('X-Service-Source', 'Universal-Identifier-Cache');

    res.json({
      success: true,
      gateways,
      metadata: {
        tenant: {
          id: resolvedTenant.id,
          name: resolvedTenant.name,
          slug: resolvedTenant.slug,
          type: resolvedTenant.type
        },
        identifierType: resolvedTenant.type
      }
    });
  } catch (error) {
    console.error('[Public API] Error fetching payment gateways by identifier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment gateways',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
router.get('/tenant/:identifier/business-profile', async (req, res) => {
  try {
    const { identifier } = req.params;
    // console.log(`[Public API] Business profile request for identifier: ${identifier}`);
    
    // Use the universal identifier resolver
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();
    const resolvedTenant = await cache.resolveIdentifier(identifier);
    
    if (!resolvedTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }
    
    // Use TenantService to get business profile
    const { TenantService } = await import('../services/TenantService');
    const tenantService = TenantService.getInstance();
    const profile = await tenantService.getTenantProfile(resolvedTenant.id);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Business profile not found',
        message: 'Unable to retrieve business profile'
      });
    }
    
    // Extract business information
    const businessProfile = {
      id: profile.id,
      name: profile.name,
      slug: profile.slug,
      businessInfo: profile.businessInfo,
      metadata: profile.metadata,
      subscriptionStatus: profile.subscriptionStatus,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };
    
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
    res.setHeader('X-Service-Source', 'Universal-Identifier-Cache');
    
    res.json({
      success: true,
      data: businessProfile,
      metadata: {
        tenant: {
          id: resolvedTenant.id,
          name: resolvedTenant.name,
          slug: resolvedTenant.slug,
          type: resolvedTenant.type
        },
        identifierType: resolvedTenant.type
      }
    });
  } catch (error) {
    console.error('[Public API] Error fetching business profile by identifier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch business profile',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ====================
// LEGACY SHOPS ENDPOINTS (for backward compatibility)
// ====================

/**
 * GET /api/public/shops/trending
 * Get trending shops
 */
router.get('/shops/trending', async (req, res) => {
  const startTime = Date.now();
  try {
    const limit = parseInt((req.query.limit as string) || '12');
    
    // Use unified ShopService with UniversalSingleton caching
    const { default: ShopService } = await import('../services/ShopService');
    const shopService = ShopService.getInstance();
    
    const shops = await shopService.getTrendingShops({ limit });
    
    const responseTime = Date.now() - startTime;
    
    res.setHeader('Cache-Control', 'public, max-age=600'); // 10 minutes cache
    res.setHeader('X-Response-Time', responseTime.toString());
    res.setHeader('X-Service-Source', 'ShopService');
    
    res.json({
      success: true,
      data: shops,
      count: shops.length,
      metadata: {
        cacheTTL: 10 * 60 * 1000, // 10 minutes
        responseTime,
        limit
      }
    });
  } catch (error) {
    console.error('[PUBLIC SHOPS API] Error fetching trending shops:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch trending shops';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * GET /api/public/shops/categories
 * Get trending shop categories with aggregated metrics (Phase 5B)
 * Returns categories sorted by product count and trending score
 * NOTE: Must be defined before /:slug to avoid route collision
 */
router.get('/shops/categories', async (req, res) => {
  try {
    const { limit, minProducts } = req.query;
    
    const shopsService = (await import('../services/ShopsFeaturedService')).default;
    const service = shopsService.getInstance();
    
    const categories = await service.getTrendingCategories({
      limit: limit ? parseInt(limit as string) : 20,
      minProducts: minProducts ? parseInt(minProducts as string) : 3
    }) as any[];

    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    res.setHeader('X-MV-Source', 'mv_category_discovery');

    res.json({
      success: true,
      data: categories,
      count: categories.length,
      type: 'trending_categories',
      metadata: {
        mvSource: 'mv_category_discovery',
        cacheMaxAge: 3600,
        minimumProducts: minProducts ? parseInt(minProducts as string) : 3,
        description: 'Shop categories aggregated by product count and trending score'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching trending categories:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending categories',
      message: errorMessage
    });
  }
});

/**
 * GET /api/public/shops/locations
 * Get available locations (cities, states, ZIPs) from shops on platform
 * Used to populate location dropdowns with actual shop locations
 * Uses ShopService with caching for optimal performance
 */
router.get('/shops/locations', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Use unified ShopService with caching
    const { default: ShopService } = await import('../services/ShopService');
    const shopService = ShopService.getInstance();
    const locations = await shopService.getShopLocations();
    
    const responseTime = Date.now() - startTime;
    
    res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutes cache
    res.setHeader('X-Response-Time', responseTime.toString());
    res.setHeader('X-Service-Source', 'ShopService');
    
    res.json({
      success: true,
      data: locations,
      count: locations.length,
      metadata: {
        source: 'mv_storefront_discovery',
        cacheTTL: 30 * 60 * 1000, // 30 minutes
        responseTime
      }
    });
  } catch (error) {
    console.error('[PUBLIC SHOPS API] Error fetching locations:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch locations';
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * GET /api/public/shops/nearby
 * Get nearby shops within radius (Phase 5C)
 * Returns shops sorted by distance with product counts
 * NOTE: Must be defined before /:slug to avoid route collision
 */
router.get('/shops/nearby', async (req, res) => {
  try {
    const startTime = Date.now();
    const { latitude, longitude, radius, limit, minProducts } = req.query;
    
    // Validate required parameters
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'latitude and longitude are required parameters'
      });
    }

    // Use unified ShopService with UniversalSingleton caching
    const { default: ShopService } = await import('../services/ShopService');
    const shopService = ShopService.getInstance();
    
    const shops = await shopService.getNearbyShops({
      latitude: parseFloat(latitude as string),
      longitude: parseFloat(longitude as string),
      radiusMiles: radius ? parseInt(radius as string) : 25,
      limit: limit ? parseInt(limit as string) : 20,
      minProducts: minProducts ? parseInt(minProducts as string) : 3
    });

    const responseTime = Date.now() - startTime;

    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache
    res.setHeader('X-Response-Time', responseTime.toString());
    res.setHeader('X-Service-Source', 'ShopService');
    res.setHeader('X-MV-Source', 'mv_storefront_discovery');

    res.json({
      success: true,
      data: shops,
      count: shops.length,
      type: 'nearby_shops',
      metadata: {
        source: 'mv_storefront_discovery',
        cacheTTL: 5 * 60 * 1000, // 5 minutes
        responseTime,
        searchLocation: {
          latitude: parseFloat(latitude as string),
          longitude: parseFloat(longitude as string),
          radiusMiles: radius ? parseInt(radius as string) : 25
        },
        minimumProducts: minProducts ? parseInt(minProducts as string) : 3,
        description: 'Shops within radius sorted by distance'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC SHOPS API] Error fetching nearby shops:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby shops',
      message: errorMessage
    });
  }
});

/**
 * GET /api/public/shops/:slug
 * Get single shop by slug
 * Note: This route must come after specific routes like /shops/trending
 */
router.get('/shops/:slug', async (req, res) => {
  // console.log('[PUBLIC API] Shops slug route HIT with slug:', req.params.slug);
  try {
    const { slug } = req.params;
    
    // Skip if this is a special route that should be handled elsewhere
    if (slug === 'trending' || slug === 'featured' || slug === 'id') {
   //   console.log('[PUBLIC API] Skipping special slug:', slug);
      return res.status(404).json({
        success: false,
        error: 'Not found'
      });
    }
    
    // Use unified ShopService with caching
    const { default: ShopService } = await import('../services/ShopService');
    const shopService = ShopService.getInstance();
    
    // Check if this is a tenant ID (starts with 'tid-')
    let shop;
    if (slug.startsWith('tid-')) {
//      console.log('[PUBLIC API] Detected tenant ID, fetching by tenant ID:', slug);
      shop = await shopService.getShopByTenantId(slug);
    } else {
 //     console.log('[PUBLIC API] Fetching by slug:', slug);
      shop = await shopService.getShopBySlug(slug);
    }

    if (!shop) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }

    res.json({
      success: true,
      shop
    });
  } catch (error) {
    console.error('[PUBLIC API] Shop by slug error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop'
    });
  }
});

/**
 * GET /api/public/shops/id/:tenantId
 * Get single shop by tenant ID
 */
router.get('/shops/id/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Use unified ShopService with caching
    const { default: ShopService } = await import('../services/ShopService');
    const shopService = ShopService.getInstance();
    const shop = await shopService.getShopByTenantId(tenantId);

    if (!shop) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }

    res.json({
      success: true,
      shop
    });
  } catch (error) {
    console.error('[PUBLIC API] Shop by tenant ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop'
    });
  }
});

// ==========================
// SHOPS MULTI-BUCKET ENDPOINTS
// ==========================

/**
 * GET /api/public/shops/discover/:bucketType
 * Universal discovery endpoint with scope-aware routing - Universal Identifier Pattern
 *
 * Query parameters:
 * - scope: 'shop' | 'global' | 'location' | 'category' | 'timezone' (default: 'shop')
 * - tenantId: string (required for shop scope)
 * - limit: number (default: 12)
 * - sortBy: 'priority' | 'featuredAt' | 'expiresAt' | 'relevance' (default: 'priority')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 */
router.get('/shops/discover/:bucketType', async (req, res) => {
  const startTime = Date.now();
  try {
    const { bucketType } = req.params;
    const {
      scope = 'shop',
      tenantId,
      limit = 12,
      sortBy = 'priority',
      sortOrder = 'desc',
      ...otherQueryParams
    } = req.query;

    // Validate bucketType
    const validBucketTypes = ['random', 'trending', 'new', 'sale', 'seasonal', 'staff', 'selection'];
    if (!validBucketTypes.includes(bucketType as string)) {
      console.error(`[PUBLIC API] Invalid bucketType: ${bucketType}`);
      return res.status(400).json({
        success: false,
        error: `Invalid bucketType: ${bucketType}. Valid types: ${validBucketTypes.join(', ')}`
      });
    }

    // Parse nested query parameters for location, category, timezone
    const location = (otherQueryParams['location[latitude]'] || otherQueryParams['location[city]'] || otherQueryParams['location[state]'] || otherQueryParams['location[zip]']) ? {
      latitude: otherQueryParams['location[latitude]'] ? parseFloat(otherQueryParams['location[latitude]'] as string) : undefined,
      longitude: otherQueryParams['location[longitude]'] ? parseFloat(otherQueryParams['location[longitude]'] as string) : undefined,
      city: otherQueryParams['location[city]'] as string,
      state: otherQueryParams['location[state]'] as string,
      zip: otherQueryParams['location[zip]'] as string,
      country: otherQueryParams['location[country]'] as string,
      radius: otherQueryParams['location[radius]'] ? parseInt(otherQueryParams['location[radius]'] as string) : undefined
    } : undefined;

    const category = otherQueryParams['category[productName]'] ? {
      productName: otherQueryParams['category[productName]'] as string,
      productId: otherQueryParams['category[productId]'] as string,
      googleProductId: otherQueryParams['category[googleProductId]'] as string,
      shopCategoryName: otherQueryParams['category[shopCategoryName]'] as string,
      shopCategoryId: otherQueryParams['category[shopCategoryId]'] as string,
      shopGoogleCategoryId: otherQueryParams['category[shopGoogleCategoryId]'] as string,
      categoryType: otherQueryParams['category[categoryType]'] as 'product' | 'shop' | 'both'
    } : undefined;

    const timezone = otherQueryParams['timezone[timezone]'] ? {
      timezone: otherQueryParams['timezone[timezone]'] as string,
      offset: otherQueryParams['timezone[offset]'] ? parseInt(otherQueryParams['timezone[offset]'] as string) : undefined
    } : undefined;

    console.log(`[Public API] Discovery request for bucket: ${bucketType}, scope: ${scope}`);

    // Use DiscoveryService with intelligent caching
    const { DiscoveryService } = await import('../services/DiscoveryService');
    const discoveryService = DiscoveryService.getInstance();

    const result = await discoveryService.routeDiscovery(bucketType as string, {
      scope: scope as 'shop' | 'global' | 'location' | 'category' | 'timezone',
      tenantId: tenantId as string,
      limit: parseInt(limit as string),
      sortBy: sortBy as 'priority' | 'featuredAt' | 'expiresAt' | 'relevance',
      sortOrder: sortOrder as 'asc' | 'desc',
      location,
      category,
      timezone
    });

    // Add MV-aware cache headers
    const productsArray = Array.isArray(result.products) ? result.products : [];
    const mvRefreshedAt = productsArray[0]?.mv_refreshed_at || new Date().toISOString();

    res.setHeader('X-MV-Refreshed-At', mvRefreshedAt);
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 minutes
    res.setHeader('X-MV-Source', 'mv_storefront_discovery');
    res.setHeader('X-Service-Source', 'DiscoveryService');

    res.json({
      success: true,
      data: result.products,
      scope: result.scope,
      bucketType: result.bucketType,
      cached: result.cached,
      metadata: {
        cacheTTL: 10 * 60 * 1000, // 10 minutes
        cacheStats: discoveryService.getCacheStats()
      },
      metrics: {
        ...result.metrics,
        responseTime: Date.now() - startTime
      }
    });
  } catch (error) {
    console.error(`[SHOPS API] Discovery error for bucket ${req.params.bucketType}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      bucketType: req.params.bucketType
    });
  }
});
router.get('/shops/trending', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      scope = 'global',
      limit = 12,
      ...otherQueryParams
    } = req.query;

    // Parse location parameters for location scope
    const location = otherQueryParams['location[city]'] ? {
      latitude: undefined,
      longitude: undefined,
      city: otherQueryParams['location[city]'] as string,
      state: otherQueryParams['location[state]'] as string,
      zip: otherQueryParams['location[zip]'] as string,
      country: otherQueryParams['location[country]'] as string,
      radius: otherQueryParams['location[radius]'] ? parseInt(otherQueryParams['location[radius]'] as string) : undefined
    } : undefined;

    // Parse category parameters for category scope
    const category = otherQueryParams['category[shopCategoryName]'] ? {
      // Product category parameters
      productName: otherQueryParams['category[productName]'] as string,
      productId: otherQueryParams['category[productId]'] as string,
      googleProductId: otherQueryParams['category[googleProductId]'] as string,
      
      // Shop category parameters (GBP-based)
      shopCategoryName: otherQueryParams['category[shopCategoryName]'] as string,
      shopCategoryId: otherQueryParams['category[shopCategoryId]'] as string,
      shopGoogleCategoryId: otherQueryParams['category[shopGoogleCategoryId]'] as string,
      
      // Category type - specifies which category to use for filtering
      categoryType: otherQueryParams['category[categoryType]'] as 'product' | 'shop' | 'both'
    } : undefined;

    const { ScopeRouter } = await import('../services/ScopeRouter');
    const scopeRouter = ScopeRouter.getInstance();

    const shops = await scopeRouter.getTrendingShops({
      scope: scope as 'shop' | 'global' | 'location',
      limit: parseInt(limit as string),
      location,
      category
    });

    res.json({
      success: true,
      data: shops,
      scope,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime,
        shopCount: Array.isArray(shops) ? shops.length : 0
      }
    });
  } catch (error) {
    console.error('[SHOPS API] Trending shops error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ==========================
// SCOPE-FIRST ENDPOINTS (Alternative API Pattern)
// ==========================

/**
 * GET /api/public/shops/{scope}/{bucketType}
 * Scope-first discovery endpoints with category-aware routing
 * 
 * Examples:
 * GET /api/public/shops/global/trending
 * GET /api/public/shops/category/random?category[shopCategoryName]=Electronics Store
 * GET /api/public/shops/shop/new?tenantId=tid-123
 */
router.get('/shops/:scope/:bucketType', async (req, res) => {
  const startTime = Date.now();
  try {
    const { scope, bucketType } = req.params;
    const {
      tenantId,
      limit = 12,
      sortBy = 'priority',
      sortOrder = 'desc',
      ...otherQueryParams
    } = req.query;

    // Validate scope
    if (!['shop', 'global', 'category', 'location', 'timezone'].includes(scope as string)) {
      return res.status(400).json({
        success: false,
        error: `Invalid scope: ${scope}. Must be one of: shop, global, category, location, timezone`
      });
    }

    // Parse nested query parameters for location, category, timezone
    const location = (otherQueryParams['location[latitude]'] || otherQueryParams['location[city]'] || otherQueryParams['location[state]'] || otherQueryParams['location[zip]']) ? {
      // Coordinates (Phase 5C - preferred method)
      latitude: otherQueryParams['location[latitude]'] ? parseFloat(otherQueryParams['location[latitude]'] as string) : undefined,
      longitude: otherQueryParams['location[longitude]'] ? parseFloat(otherQueryParams['location[longitude]'] as string) : undefined,
      
      // Address-based (direct filtering - no geocoding)
      city: otherQueryParams['location[city]'] as string,
      state: otherQueryParams['location[state]'] as string,
      zip: otherQueryParams['location[zip]'] as string,
      country: otherQueryParams['location[country]'] as string,
      
      // Radius in miles
      radius: otherQueryParams['location[radius]'] ? parseInt(otherQueryParams['location[radius]'] as string) : undefined
    } : undefined;

    const category = otherQueryParams['category[productName]'] ? {
      // Product category parameters
      productName: otherQueryParams['category[productName]'] as string,
      productId: otherQueryParams['category[productId]'] as string,
      googleProductId: otherQueryParams['category[googleProductId]'] as string,
      
      // Shop category parameters (GBP-based)
      shopCategoryName: otherQueryParams['category[shopCategoryName]'] as string,
      shopCategoryId: otherQueryParams['category[shopCategoryId]'] as string,
      shopGoogleCategoryId: otherQueryParams['category[shopGoogleCategoryId]'] as string,
      
      // Category type - specifies which category to use for filtering
      categoryType: otherQueryParams['category[categoryType]'] as 'product' | 'shop' | 'both'
    } : undefined;

    const timezone = otherQueryParams['timezone[timezone]'] ? {
      timezone: otherQueryParams['timezone[timezone]'] as string,
      offset: otherQueryParams['timezone[offset]'] ? parseInt(otherQueryParams['timezone[offset]'] as string) : undefined
    } : undefined;

    const { ScopeRouter } = await import('../services/ScopeRouter');
    const scopeRouter = ScopeRouter.getInstance();

    const products = await scopeRouter.routeDiscovery(bucketType as string, {
      scope: scope as 'shop' | 'global' | 'location' | 'category' | 'timezone',
      tenantId: tenantId as string,
      limit: parseInt(limit as string),
      sortBy: sortBy as 'priority' | 'featuredAt' | 'expiresAt' | 'relevance',
      sortOrder: sortOrder as 'asc' | 'desc',
      location,
      category,
      timezone
    });

    // Add MV-aware cache headers
    const productsArray = Array.isArray(products) ? products : [];
    const mvRefreshedAt = productsArray[0]?.mv_refreshed_at || new Date().toISOString();
    
    res.setHeader('X-MV-Refreshed-At', mvRefreshedAt);
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 minutes
    res.setHeader('X-MV-Source', 'mv_storefront_discovery');

    res.json({
      success: true,
      data: products,
      scope,
      bucketType,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime,
        itemCount: productsArray.length
      }
    });
  } catch (error) {
    console.error(`[SHOPS API] Scope-first discovery error for ${req.params.scope}/${req.params.bucketType}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      scope: req.params.scope,
      bucketType: req.params.bucketType
    });
  }
});

/**
 * GET /api/public/shops/{scope}/trending
 * Scope-first trending shops endpoint
 * 
 * Examples:
 * GET /api/public/shops/global/trending
 * GET /api/public/shops/category/trending?category[shopCategoryName]=Electronics Store
 */
router.get('/shops/:scope/trending', async (req, res) => {
  const startTime = Date.now();
  try {
    const { scope } = req.params;
    const {
      limit = 12,
      ...otherQueryParams
    } = req.query;

    // Validate scope
    if (!['shop', 'global', 'category', 'location'].includes(scope as string)) {
      return res.status(400).json({
        success: false,
        error: `Invalid scope: ${scope}. Must be one of: shop, global, category, location`
      });
    }

    // Parse location parameters for location scope
    const location = otherQueryParams['location[city]'] ? {
      latitude: undefined,
      longitude: undefined,
      city: otherQueryParams['location[city]'] as string,
      state: otherQueryParams['location[state]'] as string,
      zip: otherQueryParams['location[zip]'] as string,
      country: otherQueryParams['location[country]'] as string,
      radius: otherQueryParams['location[radius]'] ? parseInt(otherQueryParams['location[radius]'] as string) : undefined
    } : undefined;

    // Parse category parameters for category scope
    const category = otherQueryParams['category[shopCategoryName]'] ? {
      // Product category parameters
      productName: otherQueryParams['category[productName]'] as string,
      productId: otherQueryParams['category[productId]'] as string,
      googleProductId: otherQueryParams['category[googleProductId]'] as string,
      
      // Shop category parameters (GBP-based)
      shopCategoryName: otherQueryParams['category[shopCategoryName]'] as string,
      shopCategoryId: otherQueryParams['category[shopCategoryId]'] as string,
      shopGoogleCategoryId: otherQueryParams['category[shopGoogleCategoryId]'] as string,
      
      // Category type - specifies which category to use for filtering
      categoryType: otherQueryParams['category[categoryType]'] as 'product' | 'shop' | 'both'
    } : undefined;

    const { ScopeRouter } = await import('../services/ScopeRouter');
    const scopeRouter = ScopeRouter.getInstance();

    const shops = await scopeRouter.getTrendingShops({
      scope: scope as 'shop' | 'global' | 'location',
      limit: parseInt(limit as string),
      location,
      category
    });

    res.json({
      success: true,
      data: shops,
      scope,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime,
        shopCount: Array.isArray(shops) ? shops.length : 0
      }
    });
  } catch (error) {
    console.error(`[SHOPS API] Scope-first trending shops error for scope ${req.params.scope}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      scope: req.params.scope
    });
  }
});

// ==========================
// LEGACY ENDPOINTS (for backward compatibility)
// ==========================

/**
 * GET /api/public/shops/featured/random
 * Get random products for shops discovery
 */
router.get('/shops/featured/random', async (req, res) => {
  const startTime = Date.now();
  try {
    const { tenantId, limit = 12, shopScope = 'global' } = req.query;
    
    const shopsService = (await import('../services/ShopsFeaturedService')).default;
    const service = shopsService.getInstance();
    
    const products = await service.getShopRandomProducts({
      tenantId: tenantId as string,
      limit: parseInt(limit as string),
      shopScope: shopScope as 'global' | 'shop'
    });
    
    res.json({
      success: true,
      data: products,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime
      }
    });
  } catch (error) {
    console.error('[SHOPS API] Random products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch random products'
    });
  }
});

/**
 * GET /api/public/shops/featured/trending
 * Get trending products for shops discovery
 */
router.get('/shops/featured/trending', async (req, res) => {
  const startTime = Date.now();
  try {
    const { tenantId, limit = 12, shopScope = 'global' } = req.query;
    
    console.log(`[PUBLIC API] Shops trending request:`, {
      method: req.method,
      url: req.url,
      query: req.query,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    });
    
    const shopsService = (await import('../services/ShopsFeaturedService')).default;
    const service = shopsService.getInstance();
    
    const products = await service.getShopTrendingProducts({
      tenantId: tenantId as string,
      limit: parseInt(limit as string),
      shopScope: shopScope as 'global' | 'shop'
    });
    
    res.json({
      success: true,
      data: products,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime
      }
    });
  } catch (error) {
    console.error('[SHOPS API] Trending products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending products'
    });
  }
});

/**
 * GET /api/public/shops/featured/new
 * Get new products for shops discovery
 */
router.get('/shops/featured/new', async (req, res) => {
  const startTime = Date.now();
  try {
    const { tenantId, limit = 12, shopScope = 'global' } = req.query;
    
    const shopsService = (await import('../services/ShopsFeaturedService')).default;
    const service = shopsService.getInstance();
    
    const products = await service.getShopNewProducts({
      tenantId: tenantId as string,
      limit: parseInt(limit as string),
      shopScope: shopScope as 'global' | 'shop'
    });
    
    res.json({
      success: true,
      data: products,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime
      }
    });
  } catch (error) {
    console.error('[SHOPS API] New products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch new products'
    });
  }
});

/**
 * GET /api/public/shops/featured/sale
 * Get sale products for shops discovery
 */
router.get('/shops/featured/sale', async (req, res) => {
  const startTime = Date.now();
  try {
    const { tenantId, limit = 12, shopScope = 'global' } = req.query;
    
    const shopsService = (await import('../services/ShopsFeaturedService')).default;
    const service = shopsService.getInstance();
    
    const products = await service.getShopSaleProducts({
      tenantId: tenantId as string,
      limit: parseInt(limit as string),
      shopScope: shopScope as 'global' | 'shop'
    });
    
    res.json({
      success: true,
      data: products,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime
      }
    });
  } catch (error) {
    console.error('[SHOPS API] Sale products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sale products'
    });
  }
});

/**
 * GET /api/public/shops/featured/seasonal
 * Get seasonal products for shops discovery
 */
router.get('/shops/featured/seasonal', async (req, res) => {
  const startTime = Date.now();
  try {
    const { tenantId, limit = 12, shopScope = 'global' } = req.query;
    
    const shopsService = (await import('../services/ShopsFeaturedService')).default;
    const service = shopsService.getInstance();
    
    const products = await service.getShopSeasonalProducts({
      tenantId: tenantId as string,
      limit: parseInt(limit as string),
      shopScope: shopScope as 'global' | 'shop'
    });
    
    res.json({
      success: true,
      data: products,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime
      }
    });
  } catch (error) {
    console.error('[SHOPS API] Seasonal products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seasonal products'
    });
  }
});

/**
 * GET /api/public/shops/featured/staff
 * Get staff pick products for shops discovery
 */
router.get('/shops/featured/staff', async (req, res) => {
  const startTime = Date.now();
  try {
    const { tenantId, limit = 12, shopScope = 'global' } = req.query;
    
    const shopsService = (await import('../services/ShopsFeaturedService')).default;
    const service = shopsService.getInstance();
    
    const products = await service.getShopStaffPicks({
      tenantId: tenantId as string,
      limit: parseInt(limit as string),
      shopScope: shopScope as 'global' | 'shop'
    });
    
    res.json({
      success: true,
      data: products,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime
      }
    });
  } catch (error) {
    console.error('[SHOPS API] Staff pick products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff pick products'
    });
  }
});

/**
 * GET /api/public/shops/featured/selection
 * Get store selection products for shops discovery
 */
router.get('/shops/featured/selection', async (req, res) => {
  const startTime = Date.now();
  try {
    const { tenantId, limit = 12, shopScope = 'global' } = req.query;
    
    const shopsService = (await import('../services/ShopsFeaturedService')).default;
    const service = shopsService.getInstance();
    
    const products = await service.getShopStoreSelections({
      tenantId: tenantId as string,
      limit: parseInt(limit as string),
      shopScope: shopScope as 'global' | 'shop'
    });
    
    res.json({
      success: true,
      data: products,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime
      }
    });
  } catch (error) {
    console.error('[SHOPS API] Store selection products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store selection products'
    });
  }
});

/**
 * GET /api/public/shops/recently-viewed
 * Get recently viewed shops for a user
 * NOTE: This endpoint is commented out as getRecentlyViewedShops method doesn't exist yet
 */
/*
router.get('/shops/recently-viewed', async (req, res) => {
  const startTime = Date.now();
  try {
    const { userId, limit = 12 } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }
    
    const shopsService = (await import('../services/ShopsFeaturedService')).default;
    const service = shopsService.getInstance();
    
    const shops = await service.getRecentlyViewedShops({
      userId: userId as string,
      limit: parseInt(limit as string)
    });
    
    res.json({
      success: true,
      data: shops,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime
      }
    });
  } catch (error) {
    console.error('[SHOPS API] Recently viewed shops error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recently viewed shops'
    });
  }
});
*/

// ====================
// STORES ENDPOINTS
// ====================

/**
 * GET /api/public/categories
 * Get public categories
 */
router.get('/categories', async (req, res) => {
  try {
    // Use PlatformCategoryService with UniversalSingleton caching
    const { PlatformCategoryService } = await import('../services/PlatformCategoryService');
    const categoryService = PlatformCategoryService.getInstance();

    const categories = await categoryService.getCategories();

    res.setHeader('Cache-Control', 'public, max-age=600'); // 10 min cache
    res.setHeader('X-Service-Source', 'PlatformCategoryService');

    res.json({
      success: true,
      categories,
      metadata: {
        cacheTTL: 10 * 60 * 1000 // 10 minutes
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch categories'
    });
  }
});

/**
 * GET /api/public/categories/tree
 * Get category tree structure
 */
router.get('/categories/tree', async (req, res) => {
  try {
    // Use PlatformCategoryService with UniversalSingleton caching
    const { PlatformCategoryService } = await import('../services/PlatformCategoryService');
    const categoryService = PlatformCategoryService.getInstance();

    const categoryTree = await categoryService.getCategoryTree();

    res.setHeader('Cache-Control', 'public, max-age=600'); // 10 min cache
    res.setHeader('X-Service-Source', 'PlatformCategoryService');

    res.json({
      success: true,
      categories: categoryTree,
      metadata: {
        cacheTTL: 10 * 60 * 1000 // 10 minutes
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Category tree error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category tree'
    });
  }
});

/**
 * GET /api/public/categories/:slug
 * Get single category by slug
 */
router.get('/categories/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const category = await prisma.platform_categories.findFirst({
      where: { 
        slug,
        is_active: true
      }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    res.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        iconEmoji: category.icon_emoji
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Category by slug error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category'
    });
  }
});

/**
 * GET /api/public/categories/:id/products
 * Get products in a specific category
 */
router.get('/categories/:id/products', async (req, res) => {
  try {
    const { id } = req.params;
    const query = ProductQuerySchema.parse(req.query);
    
    // Verify category exists
    const category = await prisma.platform_categories.findFirst({
      where: { id, is_active: true }
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    const { ProductService } = await import('../services/ProductService');
    const productService = ProductService.getInstance();

    const productsResponse = await productService.getProductsByCategory(category.id, {
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
      order: query.order
    });

    res.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug
      },
      products: productsResponse.products,
      pagination: productsResponse.pagination
    });
  } catch (error) {
    console.error('[PUBLIC API] Category products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch category products'
    });
  }
});

// ====================
// CATALOG ENDPOINTS
// ====================

/**
 * GET /api/public/catalog
 * Get public catalog products with advanced filtering
 */
router.get('/catalog', async (req, res) => {
  try {
    const { 
      page = '1', 
      limit = '24', 
      category, 
      tenant, 
      search, 
      sort = 'featured' 
    } = req.query;
    
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // Build WHERE clause for public catalog
    const conditions: string[] = [
      'sp.item_status = $1',
      'sp.category_id IS NOT NULL'
    ];
    const params: any[] = ['active'];
    let paramIndex = 1;
    
    // Category filter
    if (category && typeof category === 'string') {
      conditions.push(`sp.category_slug = $${paramIndex + 1}`);
      params.push(category);
      paramIndex++;
    }
    
    // Tenant filter
    if (tenant && typeof tenant === 'string') {
      conditions.push(`sp.tenant_id = $${paramIndex + 1}`);
      params.push(tenant);
      paramIndex++;
    }
    
    // Search filter (name or SKU)
    if (search && typeof search === 'string') {
      conditions.push(`(sp.name ILIKE $${paramIndex + 1} OR sp.sku ILIKE $${paramIndex + 1})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Build ORDER BY clause based on sort parameter
    let orderByClause = 'sp.is_actively_featured DESC, sp.created_at DESC'; // Default: featured first, then newest
    switch (sort) {
      case 'newest':
        orderByClause = 'sp.created_at DESC';
        break;
      case 'price-low':
        orderByClause = 'sp.price_cents ASC';
        break;
      case 'price-high':
        orderByClause = 'sp.price_cents DESC';
        break;
      case 'rating':
        orderByClause = 'sp.rating_avg DESC NULLS LAST, sp.rating_count DESC';
        break;
      case 'featured':
      default:
        orderByClause = 'sp.is_actively_featured DESC, sp.created_at DESC';
        break;
    }
    
    // Use the existing database connection pattern
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();
    
    // Query public products from storefront_products MV
    const query = `
      SELECT DISTINCT 
        sp.id,
        sp.tenant_id,
        sp.sku,
        sp.name,
        sp.title,
        sp.description,
        sp.price_cents,
        sp.stock,
        sp.availability,
        sp.image_url,
        sp.brand,
        sp.item_status,
        sp.category_id,
        sp.created_at,
        sp.updated_at,
        sp.featured_type,
        sp.featured_priority,
        sp.featured_at,
        sp.is_actively_featured,
        sp.metadata,
        sp.tenant_name,
        sp.tenant_slug,
        sp.subscription_tier,
        sp.location_status,
        sp.city,
        sp.state,
        sp.directory_listing_id,
        sp.is_published,
        sp.listing_is_featured,
        sp.rating_avg,
        sp.rating_count,
        sp.directory_product_count,
        COALESCE(mv.sale_price_cents, null) as sale_price_cents,
        COALESCE(mv.has_variants, false) as has_variants,
        COALESCE(mv.featured_expires_at, null) as featured_expires_at,
        COALESCE(mv.auto_unfeature, null) as auto_unfeature,
        COALESCE(mv.days_until_expiration, null) as days_until_expiration,
        COALESCE(mv.is_expired, false) as is_expired,
        COALESCE(mv.is_expiring_soon, false) as is_expiring_soon
      FROM storefront_products sp
      LEFT JOIN storefront_products_mv mv ON sp.tenant_id = mv.tenant_id AND sp.id = mv.id
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex + 1}::bigint OFFSET $${paramIndex + 2}::bigint
    `;
    
    const countQuery = `
      SELECT COUNT(DISTINCT sp.id) as count
      FROM storefront_products sp
      WHERE ${whereClause}
    `;
    
    // Execute queries in parallel
    const [itemsResult, countResult] = await Promise.all([
      pool.query(query, [...params, limitNum, skip]),
      pool.query(countQuery, params),
    ]);
    
    const totalCount = parseInt(countResult.rows[0]?.count || '0');
    
    // Fetch featured types for the returned products
    const productIds = itemsResult.rows.map((item: any) => item.id);
    let featuredTypesMap: Record<string, string[]> = {};
    
    if (productIds.length > 0) {
      const featuredTypesQuery = `
        SELECT 
          fp.inventory_item_id as product_id,
          fp.featured_type
        FROM featured_products fp
        WHERE fp.inventory_item_id = ANY($1)
          AND fp.is_active = true
      `;
      
      const featuredTypesResult = await pool.query(featuredTypesQuery, [productIds]);
      
      // Build featured types map
      featuredTypesMap = featuredTypesResult.rows.reduce((acc: Record<string, string[]>, row: any) => {
        if (!acc[row.product_id]) {
          acc[row.product_id] = [];
        }
        acc[row.product_id].push(row.featured_type);
        return acc;
      }, {});
    }
    
    // Transform the data
    const items = itemsResult.rows.map((row: any) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      brand: row.brand,
      description: row.description,
      priceCents: row.price_cents,
      salePriceCents: row.sale_price_cents,
      stock: row.stock,
      imageUrl: row.image_url,
      hasVariants: row.has_variants,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      tenantSlug: row.tenant_slug,
      subscriptionTier: row.subscription_tier,
      locationStatus: row.location_status,
      city: row.city,
      state: row.state,
      address: row.address,
      zipCode: row.zip_code,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      condition: row.condition,
      availability: row.availability,
      ratingAvg: row.rating_avg ? parseFloat(row.rating_avg) : 0,
      ratingCount: row.rating_count,
      isFeatured: row.is_actively_featured,
      featuredType: row.featured_type,
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at,
      featuredUntil: row.featured_until,
      daysUntilExpiration: row.days_until_expiration,
      isExpired: row.is_expired,
      isExpiringSoon: row.is_expiring_soon,
      metadata: row.metadata,
      // Price calculation logic
      price: row.sale_price_cents ? row.sale_price_cents / 100 : row.price_cents / 100,
      originalPrice: row.price_cents / 100,
      salePrice: row.sale_price_cents ? row.sale_price_cents / 100 : undefined,
      discountPercentage: row.sale_price_cents && row.price_cents > row.sale_price_cents 
        ? Math.round(((row.price_cents - row.sale_price_cents) / row.price_cents) * 100)
        : 0,
      onSale: !!row.sale_price_cents && row.price_cents > row.sale_price_cents,
      currency: 'USD'
    }));
    
    const totalPages = Math.ceil(totalCount / limitNum);
    
    res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalCount,
        totalPages,
        hasMore: pageNum < totalPages
      }
    });
    
  } catch (error) {
    console.error('[PUBLIC API] Catalog error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch catalog products'
    });
  }
});

/**
 * GET /api/public/catalog/categories
 * Get catalog categories with product counts
 */
router.get('/catalog/categories', async (req, res) => {
  try {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();
    
    // Query public categories with product counts
    const query = `
      SELECT 
        c.id,
        c.name,
        c.slug,
        COUNT(DISTINCT sp.id) as product_count
      FROM categories c
      LEFT JOIN storefront_products sp ON c.id = sp.category_id
        AND sp.item_status = 'active'
      WHERE c.is_active = true
      GROUP BY c.id, c.name, c.slug
      HAVING COUNT(DISTINCT sp.id) > 0
      ORDER BY c.name ASC
    `;
    
    const result = await pool.query(query);
    
    const categories = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      productCount: Number(row.product_count)
    }));
    
    res.json({ categories });
    
  } catch (error) {
    console.error('[PUBLIC API] Catalog categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch catalog categories'
    });
  }
});

/**
 * GET /api/public/catalog/tenants
 * Get catalog tenants with product counts
 */
router.get('/catalog/tenants', async (req, res) => {
  try {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();
    
    // Query public tenants with product counts
    const query = `
      SELECT DISTINCT
        t.id,
        t.name,
        t.slug,
        t.name as business_name,
        t.logo_url,
        COUNT(DISTINCT sp.id) as product_count
      FROM tenants t
      LEFT JOIN storefront_products sp ON t.id = sp.tenant_id
        AND sp.item_status = 'active'
      WHERE t.is_active = true
        AND EXISTS (
          SELECT 1 FROM storefront_products sp2 
          WHERE sp2.tenant_id = t.id 
            AND sp2.item_status = 'active'
        )
      GROUP BY t.id, t.name, t.slug, t.name, t.logo_url
      HAVING COUNT(DISTINCT sp.id) > 0
      ORDER BY t.id, t.name ASC
    `;
    
    const result = await pool.query(query);
    
    const tenants = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      business_name: row.name,
      logo_url: row.logo_url
    }));
    
    res.json({ tenants });
    
  } catch (error) {
    console.error('[PUBLIC API] Catalog tenants error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch catalog tenants'
    });
  }
});

/**
 * GET /api/public/tenant/:tenantId/items
 * Get all items for a specific tenant with pagination
 * Simple endpoint - no featured logic, no buckets, just clean product list
 */
router.get('/tenant/:tenantId/items', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { 
      page = '1', 
      limit = '24',
      search,
      category,
      sort = 'created_at'
    } = req.query;
    
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // Build WHERE clause for tenant products
    const conditions: string[] = [
      'sp.tenant_id = $1',
      'sp.item_status = $2',
      'sp.category_id IS NOT NULL'
    ];
    const params: any[] = [tenantId, 'active'];
    let paramIndex = 2;
    
    // Search filter
    if (search && typeof search === 'string') {
      conditions.push(`(sp.name ILIKE $${paramIndex + 1} OR sp.sku ILIKE $${paramIndex + 1})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Category filter
    if (category && typeof category === 'string') {
      conditions.push(`sp.category_slug = $${paramIndex + 1}`);
      params.push(category);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Build ORDER BY clause
    let orderByClause = 'sp.created_at DESC'; // Default: newest first
    switch (sort) {
      case 'name':
        orderByClause = 'sp.name ASC';
        break;
      case 'price-low':
        orderByClause = 'sp.price_cents ASC';
        break;
      case 'price-high':
        orderByClause = 'sp.price_cents DESC';
        break;
      case 'oldest':
        orderByClause = 'sp.created_at ASC';
        break;
    }
    
    // Use the existing database connection pattern
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();
    
    // Query tenant items
    const query = `
      SELECT 
        sp.id,
        sp.tenant_id,
        sp.sku,
        sp.name,
        sp.title,
        sp.description,
        sp.price_cents,
        sp.stock,
        sp.availability,
        sp.image_url,
        sp.brand,
        sp.item_status,
        sp.category_id,
        sp.category_name,
        sp.category_slug,
        sp.created_at,
        sp.updated_at
      FROM storefront_products sp
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;
    
    params.push(limitNum, skip);
    
    const result = await pool.query(query, params);
    const items = result.rows;
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM storefront_products sp
      WHERE ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, params.slice(0, -2)); // Exclude LIMIT and OFFSET params
    const totalItems = Number(countResult.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalItems / limitNum);
    
    // Return clean response
    res.json({
      success: true,
      items: items.map(item => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        title: item.title,
        description: item.description,
        priceCents: item.price_cents,
        stock: item.stock,
        availability: item.availability,
        imageUrl: item.image_url,
        brand: item.brand,
        categoryName: item.category_name,
        categorySlug: item.category_slug,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages,
        hasMore: pageNum < totalPages
      }
    });
    
  } catch (error) {
    console.error('[PUBLIC API] Tenant items error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tenant items'
    });
  }
});

/**
 * GET /api/items/:itemId
 * Get a single item by ID (tenant-scoped)
 */
router.get('/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Use the existing database connection pattern
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();
    
    // Query the item directly from inventory_items
    const query = `
      SELECT 
        id,
        tenant_id,
        sku,
        name,
        title,
        description,
        marketing_description,
        price,
        price_cents,
        stock,
        availability,
        image_url,
        image_gallery,
        brand,
        category_path,
        condition,
        currency,
        item_status,
        visibility,
        manufacturer,
        product_type,
        digital_delivery_method,
        has_variants,
        created_at,
        updated_at
      FROM inventory_items
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [itemId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Item not found'
      });
    }
    
    const item = result.rows[0];
    
    // Return the item with additional computed fields
    const responseItem = {
      id: item.id,
      tenantId: item.tenant_id,
      sku: item.sku,
      name: item.name,
      title: item.title,
      description: item.description,
      marketingDescription: item.marketing_description,
      price: Number(item.price),
      priceCents: item.price_cents,
      stock: item.stock,
      availability: item.availability,
      imageUrl: item.image_url,
      imageGallery: item.image_gallery || [],
      brand: item.brand,
      categoryPath: item.category_path,
      condition: item.condition,
      currency: item.currency,
      itemStatus: item.item_status,
      visibility: item.visibility,
      manufacturer: item.manufacturer,
      productType: item.product_type,
      digitalDeliveryMethod: item.digital_delivery_method,
      hasVariants: item.has_variants || false,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    };
    
    res.json({
      success: true,
      data: responseItem
    });
    
  } catch (error) {
    console.error('[PUBLIC API] Item fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch item'
    });
  }
});

/**
 * GET /api/public/tenant/:identifier/fulfillment-settings
 * Get tenant fulfillment settings by any identifier (tenant-id, slug, auto-id)
 */
router.get('/tenant/:identifier/fulfillment-settings', async (req, res) => {
  try {
    const { identifier } = req.params;
    console.log(`[Public API] Fulfillment settings request for identifier: ${identifier}`);

    // Use the universal identifier resolver
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();
    
    // Add timeout for identifier resolution to prevent hanging
    const identifierPromise = cache.resolveIdentifier(identifier);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Identifier resolution timeout')), 10000); // 10 second timeout
    });
    
    let resolvedTenant: any = null;
    try {
      resolvedTenant = await Promise.race([identifierPromise, timeoutPromise]);
      console.log(`[Public API] Successfully resolved identifier: ${identifier} -> ${resolvedTenant?.id}`);
    } catch (error) {
      console.error(`[Public API] Error resolving identifier: ${identifier}`, error);
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }

    if (!resolvedTenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }

    // Get fulfillment settings for the tenant
    const { prisma } = await import('../prisma');
    const settings = await prisma.tenant_fulfillment_settings.findUnique({
      where: { tenant_id: resolvedTenant.id },
    });

    // If no settings exist, return defaults
    const defaultSettings = {
      pickup_enabled: true,
      pickup_instructions: null,
      pickup_ready_time_minutes: 120,
      delivery_enabled: false,
      delivery_radius_miles: null,
      delivery_fee_cents: 0,
      delivery_min_free_cents: null,
      delivery_time_hours: 24,
      delivery_instructions: null,
      shipping_enabled: false,
      shipping_flat_rate_cents: null,
      shipping_zones: [],
      shipping_handling_days: 2,
      shipping_provider: null,
    };

    const fulfillmentSettings = settings || defaultSettings;

    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
    res.setHeader('X-Service-Source', 'Universal-Identifier-Cache');

    res.json({
      success: true,
      settings: fulfillmentSettings,
      metadata: {
        tenant: {
          id: resolvedTenant.id,
          name: resolvedTenant.name,
          slug: resolvedTenant.slug,
          type: resolvedTenant.type
        },
        identifierType: resolvedTenant.type,
        hasCustomSettings: !!settings
      }
    });
  } catch (error) {
    console.error('[Public API] Error fetching fulfillment settings by identifier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fulfillment settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ====================
// PLATFORM STATS
// ====================

/**
 * GET /platform/stats - Get public platform statistics
 * Public endpoint that doesn't require authentication
 * Returns safe platform statistics for public display
 */
router.get('/platform/stats', async (_req, res) => {
  try {
    // Import the platform dashboard service to get real data
    const { platformDashboardSingleton } = await import('../services/PlatformDashboardSingletonService');
    
    // Get real stats data (same as authenticated endpoint)
    const stats = await platformDashboardSingleton.getPlatformStats();
    
    // Transform to match the exact structure the frontend expects
    const publicStats = {
      totalTenants: (stats as any).totalTenants,
      totalProducts: (stats as any).totalItems || (stats as any).totalProducts,
      totalOrders: 0, // Not available in current stats structure
      totalRevenue: 0, // Not available in current stats structure
      // Add formatted fields that the frontend expects
      activeRetailers: (stats as any).activeTenants || (stats as any).totalTenants,
      activeRetailersFormatted: ((stats as any).activeTenants || (stats as any).totalTenants).toLocaleString(),
      productsListed: (stats as any).activeItems || (stats as any).totalItems || (stats as any).totalProducts,
      productsListedFormatted: ((stats as any).activeItems || (stats as any).totalItems || (stats as any).totalProducts).toLocaleString(),
      storefrontsLive: Math.floor(((stats as any).activeTenants || (stats as any).totalTenants) * 0.5), // Estimate: 50% of active tenants have storefronts
      storefrontsLiveFormatted: Math.floor(((stats as any).activeTenants || (stats as any).totalTenants) * 0.5).toLocaleString(),
      platformUptime: 99.9,
      platformUptimeFormatted: '99.9%',
      lastUpdated: new Date().toISOString()
    };

    res.json(publicStats);
  } catch (error) {
    console.error('[Public Platform Stats] Error fetching public stats:', error);
    // Return safe defaults on error
    res.json({
      totalTenants: 0,
      totalProducts: 0,
      totalOrders: 0,
      totalRevenue: 0,
      // Add formatted fields that the frontend expects
      activeRetailers: 0,
      activeRetailersFormatted: '0',
      productsListed: 0,
      productsListedFormatted: '0',
      storefrontsLive: 0,
      storefrontsLiveFormatted: '0',
      platformUptime: 99.9,
      platformUptimeFormatted: '99.9%',
      lastUpdated: new Date().toISOString()
    });
  }
});

// ====================
// PLATFORM DASHBOARD
// ====================

/**
 * GET /platform/dashboard - Get public platform dashboard data
 * Public endpoint that doesn't require authentication
 * Returns safe platform statistics for public display
 */
router.get('/platform/dashboard', async (_req, res) => {
  try {
    // For public users, return limited, safe dashboard data
    // Import the platform dashboard service
    const { platformDashboardSingleton } = await import('../services/PlatformDashboardSingletonService');
    
    // Get only public-safe stats (no sensitive tenant data)
    const stats = await platformDashboardSingleton.getPlatformStats();
    
    // Return only public-safe information
    const publicDashboardData = {
      stats: {
        totalTenants: (stats as any).totalTenants,
        totalProducts: (stats as any).totalItems || (stats as any).totalProducts,
        totalOrders: (stats as any).totalOrders || 0,
        totalRevenue: (stats as any).totalRevenue || 0,
        // Exclude sensitive metrics like activeUsers, storageUsage, etc.
      },
      // Exclude topTenants and recentActivity for privacy
      topTenants: [],
      recentActivity: []
    };

    res.json(publicDashboardData);
  } catch (error) {
    console.error('[Public Platform Dashboard] Error fetching public dashboard:', error);
    // Return safe defaults on error
    res.json({
      stats: {
        totalTenants: 0,
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
      },
      topTenants: [],
      recentActivity: []
    });
  }
});

// ====================
// PLATFORM BRANDING
// ====================

/**
 * GET /platform/branding - Get public platform branding settings
 * Public endpoint that doesn't require authentication
 */
router.get('/platform/branding', async (_req, res) => {
  try {
    // Check if Prisma client is properly initialized
    if (!prisma || !prisma.platform_settings_list) {
      console.warn('[Public Platform Branding] Prisma client not properly initialized, using defaults');
      return res.json({
        platformName: 'Visible Shelf',
        platformDescription: 'Retail visibility platform empowering local businesses with AI-powered inventory management, automated product enrichment, Google Business Profile sync, customizable digital storefronts, and a public directory connecting customers to local merchants—all designed to increase discoverability and drive sales.',
        logoUrl: null,
        faviconUrl: null,
        bannerUrl: null,
        themePreset: 'vibrant',
        themeColors: {
          primary: '#7c3aed',
          accent: '#f59e0b',
          neutral: '#64748b',
        },
        themeFontFamily: '"Poppins", sans-serif',
        themeBorderRadius: 'md',
        themeButtonSize: 'md',
        themeSpacing: 16,
        contactEmail: 'billing@visible-shelf.com',
        contactPhone: '',
        contactAddress: '',
        contactWebsite: 'https://visible-shelf.com',
        socialFacebook: '',
        socialTwitter: '',
        socialInstagram: '',
        socialLinkedIn: '',
        socialYoutube: '',
      });
    }

    let settings = await prisma.platform_settings_list.findUnique({
      where: { id: 1 },
    });

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.platform_settings_list.create({
        data: {
          id: 1, 
          platform_name: 'Visible Shelf',
          platform_description: 'Retail visibility platform empowering local businesses with AI-powered inventory management, automated product enrichment, Google Business Profile sync, customizable digital storefronts, and a public directory connecting customers to local merchants—all designed to increase discoverability and drive sales.',
          updated_at: new Date(),
        },
      });
    }

    // Return only public-safe branding information
    const publicBranding = {
      platformName: settings.platform_name,
      platformDescription: settings.platform_description,
      logoUrl: settings.logo_url,
      faviconUrl: settings.favicon_url,
      bannerUrl: settings.banner_url,
      // Include only safe theme settings
      themePreset: settings.theme_preset,
      themeColors: settings.theme_colors,
      themeFontFamily: settings.theme_font_family,
      themeBorderRadius: settings.theme_border_radius,
      themeButtonSize: settings.theme_button_size,
      themeSpacing: settings.theme_spacing,
      // Include public contact information
      contactEmail: settings.contact_email,
      contactPhone: settings.contact_phone,
      contactAddress: settings.contact_address,
      contactWebsite: settings.contact_website,
      // Include public social media links
      socialFacebook: settings.social_facebook,
      socialTwitter: settings.social_twitter,
      socialInstagram: settings.social_instagram,
      socialLinkedIn: settings.social_linkedin,
      socialYoutube: settings.social_youtube,
    };

    res.json(publicBranding);
  } catch (error) {
    console.error('[Public Platform Branding] Error fetching public branding:', error);
    // Return safe defaults on error
    res.json({
      platformName: 'Visible Shelf',
      platformDescription: 'Retail visibility platform empowering local businesses with AI-powered inventory management, automated product enrichment, Google Business Profile sync, customizable digital storefronts, and a public directory connecting customers to local merchants—all designed to increase discoverability and drive sales.',
      logoUrl: null,
      faviconUrl: null,
      bannerUrl: null,
      themePreset: 'vibrant',
      themeColors: {
        primary: '#7c3aed',
        accent: '#f59e0b',
        neutral: '#64748b',
      },
      themeFontFamily: '"Poppins", sans-serif',
      themeBorderRadius: 'md',
      themeButtonSize: 'md',
      themeSpacing: 16,
      contactEmail: 'billing@visible-shelf.com',
      contactPhone: '',
      contactAddress: '',
      contactWebsite: 'https://visible-shelf.com',
      socialFacebook: '',
      socialTwitter: '',
      socialInstagram: '',
      socialLinkedIn: '',
      socialYoutube: '',
    });
  }
});

// ====================
// UNIVERSAL RESOLVER ENDPOINTS
// ====================

/**
 * GET /api/resolver/:type/:identifier
 * Universal identifier resolver for all platform services
 * Type-safe resolution with automatic caching
 */
router.get('/resolver/:type/:identifier', async (req, res) => {
  try {
    const { type, identifier } = req.params;
    console.log(`[Public API] Resolver request: ${type}/${identifier}`);
    
    // Validate resolver type
    const validTypes = ['tenant', 'shop', 'product', 'category', 'directory'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid resolver type: ${type}. Valid types: ${validTypes.join(', ')}`
      });
    }

    // Use the universal identifier resolver
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();
    
    // Add timeout for identifier resolution to prevent hanging
    const identifierPromise = cache.resolveIdentifier(identifier);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Identifier resolution timeout')), 10000); // 10 second timeout
    });
    
    let resolved: any = null;
    try {
      resolved = await Promise.race([identifierPromise, timeoutPromise]);
      console.log(`[Public API] Successfully resolved identifier: ${type}/${identifier} → ${resolved?.id}`);
    } catch (error) {
      console.error(`[Public API] Error resolving identifier: ${type}/${identifier}`, error);
      return res.status(404).json({
        success: false,
        error: 'Identifier not found',
        message: `No ${type} found for identifier: ${identifier}`
      });
    }
    
    if (!resolved || !resolved.id) {
      return res.status(404).json({
        success: false,
        error: 'Identifier not found',
        message: `No ${type} found for identifier: ${identifier}`
      });
    }
    
    // Return resolved identifier with caching headers
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
    res.setHeader('X-Service-Source', 'Universal-Identifier-Cache');
    
    res.json({
      success: true,
      data: {
        resolvedId: resolved.id,
        type: type
      }
    });
    
  } catch (error) {
    console.error('[Public API] Error in resolver endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Resolution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mount shops routes under /shops
router.use('/shops', shopsRoutes);

// Mount tenants routes under /tenants
router.use('/tenants', tenantsRoutes);

// ====================
// STOREFRONT OPTIONS - Public resolved flags
// ====================

// Public endpoint - Get storefront options for storefront display
// DEPRECATED: Use GET /api/tenants/:tenantId/effective-capabilities instead
router.get('/tenant/:tenantId/storefront-options', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.warn(`[DEPRECATION] GET /api/public/tenant/${tenantId}/storefront-options is deprecated. Use /api/tenants/${tenantId}/effective-capabilities instead.`);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString());

    // Get merchant preferences
    const settings = await prisma.tenant_storefront_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const prefs = settings || DEFAULT_SETTINGS;

    // Get tenant's effective tier to resolve capability features
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        organization_id: true,
        organizations_list: {
          select: { subscription_tier: true },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    const effectiveTierKey = tenant.organizations_list?.subscription_tier || tenant.subscription_tier || 'starter';

    // Resolve tier_key -> tier_id (subscription_tier stores short keys like 'professional',
    // but tier_features_list.tier_id stores full IDs like 'tier_professional')
    const tierRecord = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: effectiveTierKey },
      select: { id: true },
    });
    const effectiveTierId = tierRecord?.id || effectiveTierKey;

    // Fetch tier features for storefront_options capability
    const capabilityType = await prisma.capability_type_list.findUnique({
      where: { key: 'storefront_options' },
      select: { id: true },
    });

    const tierFeatures = capabilityType
      ? await prisma.tier_features_list.findMany({
          where: {
            tier_id: effectiveTierId,
            feature_key: { startsWith: 'storefront_opt_' },
            is_enabled: true,
          },
          select: { feature_key: true },
        })
      : [];

    // Build feature map from tier features
    const features: Record<string, boolean> = {};
    for (const tf of tierFeatures) {
      features[tf.feature_key] = true;
    }

    // Resolve capability state (same logic as frontend resolveStorefrontOptionsState)
    const enabled = !!features.storefront_opt_enabled;
    const disabled = !!features.storefront_opt_disabled;
    const flexible = !!features.storefront_opt_flexible;
    const mainOn = enabled && !disabled;

    // Hours group
    const hoursGroupEnabled = !!features.storefront_opt_hours_enabled;
    const hoursGroupDisabled = !!features.storefront_opt_hours_disabled;
    const hoursEnabled = hoursGroupEnabled && !hoursGroupDisabled;
    const hoursUntouched = !hoursGroupEnabled && !hoursGroupDisabled;
    const allowedHoursTypes: string[] = [];
    if (flexible || hoursEnabled) {
      allowedHoursTypes.push('hours_animated', 'hours_status');
    } else if (hoursUntouched) {
      if (features.storefront_opt_hours_animated) allowedHoursTypes.push('hours_animated');
      if (features.storefront_opt_hours_status) allowedHoursTypes.push('hours_status');
    }

    // Category group
    const categoryGroupEnabled = !!features.storefront_opt_category_enabled;
    const categoryGroupDisabled = !!features.storefront_opt_category_disabled;
    const categoryEnabled = categoryGroupEnabled && !categoryGroupDisabled;
    const categoryUntouched = !categoryGroupEnabled && !categoryGroupDisabled;
    const allowedCategoryTypes: string[] = [];
    if (flexible || categoryEnabled) {
      allowedCategoryTypes.push('category_store', 'category_product');
    } else if (categoryUntouched) {
      if (features.storefront_opt_category_store) allowedCategoryTypes.push('category_store');
      if (features.storefront_opt_category_product) allowedCategoryTypes.push('category_product');
    }

    // Recommend group
    const recommendGroupEnabled = !!features.storefront_opt_recommend_enabled;
    const recommendGroupDisabled = !!features.storefront_opt_recommend_disabled;
    const recommendEnabled = recommendGroupEnabled && !recommendGroupDisabled;
    const recommendUntouched = !recommendGroupEnabled && !recommendGroupDisabled;
    const allowedRecommendTypes: string[] = [];
    if (flexible || recommendEnabled) {
      allowedRecommendTypes.push('recommend_store', 'recommend_products');
    } else if (recommendUntouched) {
      if (features.storefront_opt_recommend_store) allowedRecommendTypes.push('recommend_store');
      if (features.storefront_opt_recommend_products) allowedRecommendTypes.push('recommend_products');
    }

    // Section Display (standalone, no group gate)
    const hoursDisplayTierAllowed = flexible || !!features.storefront_opt_hours_display;
    const mapDisplayTierAllowed = flexible || !!features.storefront_opt_map_display;
    const locationDisplayTierAllowed = flexible || !!features.storefront_opt_location_display;

    // Recently viewed
    const recentlyViewedTierAllowed = flexible || !!features.storefront_opt_recently_viewed;

    // Info group
    const infoGroupEnabled = !!features.storefront_opt_info_enabled;
    const infoGroupDisabled = !!features.storefront_opt_info_disabled;
    const infoEnabled = infoGroupEnabled && !infoGroupDisabled;
    const infoUntouched = !infoGroupEnabled && !infoGroupDisabled;
    const allowedInfoTypes: string[] = [];
    if (flexible || infoEnabled) {
      allowedInfoTypes.push('storefront_social_media', 'storefront_contact', 'interactive_maps');
    } else if (infoUntouched) {
      if (features.storefront_opt_storefront_social_media) allowedInfoTypes.push('storefront_social_media');
      if (features.storefront_opt_storefront_contact) allowedInfoTypes.push('storefront_contact');
      if (features.storefront_opt_interactive_maps) allowedInfoTypes.push('interactive_maps');
    }

    // QR group
    const qrGroupEnabled = !!features.storefront_opt_qr_enabled;
    const qrGroupDisabled = !!features.storefront_opt_qr_disabled;
    const qrEnabled = qrGroupEnabled && !qrGroupDisabled;
    const qrUntouched = !qrGroupEnabled && !qrGroupDisabled;
    const allowedQRResolutions: string[] = [];
    const allowedQRContentTypes: string[] = [];
    if (flexible || qrEnabled) {
      allowedQRResolutions.push('qr_codes_512', 'qr_codes_1024', 'qr_codes_2048');
      allowedQRContentTypes.push('qr_product', 'qr_store', 'qr_logo', 'qr_directory');
    } else if (qrUntouched) {
      if (features.storefront_opt_qr_codes_512) allowedQRResolutions.push('qr_codes_512');
      if (features.storefront_opt_qr_codes_1024) allowedQRResolutions.push('qr_codes_1024');
      if (features.storefront_opt_qr_codes_2048) allowedQRResolutions.push('qr_codes_2048');
      if (features.storefront_opt_qr_product) allowedQRContentTypes.push('qr_product');
      if (features.storefront_opt_qr_store) allowedQRContentTypes.push('qr_store');
      if (features.storefront_opt_qr_logo) allowedQRContentTypes.push('qr_logo');
      if (features.storefront_opt_qr_directory) allowedQRContentTypes.push('qr_directory');
    }

    // Gallery group
    const galleryGroupEnabled = !!features.storefront_opt_gallery_enabled;
    const galleryGroupDisabled = !!features.storefront_opt_gallery_disabled;
    const galleryEnabled = galleryGroupEnabled && !galleryGroupDisabled;
    const galleryUntouched = !galleryGroupEnabled && !galleryGroupDisabled;
    const allowedGalleryTypes: string[] = [];
    if (flexible || galleryEnabled) {
      allowedGalleryTypes.push('image_gallery_5', 'image_gallery_10', 'image_gallery_15');
    } else if (galleryUntouched) {
      if (features.storefront_opt_image_gallery_5) allowedGalleryTypes.push('image_gallery_5');
      if (features.storefront_opt_image_gallery_10) allowedGalleryTypes.push('image_gallery_10');
      if (features.storefront_opt_image_gallery_15) allowedGalleryTypes.push('image_gallery_15');
    }

    // Advanced group
    const advancedGroupEnabled = !!features.storefront_opt_advanced_enabled;
    const advancedGroupDisabled = !!features.storefront_opt_advanced_disabled;
    const advancedEnabled = advancedGroupEnabled && !advancedGroupDisabled;
    const advancedUntouched = !advancedGroupEnabled && !advancedGroupDisabled;
    const allowedAdvancedTypes: string[] = [];
    if (flexible || advancedEnabled) {
      allowedAdvancedTypes.push('enhanced_seo', 'storefront_actions');
    } else if (advancedUntouched) {
      if (features.storefront_opt_enhanced_seo) allowedAdvancedTypes.push('enhanced_seo');
      if (features.storefront_opt_storefront_actions) allowedAdvancedTypes.push('storefront_actions');
    }

    // Layout group
    const layoutGroupEnabled = !!features.storefront_opt_layout_enabled;
    const layoutGroupDisabled = !!features.storefront_opt_layout_disabled;
    const layoutEnabled = layoutGroupEnabled && !layoutGroupDisabled;
    const layoutUntouched = !layoutGroupEnabled && !layoutGroupDisabled;
    const allowedLayouts: string[] = [];
    if (flexible || layoutEnabled) {
      allowedLayouts.push('classic', 'editorial', 'immersive');
    } else if (layoutUntouched) {
      if (features.storefront_opt_layout_classic) allowedLayouts.push('classic');
      if (features.storefront_opt_layout_editorial) allowedLayouts.push('editorial');
      if (features.storefront_opt_layout_immersive) allowedLayouts.push('immersive');
    }

    // Compute effective flags (tier-allowed AND merchant-enabled)
    const optEnabled = prefs.storefront_opt_enabled !== false;
    const effectiveHoursTypes = optEnabled
      ? allowedHoursTypes.filter(t => (prefs as any)[t] !== false)
      : [];
    const effectiveCategoryTypes = optEnabled
      ? allowedCategoryTypes.filter(t => (prefs as any)[t] !== false)
      : [];
    const effectiveRecommendTypes = optEnabled
      ? allowedRecommendTypes.filter(t => (prefs as any)[t] !== false)
      : [];
    const effectiveHoursDisplay = optEnabled && hoursDisplayTierAllowed && prefs.hours_display !== false;
    const effectiveMapDisplay = optEnabled && mapDisplayTierAllowed && prefs.map_display !== false;
    const effectiveLocationDisplay = optEnabled && locationDisplayTierAllowed && prefs.location_display !== false;
    const effectiveRecentlyViewed = optEnabled && recentlyViewedTierAllowed && prefs.recently_viewed !== false;
    const effectiveInfoTypes = optEnabled
      ? allowedInfoTypes.filter(t => (prefs as any)[t] !== false)
      : [];
    const effectiveQRResolutions = optEnabled
      ? allowedQRResolutions.filter(t => (prefs as any)[t] !== false)
      : [];
    const effectiveQRContentTypes = optEnabled
      ? allowedQRContentTypes.filter(t => (prefs as any)[t] !== false)
      : [];
    const effectiveGalleryTypes = optEnabled
      ? allowedGalleryTypes.filter(t => (prefs as any)[t] !== false)
      : [];
    const effectiveAdvancedTypes = optEnabled
      ? allowedAdvancedTypes.filter(t => (prefs as any)[t] !== false)
      : [];

    // Resolve QR resolution and gallery limit
    let qrResolution = '';
    if (mainOn && effectiveQRResolutions.length > 0) {
      if (effectiveQRResolutions.includes('qr_codes_2048')) qrResolution = '2048';
      else if (effectiveQRResolutions.includes('qr_codes_1024')) qrResolution = '1024';
      else if (effectiveQRResolutions.includes('qr_codes_512')) qrResolution = '512';
    }

    let galleryLimit = 0;
    if (mainOn && effectiveGalleryTypes.length > 0) {
      if (effectiveGalleryTypes.includes('image_gallery_15')) galleryLimit = 15;
      else if (effectiveGalleryTypes.includes('image_gallery_10')) galleryLimit = 10;
      else if (effectiveGalleryTypes.includes('image_gallery_5')) galleryLimit = 5;
    }

    // Return resolved flags for public consumption
    res.json({
      success: true,
      flags: {
        showHoursDisplay: mainOn && effectiveHoursDisplay,
        showAnimatedHours: mainOn && effectiveHoursTypes.includes('hours_animated'),
        showHoursStatus: mainOn && effectiveHoursTypes.includes('hours_status'),
        showMapDisplay: mainOn && effectiveMapDisplay,
        showLocationDisplay: mainOn && effectiveLocationDisplay,
        showCategoryStore: mainOn && effectiveCategoryTypes.includes('category_store'),
        showCategoryProduct: mainOn && effectiveCategoryTypes.includes('category_product'),
        showRecommendStore: mainOn && effectiveRecommendTypes.includes('recommend_store'),
        showRecommendProducts: mainOn && effectiveRecommendTypes.includes('recommend_products'),
        showRecentlyViewed: mainOn && effectiveRecentlyViewed,
        showSocialMedia: mainOn && effectiveInfoTypes.includes('storefront_social_media'),
        showContact: mainOn && effectiveInfoTypes.includes('storefront_contact'),
        showInteractiveMaps: mainOn && effectiveInfoTypes.includes('interactive_maps'),
        showQRCodes: mainOn && (effectiveQRResolutions.length > 0 || effectiveQRContentTypes.length > 0),
        showQRProduct: mainOn && effectiveQRContentTypes.includes('qr_product'),
        showQRStore: mainOn && effectiveQRContentTypes.includes('qr_store'),
        showQRLogo: mainOn && effectiveQRContentTypes.includes('qr_logo'),
        showQRDirectory: mainOn && effectiveQRContentTypes.includes('qr_directory'),
        qrResolution,
        qrResolutions: effectiveQRResolutions,
        galleryLimit,
        showEnhancedSEO: mainOn && effectiveAdvancedTypes.includes('enhanced_seo'),
        showStorefrontActions: mainOn && effectiveAdvancedTypes.includes('storefront_actions'),
        storefrontLayout: allowedLayouts.includes(prefs.storefront_layout || 'classic')
          ? (prefs.storefront_layout || 'classic')
          : (allowedLayouts[0] || 'classic'),
      },
      tierKey: effectiveTierKey,
    });
  } catch (error) {
    console.error('Error fetching public storefront options:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch storefront options',
    });
  }
});

// ====================
// PRODUCT OPTIONS - Public resolved flags
// ====================

// Public endpoint - Get product options for storefront
// DEPRECATED: Use GET /api/tenants/:tenantId/effective-capabilities instead
router.get('/tenant/:tenantId/product-options', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.warn(`[DEPRECATION] GET /api/public/tenant/${tenantId}/product-options is deprecated. Use /api/tenants/${tenantId}/effective-capabilities instead.`);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString());

    const productService = ProductOptionsService.getInstance();
    const tierState = await productService.resolveProductOptionsState(tenantId);

    // Fetch merchant preferences
    const merchantPrefs = await prisma.tenant_product_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    // Build resolved section flags (tier-allowed AND merchant-enabled)
    const prefs = merchantPrefs || {
      product_opt_recently_viewed: true,
      product_opt_qr_codes: true,
      product_opt_recommended: true,
      product_opt_map_display: true,
      product_opt_location_display: true,
      product_opt_hours_display: true,
      product_opt_enhanced_seo: true,
      product_opt_reviews: true,
      product_opt_fulfillment: true,
      product_opt_categories: true,
      product_opt_location_availability: true,
    };

    const enabled = tierState.enabled;

    const sectionFlags = {
      showsRecentlyViewed: enabled && tierState.showsRecentlyViewed && (prefs as any).product_opt_recently_viewed !== false,
      showsQRCodes: enabled && tierState.showsQRCodes && (prefs as any).product_opt_qr_codes !== false,
      showsRecommended: enabled && tierState.showsRecommended && (prefs as any).product_opt_recommended !== false,
      showsMapDisplay: enabled && tierState.showsMapDisplay && (prefs as any).product_opt_map_display !== false,
      showsLocationDisplay: enabled && tierState.showsLocationDisplay && (prefs as any).product_opt_location_display !== false,
      showsHoursDisplay: enabled && tierState.showsHoursDisplay && (prefs as any).product_opt_hours_display !== false,
      showsEnhancedSEO: enabled && tierState.showsEnhancedSEO && (prefs as any).product_opt_enhanced_seo !== false,
      showsReviews: enabled && tierState.showsReviews && (prefs as any).product_opt_reviews !== false,
      showsFulfillment: enabled && tierState.showsFulfillment && (prefs as any).product_opt_fulfillment !== false,
      showsCategories: enabled && tierState.showsCategories && (prefs as any).product_opt_categories !== false,
      showsLocationAvailability: enabled && tierState.showsLocationAvailability && (prefs as any).product_opt_location_availability !== false,
    };

    res.setHeader('Cache-Control', 'public, max-age=60'); // 1 min cache
    res.json({
      success: true,
      flags: {
        enabled: tierState.enabled,
        allowedTypes: tierState.allowedTypes,
        showsVariants: tierState.showsVariants,
        showsGallery: tierState.showsGallery,
        showsVideo: tierState.showsVideo,
        layoutEnabled: tierState.layoutEnabled,
        allowedLayouts: tierState.allowedLayouts,
        effectiveLayout: tierState.allowedLayouts.includes((prefs as any).product_layout || 'classic')
          ? (prefs as any).product_layout || 'classic'
          : (tierState.allowedLayouts[0] || 'classic'),
        ...sectionFlags,
      },
      tierState: {
        enabled: tierState.enabled,
        allowedTypes: tierState.allowedTypes,
        showsVariants: tierState.showsVariants,
        showsGallery: tierState.showsGallery,
        showsVideo: tierState.showsVideo,
        layoutEnabled: tierState.layoutEnabled,
        allowedLayouts: tierState.allowedLayouts,
        showsRecentlyViewed: tierState.showsRecentlyViewed,
        showsQRCodes: tierState.showsQRCodes,
        showsRecommended: tierState.showsRecommended,
        showsMapDisplay: tierState.showsMapDisplay,
        showsLocationDisplay: tierState.showsLocationDisplay,
        showsHoursDisplay: tierState.showsHoursDisplay,
        showsEnhancedSEO: tierState.showsEnhancedSEO,
        showsReviews: tierState.showsReviews,
        showsFulfillment: tierState.showsFulfillment,
        showsCategories: tierState.showsCategories,
        showsLocationAvailability: tierState.showsLocationAvailability,
      },
    });
  } catch (error) {
    console.error('Error fetching public product options:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch product options',
    });
  }
});

/**
 * GET /api/public/platform-fee
 * Get current platform fee percentage (public, no auth required)
 */
router.get('/platform-fee', async (_req, res) => {
  try {
    const { basePrisma } = await import('../prisma');
    const platformConfig = await basePrisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
      select: { default_platform_fee_percent: true },
    });

    const percentage = platformConfig?.default_platform_fee_percent ?? 3.0;

    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
    res.json({
      success: true,
      platformFeePercentage: percentage,
    });
  } catch (error) {
    console.error('[Public API] Error fetching platform fee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch platform fee',
    });
  }
});

// ====================
// PUBLIC INQUIRIES (anonymous + authenticated)
// ====================

const PublicInquirySchema = z.object({
  tenant_id: z.string().min(1, 'Tenant ID is required'),
  subject: z.string().min(2, 'Subject is required').max(200),
  body: z.string().max(2000).optional(),
  sender_name: z.string().max(100).optional(),
  sender_email: z.string().email().optional(),
  sender_phone: z.string().max(50).optional(),
  // CAPTCHA fields
  captcha_answer: z.string().min(1, 'CAPTCHA verification required'),
  captcha_seed: z.string().min(1, 'CAPTCHA seed required'),
  // Honeypot — must be empty (bot fills hidden fields)
  website_hp: z.string().max(0).optional(),
});

/**
 * POST /api/public/inquiries
 * Submit an inquiry to a tenant — no auth required.
 * Protected by client-side math CAPTCHA + honeypot.
 * If a valid customer session exists, links the inquiry to that customer.
 */
router.post('/inquiries', async (req, res) => {
  // Optional customer auth - if valid token present, attach customer context
  const { optionalCustomerAuth } = await import('../middleware/auth');
  await optionalCustomerAuth(req, res, () => {});

  try {
    const parse = PublicInquirySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        details: parse.error.flatten().fieldErrors,
      });
    }

    const { tenant_id, subject, body, sender_name, sender_email, sender_phone, captcha_answer, captcha_seed, website_hp } = parse.data;

    // Honeypot check — if filled, silently accept (don't tell bots it failed)
    if (website_hp !== undefined && website_hp !== '') {
      return res.json({ success: true, data: { id: 'hp-rejected' } });
    }

    // Verify math CAPTCHA: seed encodes two numbers and the answer must match
    // Format: seed = "num1,num2" → answer must equal num1 + num2
    try {
      const [a, b] = captcha_seed.split(',').map(Number);
      if (isNaN(a) || isNaN(b) || Number(captcha_answer) !== a + b) {
        return res.status(400).json({
          success: false,
          error: 'captcha_failed',
          message: 'CAPTCHA verification failed. Please try again.',
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: 'captcha_failed',
        message: 'CAPTCHA verification failed. Please try again.',
      });
    }

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id },
      select: { id: true, name: true },
    });
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'tenant_not_found' });
    }

    // Determine source and optional customer link
    let customerId: string | undefined;
    let source = 'public_form';

    // Check if customer session exists (authenticated customer submitting)
    if (req.customer?.id) {
      customerId = req.customer.id;
      source = 'customer_portal';
    }

    const { CrmInquiryService } = await import('../services/CrmInquiryService');
    const inquiryService = CrmInquiryService.getInstance();

    // Use customer contact info if authenticated, otherwise use form input
    const finalSenderName = sender_name || (req.customer?.first_name && req.customer?.last_name
      ? `${req.customer.first_name} ${req.customer.last_name}`
      : req.customer?.first_name || req.customer?.email?.split('@')[0] || undefined);
    const finalSenderEmail = sender_email || req.customer?.email || undefined;
    const finalSenderPhone = sender_phone || req.customer?.phone || undefined;

    const inquiry = await inquiryService.create({
      tenant_id,
      subject,
      body: body || undefined,
      customer_id: customerId,
      source,
      sender_name: finalSenderName,
      sender_email: finalSenderEmail,
      sender_phone: finalSenderPhone,
      // contact_id links to crm_contacts; only set when a verified contact exists
      contact_id: undefined,
    });

    // Log activity
    try {
      const { prisma: p } = await import('../prisma');
      await p.crm_activities.create({
        data: {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          tenant_id,
          actor_id: finalSenderEmail || 'anonymous',
          actor_name: finalSenderName || 'Anonymous',
          activity_type: 'inquiry_created',
          content: `New inquiry: ${subject}`,
          is_internal: false,
        },
      });
    } catch (actErr) {
      console.error('[Public Inquiry] Activity log error (non-critical):', actErr);
    }

    console.log(`[Public Inquiry] Created inquiry ${inquiry.id} for tenant ${tenant_id} from ${finalSenderEmail || 'anonymous'} (customer_id: ${customerId || 'none'})`);

    res.status(201).json({ success: true, data: inquiry });
  } catch (error) {
    console.error('[Public Inquiry] Error creating inquiry:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to submit inquiry' });
  }
});

export default router;
