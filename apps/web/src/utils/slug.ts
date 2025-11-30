/**
 * Centralized slug utilities for consistent URL generation across the platform
 * This ensures all pages use the same slugification logic
 */

/**
 * Convert text to URL-friendly slug
 * Handles special characters, multiple spaces, and edge cases
 * 
 * Examples:
 * - "Electronics store" → "electronics-store"
 * - "Health & Beauty" → "health-beauty"
 * - "Restaurant/Pizza" → "restaurant-pizza"
 * - "  Multiple   Spaces  " → "multiple-spaces"
 * 
 * @param text - The text to convert to slug
 * @returns URL-friendly slug
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
