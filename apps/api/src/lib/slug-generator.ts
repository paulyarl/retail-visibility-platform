/**
 * UPC/LPC Product Slug Generator
 * 
 * Character Rules:
 * _ = part boundary (after prefix, between parts)
 * - = bonded part (within parts)
 * 
 * Format: (prefix)_(brand)_(category)_(upc-code)_(name-hash)
 * Prefix: upc, lpc
 */

import { createHash } from 'crypto';

export interface SlugGenerationParams {
  type: 'upc' | 'lpc';
  upc?: string;
  brand: string;
  category: string;
  sku?: string;
  itemId?: string;
  name: string;
}

export interface SlugParts {
  type: string;
  brand: string;
  category: string;
  upc?: string;
  sku?: string;
  itemId?: string;
  nameHash: string;
}

/**
 * Normalize a slug part by converting to lowercase and bonding with hyphens
 */
function normalizePart(part: string): string {
  return part
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a consistent hash for the product name
 */
function generateNameHash(name: string): string {
  return createHash('md5')
    .update(name.toLowerCase().trim())
    .digest('hex')
    .substring(0, 8); // First 8 characters
}

/**
 * Generate a product slug based on the new UPC/LPC system
 */
export function generateProductSlug(params: SlugGenerationParams): string {
  const nameHash = generateNameHash(params.name);
  
  if (params.type === 'upc' && params.upc) {
    // Format: upc_(brand)_(category)_(upc-code)_(name-hash)
    return `upc_${normalizePart(params.brand)}_${normalizePart(params.category)}_${params.upc}_${nameHash}`;
  } else if (params.type === 'lpc' && params.sku && params.itemId) {
    // Format: lpc_(sku)_(category)_(item-id)_(name-hash)
    return `lpc_${params.sku}_${normalizePart(params.category)}_${params.itemId}_${nameHash}`;
  }
  
  throw new Error('Invalid slug generation parameters');
}

/**
 * Extract parts from a product slug
 */
export function extractSlugParts(slug: string): string[] {
  return slug.split('_');
}

/**
 * Extract the core slug (excluding name hash)
 */
export function extractSlugCore(slug: string): string {
  const parts = extractSlugParts(slug);
  return parts.slice(0, -1).join('_'); // Remove name-hash
}

/**
 * Extract slug type (upc or lpc)
 */
export function extractSlugType(slug: string): string {
  return extractSlugParts(slug)[0]; // "upc" or "lpc"
}

/**
 * Extract brand from slug
 */
export function extractBrand(slug: string): string {
  return extractSlugParts(slug)[1]; // "kelloggs" or "general-mills"
}

/**
 * Extract category from slug
 */
export function extractCategory(slug: string): string {
  return extractSlugParts(slug)[2]; // "cereal" or "ready-to-eat-cereal"
}

/**
 * Extract UPC from slug (for UPC slugs only)
 */
export function extractUPC(slug: string): string | null {
  const parts = extractSlugParts(slug);
  return extractSlugType(slug) === 'upc' ? parts[3] : null;
}

/**
 * Extract SKU from slug (for LPC slugs only)
 */
export function extractSKU(slug: string): string | null {
  const parts = extractSlugParts(slug);
  return extractSlugType(slug) === 'lpc' ? parts[1] : null;
}

/**
 * Extract item ID from slug (for LPC slugs only)
 */
export function extractItemId(slug: string): string | null {
  const parts = extractSlugParts(slug);
  return extractSlugType(slug) === 'lpc' ? parts[3] : null;
}

/**
 * Parse all slug components into a structured object
 */
export function parseSlug(slug: string): SlugParts {
  const parts = extractSlugParts(slug);
  const type = parts[0];
  
  if (type === 'upc' && parts.length >= 5) {
    return {
      type,
      brand: parts[1],
      category: parts[2],
      upc: parts[3],
      nameHash: parts[4],
    };
  } else if (type === 'lpc' && parts.length >= 5) {
    return {
      type,
      sku: parts[1],
      category: parts[2],
      itemId: parts[3],
      nameHash: parts[4],
      brand: '', // LPC doesn't have brand in the same way
    };
  }
  
  throw new Error(`Invalid slug format: ${slug}`);
}

/**
 * Check if two slugs represent the same product (ignoring name changes)
 */
export function areSameProduct(slug1: string, slug2: string): boolean {
  return extractSlugCore(slug1) === extractSlugCore(slug2);
}

/**
 * Determine if a product should use UPC or LPC slug type
 */
export function determineSlugType(gtin?: string | null): 'upc' | 'lpc' {
  return gtin && gtin.trim() !== '' ? 'upc' : 'lpc';
}

/**
 * Generate an item ID for LPC products
 */
export function generateItemId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `item-${timestamp}-${random}`;
}
