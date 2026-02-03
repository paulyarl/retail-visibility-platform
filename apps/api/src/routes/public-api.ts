/**
 * Public API Routes - Singleton System
 * 
 * These routes provide public access to singleton-managed data
 * with appropriate caching and performance optimizations.
 */

import { Router } from 'express';
import { z } from 'zod';
import shopsRoutes from './shops';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

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
  lat: z.string().transform(Number).optional(),
  lng: z.string().transform(Number).optional(),
  radius: z.string().transform(Number).default(50),
  tenantId: z.string().optional()
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
 * GET /api/public/products
 * Get public products with filtering and pagination
 */
router.get('/products', async (req, res) => {
  try {
    const query = ProductQuerySchema.parse(req.query);
    
    const where = {
      item_status: 'active' as const,
      ...(query.category && { category: { slug: query.category } }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const }, description: { contains: query.search, mode: 'insensitive' as const } }
        ]
      })
    };

    const [products, total] = await Promise.all([
      prisma.inventory_items.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order }
      }),
      prisma.inventory_items.count({ where })
    ]);

    res.json({
      success: true,
      products: products.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price_cents ? product.price_cents / 100 : null,
        imageUrl: product.image_url || null,
        tenant: {
          id: product.tenant_id,
          name: 'Store Name', // Placeholder since tenant relationship not included
          slug: 'store-slug'   // Placeholder since tenant relationship not included
        },
        availability: 'in_stock', // Default availability
        createdAt: product.created_at
      })),
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products'
    });
  }
});

/**
 * GET /api/public/products/featured
 * Get featured products with location awareness
 */
