/**
 * ============================================================================
 * FRONTEND SLUG UTILITIES
 * ============================================================================
 * 
 * These utilities are for FRONTEND URL generation and navigation only.
 * 
 * For TENANT/BUSINESS SLUGS, use the backend API:
 * - POST /api/slugs/patterns - Get all available slug patterns
 * - POST /api/slugs/generate-with-pattern - Generate specific pattern
 * - POST /api/slugs/slugify - Simple slugification via API
 * 
 * The backend SlugSingletonService provides:
 * - Geographic disambiguation
 * - Uniqueness guarantees
 * - Database persistence
 * - Caching
 * 
 * These frontend utilities are for:
 * - Category URL generation (getCategoryUrl)
 * - Store type URL generation (getStoreTypeUrl)
 * - Slug comparison (slugsMatch)
 * - Simple frontend display slugs (unslugify)
 * ============================================================================
 */

/**
 * Convert text to URL-friendly slug (FRONTEND ONLY)
 * 
 * ⚠️ WARNING: For tenant/business slugs, use POST /api/slugs/slugify instead!
 * This function is only for frontend URL generation (categories, store types).
 * 
 * Examples:
 * - "Electronics store" → "electronics-store"
 * - "Health & Beauty" → "health-beauty"
 * - "Restaurant/Pizza" → "restaurant-pizza"
 * - "  Multiple   Spaces  " → "multiple-spaces"
 * 
 * @param text - The text to convert to slug
 * @returns URL-friendly slug (frontend use only)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert slug back to approximate readable name
 * 
 * Examples:
 * - "electronics-store" → "Electronics store"
 * - "health-beauty" → "Health beauty"
 * 
 * @param slug - The slug to convert back to text
 * @returns Readable text approximation
 */
export function unslugify(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate category slug with fallback handling
 * Uses the category name if slug is not available or invalid
 * 
 * @param category - Category object with name and optional slug
 * @returns Valid slug for the category
 */
export function getCategorySlug(category: { name: string; slug?: string }): string {
  // Use provided slug if valid, otherwise generate from name
  if (category.slug && category.slug.trim()) {
    return slugify(category.slug);
  }
  return slugify(category.name);
}

/**
 * Generate store type slug
 * Standardizes store type naming for directory navigation
 * 
 * @param storeType - Store type name
 * @returns URL-friendly store type slug
 */
export function getStoreTypeSlug(storeType: string): string {
  return slugify(storeType);
}

/**
 * Check if two slugs are equivalent (handles different formats)
 * Useful for matching slugs from different data sources
 * 
 * @param slug1 - First slug to compare
 * @param slug2 - Second slug to compare
 * @returns True if slugs are equivalent
 */
export function slugsMatch(slug1: string, slug2: string): boolean {
  const normalized1 = slugify(slug1);
  const normalized2 = slugify(slug2);
  return normalized1 === normalized2;
}

/**
 * Generate navigation URL for category pages
 * Centralizes category URL generation logic
 * 
 * @param category - Category object
 * @param basePath - Base path (default: "/directory/categories")
 * @returns Full URL path for category navigation
 */
export function getCategoryUrl(
  category: { name: string; slug?: string }, 
  basePath: string = "/directory/categories"
): string {
  const slug = getCategorySlug(category);
  return `${basePath}/${slug}`;
}

/**
 * Generate navigation URL for store type pages
 * Centralizes store type URL generation logic
 * 
 * @param storeType - Store type name
 * @param basePath - Base path (default: "/directory/stores")
 * @returns Full URL path for store type navigation
 */
export function getStoreTypeUrl(
  storeType: string,
  basePath: string = "/directory/stores"
): string {
  const slug = getStoreTypeSlug(storeType);
  return `${basePath}/${slug}`;
}

/**
 * Generate navigation URL for city/location directory pages
 * Centralizes city URL generation logic
 *
 * @param city - City name
 * @param state - State name or abbreviation
 * @param basePath - Base path (default: "/directory/location")
 * @returns Full URL path for city navigation
 */
export function getCityUrl(
  city: string,
  state: string,
  basePath: string = "/directory/location"
): string {
  return `${basePath}/${slugify(city)}-${slugify(state)}`;
}

/**
 * Generate navigation URL for a directory listing.
 * Tier-aware: unclaimed "directory_presence" listings live at /place/{slug},
 * while subscribed platform tenants live at /directory/{slug}.
 *
 * @param listing - Listing with slug/tenantId/id and subscriptionTier
 * @returns Public URL path for the directory entry
 */
export function getDirectoryListingUrl(listing: {
  slug?: string | null;
  tenantId?: string | null;
  id?: string | null;
  subscriptionTier?: string | null;
  listingOrigin?: string | null;
}): string {
  const identifier = listing.slug || listing.tenantId || listing.id || '';
  const isPlace = listing.subscriptionTier === 'directory_presence' || listing.listingOrigin === 'directory_seed';
  return isPlace ? `/place/${identifier}` : `/directory/${identifier}`;
}

/**
 * Reserved slugs under /place/ that are used for static routes.
 * Listings with these slugs would be shadowed by the static Next.js routes
 * and become unreachable. These must be blacklisted in seed creation and
 * slug validation to prevent collision.
 */
export const RESERVED_PLACE_SLUGS = new Set([
  'about',
  'claim',
  'search',
  'category',
  'city',
]);

/**
 * Check if a slug is reserved under /place/ and would collide with a
 * static route. Returns true if the slug is in the reserved set.
 */
export function isReservedPlaceSlug(slug: string): boolean {
  return RESERVED_PLACE_SLUGS.has(slug.toLowerCase());
}
