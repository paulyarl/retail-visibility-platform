import { shopsService, type Shop } from '@/services/ShopsService';

/**
 * Resolve shop identifier with priority order:
 * 1. Try slug lookup → /shops/baraka-market
 * 2. Try tenantId lookup → /shops/tid-m8ijkrnk  
 * 3. Try autoId lookup → /shops/ULCW
 * 4. Return null if not found
 */
export async function getShopByIdentifier(identifier: string): Promise<Shop | null> {
  return await shopsService.getShopByIdentifier(identifier);
}

/**
 * Generate shop URL based on available identifiers
 */
export function generateShopUrl(shop: Shop): string {
  return shopsService.generateShopUrl(shop);
}

/**
 * Get all possible URLs for a shop (for redirects, SEO, etc.)
 */
export function getAllShopUrls(shop: Shop): string[] {
  return shopsService.getAllShopUrls(shop);
}

// Re-export Shop type for convenience
export type { Shop };