router.get('/products/featured', async (req, res) => {
  try {
    const query = FeaturedProductsQuerySchema.parse(req.query);
    
    console.log('[PUBLIC API] Featured products query:', query);
    
    // Use mv_global_discovery materialized view for optimized featured products query
    try {
      // Use direct pool query like storefront-featured.ts
      const { getDirectPool } = await import('../utils/db-pool');
      const pool = getDirectPool();
      
      const sqlQuery = `
        SELECT DISTINCT 
          mv.*
        FROM mv_global_discovery mv
        WHERE mv.tenant_id = $1
          AND mv.featured_is_active = true
          AND mv.item_status = 'active'
          AND mv.visibility = 'public'
        ORDER BY mv.featured_priority DESC, mv.featured_at DESC
        LIMIT $2
      `;
      
      const result = await pool.query(sqlQuery, [query.tenantId, query.limit * 3]);
      
      const featuredProducts = result.rows;
      
      console.log('[PUBLIC API] Raw query successful, products:', featuredProducts.length);
      
      // Debug: Log featured type distribution
      const featuredTypeCounts = featuredProducts.reduce((acc: Record<string, number>, product: any) => {
        const type = product.featured_type || 'store_selection';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      console.log('[PUBLIC API] Featured type distribution:', featuredTypeCounts);
      
      // Debug: Check for duplicates
      const productIds = featuredProducts.map((p: any) => p.id);
      const uniqueIds = new Set(productIds);
      console.log('[PUBLIC API] Product count check:', {
        total: featuredProducts.length,
        unique: uniqueIds.size,
        duplicates: featuredProducts.length - uniqueIds.size
      });
      
      // Get tenant information for the products
      const tenantIds = [...new Set(featuredProducts.map(fp => fp.tenant_id))];
      const tenants = await prisma.tenants.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true, slug: true }
      });

      const tenantMap = new Map(tenants.map(t => [t.id, t]));

      // Randomize selection from featured products (preserve all featured type assignments)
      const shuffled = featuredProducts.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, query.limit);

      res.json({
        success: true,
        products: selected.map(fp => {
          const tenant = tenantMap.get(fp.tenant_id);
          return {
            // Product Info
            id: fp.inventory_item_id,
            name: fp.product_name,
            title: fp.product_title,
            description: fp.product_description,
            marketingDescription: fp.marketing_description,
            price: fp.current_price_cents ? fp.current_price_cents / 100 : null,
            priceFormatted: fp.price,
            priceCents: fp.current_price_cents,
            listPriceCents: fp.list_price_cents,
            salePriceCents: fp.sale_price_cents,
            currency: fp.currency,
            imageUrl: fp.image_url || null,
            imageGallery: fp.image_urls,
            
            // Product Details
            sku: fp.sku,
            brand: fp.brand,
            manufacturer: fp.manufacturer,
            condition: fp.condition,
            gtin: fp.gtin,
            mpn: fp.mpn,
            stock: fp.stock,
            quantity: fp.quantity,
            availability: fp.availability,
            itemStatus: fp.item_status,
            visibility: fp.visibility,
            
            // Featured Info
            featuredType: fp.featured_type,
            featuredPriority: fp.featured_priority,
            featuredAt: fp.featured_at,
            featuredUntil: fp.featured_until,
            isFeatured: fp.featured_is_active,
            isActivelyFeatured: fp.is_actively_featured,
            
            // Category Info
            categoryName: fp.product_category,
            categorySlug: fp.product_category_slug,
            googleCategoryId: fp.product_google_category_id,
            
            // Flags
            hasImage: fp.has_image,
            hasGallery: fp.has_gallery,
            hasDescription: fp.has_description,
            hasBrand: fp.has_brand,
            hasPrice: fp.has_price,
            inStock: fp.in_stock,
            hasActivePaymentGateway: fp.has_active_payment_gateway,
            defaultGatewayType: fp.default_gateway_type,
            
            // Timestamps
            createdAt: fp.created_at,
            updatedAt: fp.updated_at,
            
            // Tenant Info
            tenant: {
              id: fp.tenant_id,
              name: fp.tenant_name,
              slug: fp.tenant_slug || 'store-slug',
              subscriptionTier: fp.subscription_tier,
              city: fp.tenant_city,
              state: fp.tenant_state,
              address: fp.tenant_address,
              latitude: fp.tenant_latitude,
              longitude: fp.tenant_longitude
            },
            
            distance: query.lat && query.lng ? Math.random() * 50 : null // Mock distance
          };
        }),
        location: query.lat && query.lng ? {
          lat: parseFloat(query.lat as unknown as string),
          lng: parseFloat(query.lng as unknown as string),
          radius: query.radius
        } : null
      });
    } catch (rawQueryError) {
      console.error('[PUBLIC API] Raw query failed, trying fallback:', rawQueryError);
      
      // Fallback: Also use mv_global_discovery with direct pool
      const { getDirectPool } = await import('../utils/db-pool');
      const pool = getDirectPool();
      
      const fallbackQuery = `
        SELECT DISTINCT 
          mv.*
        FROM mv_global_discovery mv
        WHERE mv.tenant_id = $1
          AND mv.featured_is_active = true
          AND mv.item_status = 'active'
          AND mv.visibility = 'public'
        ORDER BY mv.featured_priority DESC, mv.featured_at DESC
        LIMIT $2
      `;
      
      const fallbackResult = await pool.query(fallbackQuery, [query.tenantId, query.limit * 3]);
      
      const allFeaturedProducts = fallbackResult.rows;
      
      console.log('[PUBLIC API] Fallback query successful, products:', allFeaturedProducts.length);
      
      // Debug: Log featured type distribution
      const featuredTypeCounts = allFeaturedProducts.reduce((acc: Record<string, number>, product: any) => {
        const type = product.featured_type || 'store_selection';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      console.log('[PUBLIC API] Fallback featured type distribution:', featuredTypeCounts);
      
      // Debug: Check for duplicates
      const productIds = allFeaturedProducts.map((p: any) => p.id);
      const uniqueIds = new Set(productIds);
      console.log('[PUBLIC API] Fallback product count check:', {
        total: allFeaturedProducts.length,
        unique: uniqueIds.size,
        duplicates: allFeaturedProducts.length - uniqueIds.size
      });
      
      // Get tenant information
      const tenantIds = [...new Set(allFeaturedProducts.map(fp => fp.tenant_id))];
      const tenants = await prisma.tenants.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true, slug: true }
      });

      const tenantMap = new Map(tenants.map(t => [t.id, t]));

      // Randomize selection from featured products (preserve all featured type assignments)
      const shuffled = allFeaturedProducts.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, query.limit);

      res.json({
        success: true,
        products: selected.map(fp => ({
          // Product Info
          id: fp.inventory_item_id,
          name: fp.product_name,
          title: fp.product_title,
          description: fp.product_description,
          marketingDescription: fp.marketing_description,
          price: fp.current_price_cents ? fp.current_price_cents / 100 : null,
          priceFormatted: fp.price,
          priceCents: fp.current_price_cents,
          listPriceCents: fp.list_price_cents,
          salePriceCents: fp.sale_price_cents,
          currency: fp.currency,
          imageUrl: fp.image_url || null,
          imageGallery: fp.image_urls,
          
          // Product Details
          sku: fp.sku,
          brand: fp.brand,
          manufacturer: fp.manufacturer,
          condition: fp.condition,
          gtin: fp.gtin,
          mpn: fp.mpn,
          stock: fp.stock,
          quantity: fp.quantity,
          availability: fp.availability,
          itemStatus: fp.item_status,
          visibility: fp.visibility,
          
          // Featured Info
          featuredType: fp.featured_type,
          featuredPriority: fp.featured_priority,
          featuredAt: fp.featured_at,
          featuredUntil: fp.featured_until,
          isFeatured: fp.featured_is_active,
          isActivelyFeatured: fp.is_actively_featured,
          
          // Category Info
          categoryName: fp.product_category,
          categorySlug: fp.product_category_slug,
          googleCategoryId: fp.product_google_category_id,
          
          // Flags
          hasImage: fp.has_image,
          hasGallery: fp.has_gallery,
          hasDescription: fp.has_description,
          hasBrand: fp.has_brand,
          hasPrice: fp.has_price,
          inStock: fp.in_stock,
          hasActivePaymentGateway: fp.has_active_payment_gateway,
          defaultGatewayType: fp.default_gateway_type,
          
          // Timestamps
          createdAt: fp.created_at,
          updatedAt: fp.updated_at,
          
          // Tenant Info
          tenant: {
            id: fp.tenant_id,
            name: fp.tenant_name,
            slug: fp.tenant_slug || 'store-slug',
            subscriptionTier: fp.subscription_tier,
            city: fp.tenant_city,
            state: fp.tenant_state,
            address: fp.tenant_address,
            latitude: fp.tenant_latitude,
            longitude: fp.tenant_longitude
          },
          
          distance: query.lat && query.lng ? Math.random() * 50 : null // Mock distance
        })),
        location: query.lat && query.lng ? {
          lat: parseFloat(query.lat as unknown as string),
          lng: parseFloat(query.lng as unknown as string),
          radius: query.radius
        } : null
      });
    }
  } catch (error) {
    console.error('[PUBLIC API] Featured products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured products'
    });
  }
});

