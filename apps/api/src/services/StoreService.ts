import { UniversalIdentifierCache } from './UniversalIdentifierCache';
import { UniversalSingleton } from '../lib/UniversalSingleton';

export interface StoreQuery {
  limit?: number;
  offset?: number;
  search?: string;
  city?: string;
  state?: string;
  sort?: 'rating' | 'newest' | 'products';
  category?: string;
  page?: number;
}

export interface StoreResult {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
  businessName?: string;
  logoUrl?: string | null;
  phone?: string | null;
  website?: string | null;
  primaryCategory?: string | null;
}

export interface StorePagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  page?: number;
  totalPages?: number;
}

export interface StoreResponse {
  stores: StoreResult[];
  pagination: StorePagination;
}

export class StoreService extends UniversalSingleton {
  private static instance: StoreService;
  private cache: UniversalIdentifierCache;

  protected constructor() {
    super('store-service');
    this.cache = UniversalIdentifierCache.getInstance();
  }

  static getInstance(): StoreService {
    if (!StoreService.instance) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance;
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      totalStores: 0,
      totalCategories: 0,
      totalLocations: 0
    };
  }

  /**
   * Get stores with filtering and pagination (UniversalSingleton caching)
   */
  async getStores(query: StoreQuery = {}): Promise<StoreResponse> {
    console.log(`[StoreService] Getting stores with query:`, query);

    // Create cache key for UniversalSingleton
    const cacheKey = `stores:${JSON.stringify(query)}`;

    // Check UniversalSingleton cache first
    const cached = await this.getFromCache<StoreResponse>(cacheKey);
    if (cached) {
      console.log(`[StoreService] Cache hit for stores query`);
      return cached;
    }

    console.log(`[StoreService] Cache miss, fetching stores from database`);

    // Build orderBy clause
    let orderBy: any = { name: 'asc' };
    if (query.sort === 'rating') {
      orderBy = { rating_avg: 'desc' };
    } else if (query.sort === 'newest') {
      orderBy = { created_at: 'desc' };
    } else if (query.sort === 'products') {
      orderBy = { inventory_items: { _count: 'desc' } };
    }

    const where: any = {
      subscription_status: 'active',
    };

    // Add search filter
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { slug: { contains: query.search, mode: 'insensitive' as const } }
      ];
    }

    // Add category filter
    if (query.category) {
      where.metadata = {
        path: ['primary_category'],
        equals: query.category
      };
    }

    // Add location filters
    if (query.city) {
      where.city = query.city;
    }
    if (query.state) {
      where.state = query.state;
    }

    const limit = Math.min(query.limit || 20, 100); // Cap at 100
    const offset = query.page ? (query.page - 1) * limit : (query.offset || 0);

    // Import prisma dynamically to avoid circular imports
    const { prisma } = await import('../prisma');

    // Execute query with pagination
    const [stores, total] = await Promise.all([
      prisma.tenants.findMany({
        where,
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
        take: limit,
        skip: offset
      }),
      prisma.tenants.count({ where })
    ]);

    console.log(`[StoreService] Found ${stores.length} stores out of ${total}`);

    // Transform results
    const transformedStores: StoreResult[] = stores.map((store: any) => {
      const metadata = store.metadata as any || {};
      return {
        id: store.id,
        name: store.name,
        slug: store.slug || '',
        description: metadata.description || null,
        address: metadata.address || null,
        city: metadata.city || null,
        state: metadata.state || null,
        zipCode: metadata.zipCode || null,
        country: metadata.country || null,
        productCount: store._count?.inventory_items || 0,
        createdAt: store.created_at,
        updatedAt: store.created_at, // Use created_at as fallback
        businessName: metadata.businessName || store.name,
        logoUrl: metadata.logo_url || null,
        phone: metadata.phone || null,
        website: metadata.website || null,
        primaryCategory: metadata.primary_category || null
      };
    });

    const currentPage = query.page || Math.floor(offset / limit) + 1;

    const result: StoreResponse = {
      stores: transformedStores,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        page: currentPage,
        totalPages: Math.ceil(total / limit)
      }
    };

    // Cache the result using UniversalSingleton
    await this.setCache(cacheKey, result, { ttl: 300 }); // 5 minutes cache
    console.log(`[StoreService] Cached stores query result`);

    return result;
  }

  /**
   * Get single store by identifier (universal identifier support)
   */
  async getStoreByIdentifier(identifier: string): Promise<StoreResult | null> {
    console.log(`[StoreService] Getting store by identifier: ${identifier}`);

    // Resolve tenant using universal identifier cache
    const resolvedTenant = await this.cache.resolveIdentifier(identifier);

    if (!resolvedTenant) {
      console.log(`[StoreService] No tenant found for identifier: ${identifier}`);
      return null;
    }

    console.log(`[StoreService] Resolved tenant: ${resolvedTenant.id} (${resolvedTenant.type})`);

    const { prisma } = await import('../prisma');

    const store = await prisma.tenants.findFirst({
      where: {
        id: resolvedTenant.id,
        subscription_status: 'active'
      },
      select: {
        id: true,
        name: true,
        slug: true,
        subscription_tier: true,
        created_at: true,
        metadata: true
      }
    });

    if (!store) {
      console.log(`[StoreService] Store not found for tenant: ${resolvedTenant.id}`);
      return null;
    }

    const metadata = store.metadata as any || {};
    return {
      id: store.id,
      name: store.name,
      slug: store.slug || '',
      description: metadata.description || null,
      address: metadata.address || null,
      city: metadata.city || null,
      state: metadata.state || null,
      zipCode: metadata.zipCode || null,
      country: metadata.country || null,
      productCount: 0, // Not available without _count
      createdAt: store.created_at,
      updatedAt: store.created_at, // Use created_at as fallback
      businessName: metadata.businessName || store.name,
      logoUrl: metadata.logo_url || null,
      phone: metadata.phone || null,
      website: metadata.website || null,
      primaryCategory: metadata.primary_category || null
    };
  }

  /**
   * Search stores (global search)
   */
  async searchStores(query: StoreQuery): Promise<StoreResponse> {
    if (!query.search) {
      throw new Error('Search query is required');
    }

    console.log(`[StoreService] Searching stores: "${query.search}"`);

    const where: any = {
      subscription_status: 'active',
      OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { metadata: { path: ['description'], string_contains: query.search } },
        { metadata: { path: ['city'], string_contains: query.search } }
      ]
    };

    const limit = Math.min(query.limit || 20, 100);
    const offset = query.offset || 0;

    const { prisma } = await import('../prisma');

    const stores = await prisma.tenants.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        subscription_tier: true,
        created_at: true,
        metadata: true
      },
      take: limit,
      skip: offset,
      orderBy: { name: 'asc' }
    });

    const total = stores.length; // Approximate for search results

    const transformedStores: StoreResult[] = stores.map((store: any) => {
      const metadata = store.metadata as any || {};
      return {
        id: store.id,
        name: store.name,
        slug: store.slug || '',
        description: metadata.description || null,
        address: metadata.address || null,
        city: metadata.city || null,
        state: metadata.state || null,
        zipCode: metadata.zipCode || null,
        country: metadata.country || null,
        productCount: store._count?.inventory_items || 0,
        createdAt: store.created_at,
        updatedAt: store.created_at, // Use created_at as fallback
        businessName: metadata.businessName || store.name,
        logoUrl: metadata.logo_url || null,
        phone: metadata.phone || null,
        website: metadata.website || null,
        primaryCategory: metadata.primary_category || null
      };
    });

    return {
      stores: transformedStores,
      pagination: {
        total,
        limit,
        offset,
        hasMore: stores.length === limit
      }
    };
  }

  /**
   * Get trending stores
   */
  async getTrendingStores(limit: number = 12): Promise<StoreResult[]> {
    console.log(`[StoreService] Getting trending stores, limit: ${limit}`);

    // Use materialized view for trending stores
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const sqlQuery = `
      SELECT DISTINCT
        t.id,
        t.name,
        t.slug,
        t.subscription_tier,
        t.created_at,
        t.updated_at,
        t.metadata,
        t.city,
        t.state,
        COUNT(ii.id) as product_count
      FROM mv_trending_products mtp
      JOIN tenants t ON t.id = mtp.tenant_id
      JOIN inventory_items ii ON ii.id = mtp.inventory_item_id
      WHERE t.subscription_status = 'active'
        AND ii.item_status = 'active'
        AND mtp.item_status = 'active'
        AND mtp.visibility = 'public'
      GROUP BY t.id, t.name, t.slug, t.subscription_tier, t.created_at, t.updated_at, t.metadata, t.city, t.state
      ORDER BY COUNT(ii.id) DESC, t.created_at DESC
      LIMIT $1
    `;

    const result = await pool.query(sqlQuery, [limit]);
    const stores = result.rows;

    console.log(`[StoreService] Found ${stores.length} trending stores`);

    // Transform results
    const transformedStores: StoreResult[] = stores.map((store: any) => {
      const metadata = store.metadata || {};
      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        description: metadata.description || null,
        address: metadata.address || null,
        city: store.city || metadata.city || null,
        state: store.state || metadata.state || null,
        zipCode: metadata.zipCode || null,
        country: metadata.country || null,
        productCount: parseInt(store.product_count) || 0,
        createdAt: new Date(store.created_at),
        updatedAt: new Date(store.updated_at),
        businessName: metadata.businessName || store.name,
        logoUrl: metadata.logo_url || null,
        phone: metadata.phone || null,
        website: metadata.website || null,
        primaryCategory: metadata.primary_category || null
      };
    });

    return transformedStores;
  }
}
