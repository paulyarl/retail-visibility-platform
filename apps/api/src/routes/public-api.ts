/**
 * Public API Routes - Singleton System
 * 
 * These routes provide public access to singleton-managed data
 * with appropriate caching and performance optimizations.
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

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
  radius: z.string().transform(Number).default(50)
});

const StoreQuerySchema = z.object({
  limit: z.string().transform(Number).default(10),
  offset: z.string().transform(Number).default(0),
  search: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional()
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
    
    // Use materialized view for performance (has universal stock filtering applied)
    const featuredProducts = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string;
      name: string;
      description: string | null;
      price_cents: number;
      image_url: string | null;
      stock: number;
      availability: string | null;
      featured_type: string | null;
      featured_priority: number;
      featured_at: Date;
    }>>`
      SELECT 
        id,
        tenant_id,
        name,
        description,
        price_cents,
        image_url,
        stock,
        availability,
        featured_type,
        featured_priority,
        featured_at
      FROM storefront_products_mv 
      WHERE is_featured_active = true 
        AND featured_type = 'store_selection'
      ORDER BY featured_priority DESC, featured_at DESC
      LIMIT ${query.limit * 3}
    `;

    // Get tenant information for the products
    const tenantIds = [...new Set(featuredProducts.map(fp => fp.tenant_id))];
    const tenants = await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true }
    });

    const tenantMap = new Map(tenants.map(t => [t.id, t]));

    // Randomize selection from featured products (MV already filtered by stock)
    const shuffled = featuredProducts.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, query.limit);

    res.json({
      success: true,
      products: selected.map(fp => {
        const tenant = tenantMap.get(fp.tenant_id);
        return {
          id: fp.id,
          name: fp.name,
          description: fp.description,
          price: fp.price_cents ? fp.price_cents / 100 : null,
          imageUrl: fp.image_url || null,
          tenant: {
            id: tenant?.id || fp.tenant_id,
            name: tenant?.name || 'Store Name',
            slug: tenant?.slug || 'store-slug'
          },
          availability: fp.stock > 0 ? 'in_stock' : 'out_of_stock',
          distance: query.lat && query.lng ? Math.random() * 50 : null // Mock distance
        };
      }),
      location: query.lat && query.lng ? {
        lat: parseFloat(query.lat as unknown as string),
        lng: parseFloat(query.lng as unknown as string),
        radius: query.radius
      } : null
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

// ====================
// PUBLIC CATEGORIES ENDPOINTS
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

export default router;