/**
 * GET /api/public/products/search
 * Search products with advanced filtering
 */
router.get('/products/search', async (req, res) => {
  try {
    const query = ProductQuerySchema.parse(req.query);
    
    if (!query.search) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const where = {
      item_status: 'active' as const,
      OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { description: { contains: query.search, mode: 'insensitive' as const } },
        { sku: { contains: query.search, mode: 'insensitive' as const } }
      ]
    };

    const products = await prisma.inventory_items.findMany({
      where,
      take: query.limit,
      skip: query.offset,
      orderBy: { [query.sort]: query.order }
    });

    res.json({
      success: true,
      query: query.search,
      products: products.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price_cents ? product.price_cents / 100 : null,
        imageUrl: product.image_url || null,
        tenant: {
          id: product.tenant_id,
          name: 'Store Name', // Placeholder
          slug: 'store-slug'   // Placeholder
        },
        availability: 'in_stock' // Default
      }))
    });
  } catch (error) {
    console.error('[PUBLIC API] Product search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search products'
    });
  }
});

/**
 * GET /api/public/products/:id
 * Get single product by ID
 */
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.inventory_items.findFirst({
      where: { 
        id,
        item_status: 'active' as const
      },
      include: {
        photo_assets: true,
        tenants: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price_cents ? product.price_cents / 100 : null,
        sku: product.sku,
        availability: product.stock > 0 ? 'in_stock' : 'out_of_stock',
        images: product.photo_assets.map((photo: any) => ({
          id: photo.id,
          url: photo.url,
          isPrimary: photo.is_primary
        })),
        tenant: product.tenants,
        createdAt: product.created_at,
        updatedAt: product.updated_at
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Product by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

/**
 * GET /api/public/products/categories
 * Get product categories with counts
 */
router.get('/products/categories', async (req, res) => {
  try {
    const categories = await prisma.platform_categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });

    // Get product counts separately
    const categoryIds = categories.map(c => c.id);
    const productCounts = await prisma.inventory_items.groupBy({
      by: ['directory_category_id'],
      where: {
        directory_category_id: { in: categoryIds },
        item_status: 'active'
      },
      _count: {
        id: true
      }
    });

    const countMap = productCounts.reduce((acc: Record<string, number>, item: any) => {
      acc[item.directory_category_id] = item._count.id;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      categories: categories.map(category => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        productCount: countMap[category.id] || 0
      }))
    });
  } catch (error) {
    console.error('[PUBLIC API] Product categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product categories'
    });
  }
});

