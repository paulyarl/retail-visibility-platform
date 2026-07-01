/**
 * Active Featured Resolver Service
 *
 * Single source of truth for resolving "active featured" products per tenant per surface.
 * An active featured product is one where:
 *   featured_type = 'featured' AND is_active = true AND admin_approved = true
 *   AND assignment_source = 'manual'
 *   AND (featured_expires_at IS NULL OR featured_expires_at > NOW())
 *
 * All visibility channels read from this service.
 * When no active featured products exist, surfaces fall back to existing display logic.
 *
 * Pattern mirrors BadgeRegistryService: DB-driven + cached + static fallback.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

// ====================
// TYPES
// ====================

export interface ActiveFeaturedProduct {
  id: string;
  inventory_item_id: string;
  tenant_id: string;
  featured_type: string;
  featured_priority: number;
  featured_at: Date;
  featured_expires_at: Date | null;
  promotional_priority: number;
  // Inventory item details
  name: string;
  title: string | null;
  description: string | null;
  sku: string | null;
  price_cents: number | null;
  sale_price_cents: number | null;
  stock: number | null;
  image_url: string | null;
  brand: string | null;
  availability: string | null;
  has_variants: boolean;
  slug: string | null;
  // Derived
  price: number;
  imageUrl: string | null;
}

export interface ActiveFeaturedQuery {
  tenantId: string | null;  // null = platform-level (cross-tenant)
  surface: string;           // e.g. 'storefront_spotlight', 'directory_home', 'directory_entry', 'cross_tenant_shops'
  limit?: number;
}

export interface ActiveFeaturedResult {
  products: ActiveFeaturedProduct[];
  hasActive: boolean;
  fallbackUsed: boolean;
}

// ====================
// CACHE
// ====================

const CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
  result: ActiveFeaturedResult;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(query: ActiveFeaturedQuery): string {
  return `${query.tenantId ?? 'platform'}:${query.surface}:${query.limit ?? 10}`;
}

/**
 * Invalidate the active featured cache.
 * Call after featured product CRUD operations.
 */
export function invalidateActiveFeaturedCache(tenantId?: string | null, surface?: string): void {
  if (tenantId && surface) {
    // Invalidate specific entry
    for (const key of cache.keys()) {
      if (key.startsWith(`${tenantId}:${surface}:`)) {
        cache.delete(key);
      }
    }
  } else if (tenantId) {
    // Invalidate all entries for this tenant
    for (const key of cache.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        cache.delete(key);
      }
    }
  } else if (surface) {
    // Invalidate all entries for this surface
    for (const key of cache.keys()) {
      if (key.includes(`:${surface}:`)) {
        cache.delete(key);
      }
    }
  } else {
    // Invalidate everything
    cache.clear();
  }
  logger.info('[ActiveFeaturedResolver] Cache invalidated', undefined, { tenantId: tenantId ?? undefined, surface });
}

// ====================
// RESOLUTION
// ====================

/**
 * Resolve active featured products for a given tenant and surface.
 *
 * Returns active featured products ordered by promotional_priority DESC,
 * featured_priority DESC, featured_at ASC.
 *
 * If no active featured products exist, returns an empty array with
 * hasActive=false and fallbackUsed=true, signaling the caller to use
 * their existing display logic.
 */
export async function resolveActiveFeatured(query: ActiveFeaturedQuery): Promise<ActiveFeaturedResult> {
  const cacheKey = getCacheKey(query);
  const now = Date.now();

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && now < cached.expiry) {
    return cached.result;
  }

  try {
    const limit = query.limit ?? 10;

    // Build the WHERE clause
    const tenantCondition = query.tenantId
      ? `fp.tenant_id = $1`
      : `1=1`;

    const params = query.tenantId ? [query.tenantId, limit] : [limit];
    const paramPlaceholders = query.tenantId
      ? `$1, $2`
      : `$1`;

    const sql = `
      SELECT
        fp.id,
        fp.inventory_item_id,
        fp.tenant_id,
        fp.featured_type,
        fp.featured_priority,
        fp.featured_at,
        fp.featured_expires_at,
        COALESCE(ftr.promotional_priority, 0) AS promotional_priority,
        ii.name,
        ii.title,
        ii.description,
        ii.sku,
        ii.price_cents,
        ii.sale_price_cents,
        ii.stock,
        ii.image_url,
        ii.brand,
        ii.availability,
        ii.has_variants,
        ii.product_slug
      FROM featured_products fp
      INNER JOIN inventory_items ii ON ii.id = fp.inventory_item_id
      LEFT JOIN featured_type_registry ftr ON ftr.key = fp.featured_type AND ftr.tenant_id IS NULL
      WHERE ${tenantCondition}
        AND fp.featured_type = 'featured'
        AND fp.is_active = true
        AND fp.admin_approved = true
        AND fp.assignment_source = 'manual'
        AND (fp.featured_expires_at IS NULL OR fp.featured_expires_at > NOW())
        AND ii.item_status = 'active'
      ORDER BY
        promotional_priority DESC,
        fp.featured_priority DESC,
        fp.featured_at ASC
      LIMIT ${paramPlaceholders}
    `;

    const rows = await prisma.$queryRawUnsafe(sql, ...params);

    const products: ActiveFeaturedProduct[] = (rows as any[]).map(row => ({
      id: row.id,
      inventory_item_id: row.inventory_item_id,
      tenant_id: row.tenant_id,
      featured_type: row.featured_type,
      featured_priority: row.featured_priority,
      featured_at: row.featured_at,
      featured_expires_at: row.featured_expires_at,
      promotional_priority: Number(row.promotional_priority) || 0,
      name: row.name,
      title: row.title,
      description: row.description,
      sku: row.sku,
      price_cents: row.price_cents,
      sale_price_cents: row.sale_price_cents,
      stock: row.stock,
      image_url: row.image_url,
      brand: row.brand,
      availability: row.availability,
      has_variants: row.has_variants,
      slug: row.product_slug,
      price: row.price_cents ? Number(row.price_cents) / 100 : 0,
      imageUrl: row.image_url,
    }));

    const result: ActiveFeaturedResult = {
      products,
      hasActive: products.length > 0,
      fallbackUsed: products.length === 0,
    };

    // Cache the result
    cache.set(cacheKey, {
      result,
      expiry: now + CACHE_TTL_MS,
    });

    return result;
  } catch (error) {
    logger.error('[ActiveFeaturedResolver] Failed to resolve active featured products', undefined, {
      error: (error as Error).message,
      query,
    });

    // Return empty result on error — surfaces fall back to existing logic
    return {
      products: [],
      hasActive: false,
      fallbackUsed: true,
    };
  }
}

/**
 * Convenience: resolve active featured for a specific tenant.
 */
export async function getTenantActiveFeatured(
  tenantId: string,
  surface: string,
  limit?: number
): Promise<ActiveFeaturedResult> {
  return resolveActiveFeatured({ tenantId, surface, limit });
}

/**
 * Convenience: resolve platform-level active featured (cross-tenant).
 */
export async function getPlatformActiveFeatured(
  surface: string,
  limit?: number
): Promise<ActiveFeaturedResult> {
  return resolveActiveFeatured({ tenantId: null, surface, limit });
}
