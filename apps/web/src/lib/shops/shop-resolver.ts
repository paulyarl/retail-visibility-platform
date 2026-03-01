import { shopsService, type Shop } from '@/services/ShopsService';

/**
 * Resolve shop identifier with priority order:
 * 1. Try slug lookup → /shops/example-slug
 * 2. Try tenantId lookup → /shops/tid-example-tenant-id  
 * 3. Try autoId lookup → /shops/EXAMPLE-AUTOID
 * 4. Return null if not found
 */
export async function getShopByIdentifier(identifier: string): Promise<Shop | null> {
  return await shopsService.getShopByIdentifier(identifier);
}

/**
 * Generate shop URL based on available identifiers
 */
export function generateShopUrl(shop: Shop): string {
  // Prefer slug if available, otherwise use tenantId with tid- prefix
  if (shop.slug) {
    return `/shops/${shop.slug}`;
  }
  return `/shops/tid-${shop.tenantId}`;
}

/**
 * Get all possible URLs for a shop (for redirects, SEO, etc.)
 */
export function getAllShopUrls(shop: Shop): string[] {
  return shopsService.getAllShopUrls(shop);
}

// Re-export Shop type for convenience
export type { Shop };