// ====================
// PUBLIC STORES ENDPOINTS
// ====================

/**
 * GET /api/public/stores
 * Get public stores with filtering
 */
router.get('/stores', async (req, res) => {
  try {
    const query = StoreQuerySchema.parse(req.query);
    
    const where = {
      isActive: true,
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const }, description: { contains: query.search, mode: 'insensitive' as const } }
        ]
      }),
      ...(query.city && { city: query.city }),
      ...(query.state && { state: query.state })
    };

    const [stores, total] = await Promise.all([
      prisma.tenants.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        include: {
          _count: {
            select: {
              inventory_items: {
                where: { item_status: 'active' as const }
              }
            }
          }
        }
      }),
      prisma.tenants.count({ where })
    ]);

    res.json({
      success: true,
      stores: stores.map(store => {
        const metadata = store.metadata as any || {};
        return {
          id: store.id,
          name: store.name,
          slug: store.slug,
          description: metadata.description || null,
          address: metadata.address || null,
          city: metadata.city || null,
          state: metadata.state || null,
          zipCode: metadata.zipCode || null,
          country: metadata.country || null,
          productCount: store._count.inventory_items,
          createdAt: store.created_at
        };
      }),
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total
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
 * Search stores
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

    const stores = await prisma.tenants.findMany({
      where: {
        subscription_status: 'active',
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { metadata: { path: ['description'], string_contains: query.search } },
          { metadata: { path: ['city'], string_contains: query.search } }
        ]
      },
      take: query.limit,
      skip: query.offset
    });

    res.json({
      success: true,
      query: query.search,
      stores: stores.map(store => {
        const metadata = store.metadata as any || {};
        return {
          id: store.id,
          name: store.name,
          slug: store.slug,
          description: metadata.description || null,
          city: metadata.city || null,
          state: metadata.state || null
        };
      })
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
 * GET /api/public/stores/:slug
 * Get single store by slug
 */
router.get('/stores/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const store = await prisma.tenants.findFirst({
      where: { 
        slug,
        subscription_status: 'active'
      },
      include: {
        _count: {
          select: {
            inventory_items: {
              where: { item_status: 'active' as const }
            }
          }
        }
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    res.json({
      success: true,
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        description: (store.metadata as any)?.description || null,
        address: (store.metadata as any)?.address || null,
        city: (store.metadata as any)?.city || null,
        state: (store.metadata as any)?.state || null,
        zipCode: (store.metadata as any)?.zipCode || null,
        country: (store.metadata as any)?.country || null,
        productCount: store._count.inventory_items,
        createdAt: store.created_at
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Store by slug error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store'
    });
  }
});

/**
 * GET /api/public/stores/id/:tenantId
 * Get single store by tenant ID
 */
router.get('/stores/id/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const store = await prisma.tenants.findFirst({
      where: { 
        id: tenantId,
        subscription_status: 'active'
      },
      include: {
        _count: {
          select: {
            inventory_items: {
              where: { item_status: 'active' as const }
            }
          }
        }
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    res.json({
      success: true,
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        description: (store.metadata as any)?.description || null,
        address: (store.metadata as any)?.address || null,
        city: (store.metadata as any)?.city || null,
        state: (store.metadata as any)?.state || null,
        zipCode: (store.metadata as any)?.zipCode || null,
        country: (store.metadata as any)?.country || null,
        productCount: store._count.inventory_items,
        createdAt: store.created_at
      }
    });
  } catch (error) {
    console.error('[PUBLIC API] Store by tenant ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch store'
    });
  }
});

// ====================
// SHOPS ENDPOINTS
// ====================

/**
 * GET /api/public/shops
 * Get public shops with filtering
 */
