/**
 * Centralized slug utilities for consistent URL generation across the platform
 * This ensures both API and frontend use the same slugification logic
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
