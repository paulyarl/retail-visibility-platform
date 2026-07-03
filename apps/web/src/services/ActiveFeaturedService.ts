/**
 * Active Featured Service (Frontend Singleton)
 *
 * Fetches active featured products from the backend ActiveFeaturedResolver API.
 * Used by visibility channels (storefront, directory, shops) to display
 * active featured products with fallback behavior.
 *
 * Extends PublicApiSingleton for public (no-auth) requests with caching.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface ActiveFeaturedProduct {
  id: string;
  inventory_item_id: string;
  tenant_id: string;
  featured_type: string;
  featured_priority: number;
  featured_at: string;
  featured_expires_at: string | null;
  promotional_priority: number;
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
  price: number;
  imageUrl: string | null;
}

export interface ActiveFeaturedResult {
  products: ActiveFeaturedProduct[];
  hasActive: boolean;
  fallbackUsed: boolean;
}

class ActiveFeaturedService extends PublicApiSingleton {
  private static instance: ActiveFeaturedService;

  private constructor() {
    super('active-featured-singleton', { ttl: 60 * 1000 }); // 60 second TTL
  }

  public static getInstance(): ActiveFeaturedService {
    if (!ActiveFeaturedService.instance) {
      ActiveFeaturedService.instance = new ActiveFeaturedService();
    }
    return ActiveFeaturedService.instance;
  }

  /**
   * Get active featured products for a specific tenant.
   * Uses public endpoint (no auth required) — storefront rendering.
   */
  async getActiveFeatured(
    tenantId: string,
    surface: string,
    limit: number = 10
  ): Promise<ActiveFeaturedResult> {
    try {
      const result = await this.makePublicRequest<ActiveFeaturedResult>(
        `/api/tenants/${tenantId}/active-featured?surface=${surface}&limit=${limit}`,
        {},
        `active-featured-tenant-${tenantId}-${surface}`,
        this.cacheTTL
      );
      if (result.success && result.data) {
        return result.data;
      }
      return { products: [], hasActive: false, fallbackUsed: true };
    } catch {
      return { products: [], hasActive: false, fallbackUsed: true };
    }
  }

  /**
   * Get platform-level active featured products (cross-tenant).
   * Uses public endpoint (no auth required) — directory home, cross-tenant shops.
   */
  async getPlatformActiveFeatured(
    surface: string,
    limit: number = 10
  ): Promise<ActiveFeaturedResult> {
    try {
      const result = await this.makePublicRequest<ActiveFeaturedResult>(
        `/api/active-featured?surface=${surface}&limit=${limit}`,
        {},
        `active-featured-platform-${surface}`,
        this.cacheTTL
      );
      if (result.success && result.data) {
        return result.data;
      }
      return { products: [], hasActive: false, fallbackUsed: true };
    } catch {
      return { products: [], hasActive: false, fallbackUsed: true };
    }
  }
}

export const activeFeaturedService = ActiveFeaturedService.getInstance();
export default activeFeaturedService;