router.get('/shops', async (req, res) => {
  try {
    const query = StoreQuerySchema.parse(req.query);
    
    // Build orderBy clause
    let orderBy: any = { name: 'asc' };
    if (query.sort === 'rating') {
      orderBy = { rating_avg: 'desc' };
    } else if (query.sort === 'newest') {
      orderBy = { created_at: 'desc' };
    } else if (query.sort === 'products') {
      orderBy = { inventory_items: { _count: 'desc' } };
    }
    
    const stores = await prisma.tenants.findMany({
      where: {
        subscription_status: 'active',
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { slug: { contains: query.search, mode: 'insensitive' } }
          ]
        }),
        ...(query.category && {
          metadata: {
            path: ['primary_category'],
            equals: query.category
          }
        })
      },
      select: {
        id: true,
        name: true,
        slug: true,
        subscription_tier: true,
        created_at: true,
        metadata: true,
        _count: {
          select: {
            inventory_items: {
              where: { item_status: 'active' as const }
            }
          }
        }
      },
      orderBy,
      take: query.limit,
      skip: query.page ? (query.page - 1) * query.limit : query.offset
    });

    const total = await prisma.tenants.count({
      where: {
        subscription_status: 'active',
        ...(query.search && {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { slug: { contains: query.search, mode: 'insensitive' } }
          ]
        })
      }
    });

    const currentPage = query.page || Math.floor(query.offset / query.limit) + 1;

    res.json({
      shops: stores.map(store => ({
        id: store.id,
        name: store.name,
        slug: store.slug,
        business_name: (store.metadata as any)?.businessName || store.name,
        logo_url: (store.metadata as any)?.logo_url || null,
        address: (store.metadata as any)?.address || null,
        city: (store.metadata as any)?.city || null,
        state: (store.metadata as any)?.state || null,
        zip_code: (store.metadata as any)?.zipCode || null,
        phone: (store.metadata as any)?.phone || null,
        website: (store.metadata as any)?.website || null,
        rating_avg: undefined, // Not available in current schema
        rating_count: undefined, // Not available in current schema
        product_count: (store as any)._count?.inventory_items || 0,
        is_published: true, // All active tenants are considered published for shops
        primary_category: (store.metadata as any)?.primary_category || null
      })),
      pagination: {
        page: currentPage,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasMore: currentPage * query.limit < total
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

/**
 * GET /api/public/shops/:slug
 * Get single shop by slug (public access)
 */
router.get('/shops/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Use ShopService singleton
    const ShopService = (await import('../services/ShopService')).default;
    const shopService = ShopService.getInstance();
    
    const shop = await shopService.getShopBySlug(slug);
    
    if (!shop) {
      return res.status(404).json({
        success: false,
        error: 'Shop not found'
      });
    }
    
    res.setHeader('Cache-Control', 'public, max-age=900'); // 15 min cache
    res.setHeader('X-Service-Source', 'ShopService-Singleton');
    
    res.json({
      success: true,
      shop
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PUBLIC API] Error fetching shop by slug:', errorMessage);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop',
      message: errorMessage
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
        source: 'mv_global_discovery',
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
    res.setHeader('X-MV-Source', 'mv_global_discovery');

    res.json({
      success: true,
      data: shops,
      count: shops.length,
      type: 'nearby_shops',
      metadata: {
        source: 'mv_global_discovery',
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
  console.log('[PUBLIC API] Shops slug route HIT with slug:', req.params.slug);
  try {
    const { slug } = req.params;
    
    // Skip if this is a special route that should be handled elsewhere
    if (slug === 'trending' || slug === 'featured' || slug === 'id') {
      console.log('[PUBLIC API] Skipping special slug:', slug);
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
      console.log('[PUBLIC API] Detected tenant ID, fetching by tenant ID:', slug);
      shop = await shopService.getShopByTenantId(slug);
    } else {
      console.log('[PUBLIC API] Fetching by slug:', slug);
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
 * Universal discovery endpoint with scope-aware routing
 * 
 * Query parameters:
 * - scope: 'shop' | 'global' | 'location' | 'category' | 'timezone' (default: 'shop')
 * - tenantId: string (required for shop scope)
 * - limit: number (default: 12)
 * - sortBy: 'priority' | 'featuredAt' | 'expiresAt' | 'relevance' (default: 'priority')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 * 
 * Location scope (future):
 * - location[city]: string
 * - location[state]: string
 * - location[zip]: string
 * - location[country]: string
 * - location[radius]: number (miles)
 * 
 * Category scope:
 * - category[productName]: string (product category name)
 * - category[productId]: string (product category ID)
 * - category[googleProductId]: string (Google Product Category ID)
 * - category[shopCategoryName]: string (shop/GBP category name)
 * - category[shopCategoryId]: string (shop/GBP category ID)
 * - category[shopGoogleCategoryId]: string (Google Business Profile Category ID)
 * - category[categoryType]: 'product' | 'shop' | 'both' (default: 'product')
 * 
 * Timezone scope (future):
 * - timezone[timezone]: string
 * - timezone[offset]: number
 */
router.get('/shops/discover/:bucketType', async (req, res) => {
  const startTime = Date.now();
  try {
    const { bucketType } = req.params;
    console.log(`[PUBLIC API] Shops discovery request:`, {
      method: req.method,
      url: req.url,
      bucketType,
      query: req.query,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    });

    // Validate bucketType
    const validBucketTypes = ['random', 'trending', 'new', 'sale', 'seasonal', 'staff', 'selection'];
    if (!validBucketTypes.includes(bucketType)) {
      console.error(`[PUBLIC API] Invalid bucketType: ${bucketType}`);
      return res.status(400).json({
        success: false,
        error: `Invalid bucketType: ${bucketType}. Valid types: ${validBucketTypes.join(', ')}`
      });
    }
    
    const {
      scope = 'shop',
      tenantId,
      limit = 12,
      sortBy = 'priority',
      sortOrder = 'desc',
      ...otherQueryParams
    } = req.query;

    // Parse nested query parameters for location, category, timezone
    const location = otherQueryParams['location[city]'] ? {
      latitude: undefined,
      longitude: undefined,
      city: otherQueryParams['location[city]'] as string,
      state: otherQueryParams['location[state]'] as string,
      zip: otherQueryParams['location[zip]'] as string,
      country: otherQueryParams['location[country]'] as string,
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

    const products = await scopeRouter.routeDiscovery(bucketType, {
      scope: scope as 'shop' | 'global' | 'location' | 'category' | 'timezone',
      tenantId: tenantId as string,
      limit: parseInt(limit as string),
      sortBy: sortBy as 'priority' | 'featuredAt' | 'expiresAt' | 'relevance',
      sortOrder: sortOrder as 'asc' | 'desc',
      location,
      category,
      timezone
    });

    // Transform snake_case to camelCase for frontend compatibility
    const transformedProducts = Array.isArray(products) ? products.map((product: any) => ({
      ...product,
      inventoryItemId: product.inventory_item_id || product.inventoryItemId,
      productName: product.product_name || product.productName,
      imageUrl: product.image_url || product.imageUrl,
      priceCents: product.current_price_cents || product.priceCents,
      salePriceCents: product.sale_price_cents || product.salePriceCents,
      featuredType: product.featured_type || product.featuredType,
      tenantId: product.tenant_id || product.tenantId,
      tenantName: product.tenant_name || product.tenantName,
      tenantLogoUrl: product.tenant_logo_url || product.tenantLogoUrl
    })) : products;

    res.json({
      success: true,
      data: transformedProducts,
      scope,
      bucketType,
      cached: true,
      metrics: {
        cacheHit: true,
        responseTime: Date.now() - startTime,
        itemCount: Array.isArray(transformedProducts) ? transformedProducts.length : 0
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

/**
 * GET /api/public/shops/trending
 * Get trending shops with scope-aware routing
 */
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
    res.setHeader('X-MV-Source', 'mv_global_discovery');

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
    const categories = await prisma.platform_categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      categories: categories.map(category => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        googleCategoryId: category.google_category_id,
        productCount: 0 // Placeholder since we removed the count
      }))
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
    const categories = await prisma.platform_categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    });

    // Build tree structure
    const buildTree = (categories: any[], parentId: string | null = null): any[] => {
      return categories
        .filter(cat => cat.parent_id === parentId)
        .map(cat => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          iconEmoji: cat.icon_emoji,
          children: buildTree(categories, cat.id)
        }));
    };

    const tree = buildTree(categories);

    res.json({
      success: true,
      categories: tree
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

    const [products, total] = await Promise.all([
      prisma.inventory_items.findMany({
        where: {
          item_status: 'active' as const,
          directory_category_id: id
        },
        take: query.limit,
        skip: query.offset,
        orderBy: { [query.sort]: query.order },
        include: {
          photo_assets: {
            where: { position: 0 },
            take: 1
          },
          tenants: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      }),
      prisma.inventory_items.count({
        where: {
          item_status: 'active' as const,
          directory_category_id: id
        }
      })
    ]);

    res.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug
      },
      products: products.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price_cents ? product.price_cents / 100 : null,
        imageUrl: product.photo_assets[0]?.url || null,
        tenant: product.tenants,
        availability: product.availability
      })),
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < total
      }
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
        t.business_name,
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
      GROUP BY t.id, t.name, t.slug, t.business_name, t.logo_url
      HAVING COUNT(DISTINCT sp.id) > 0
      ORDER BY t.business_name ASC, t.name ASC
    `;
    
    const result = await pool.query(query);
    
    const tenants = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      business_name: row.business_name,
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

// Mount shops routes under /shops
router.use('/shops', shopsRoutes);

export default router;
