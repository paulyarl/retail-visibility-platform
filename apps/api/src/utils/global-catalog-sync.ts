/**
 * Global Catalog Sync Utility
 * 
 * Provides functions to create global catalog entries and slug registry entries
 * for products that don't have them yet. This ensures availability system works.
 */

import { prisma } from '../prisma';
import { generateGlobalProductId, generateProductSlug } from '../lib/id-generator';
import { logger } from '../logger';

/**
 * Extract available attributes from variants for filtering/search
 */
function extractAvailableAttributes(variants: Array<{ attributes: Record<string, any> }>): Record<string, string[]> {
  const attributes: Record<string, Set<string>> = {};
  
  variants.forEach(variant => {
    Object.entries(variant.attributes).forEach(([key, value]) => {
      if (!attributes[key]) {
        attributes[key] = new Set();
      }
      attributes[key].add(String(value));
    });
  });
  
  // Convert Sets to arrays
  const result: Record<string, string[]> = {};
  Object.entries(attributes).forEach(([key, values]) => {
    result[key] = Array.from(values).sort();
  });
  
  return result;
}

/**
 * Create or update global catalog entry for a product
 */
export interface GlobalCatalogItem {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  category_path?: string[];
  gtin?: string;
  price_cents?: number;
  image_url?: string;
  has_variants?: boolean;
  variants?: Array<{
    sku: string;
    name: string;
    price_cents: number | null;
    attributes: Record<string, any>;
  }>;
}

export async function ensureGlobalCatalogEntry(item: GlobalCatalogItem): Promise<{ globalProduct: any; slugRegistry: any }> {
  try {
    // Generate product slug using new UPC/LPC system
    const productSlug = generateProductSlug({
      brand: item.brand || 'unknown',
      name: item.name,
      category: item.category_path?.[0] || 'general',
      categoryPath: item.category_path,
      gtin: item.gtin,
      sku: item.sku,
      itemId: item.id
    });

    // Prepare variant metadata for global catalog
    const catalogMetadata = {
      has_variants: item.has_variants || false,
      variants: item.variants || [],
      variant_count: item.variants?.length || 0,
      min_price_cents: item.variants?.length 
        ? Math.min(...item.variants.map(v => v.price_cents || 0))
        : item.price_cents || 0,
      max_price_cents: item.variants?.length 
        ? Math.max(...item.variants.map(v => v.price_cents || 0))
        : item.price_cents || 0,
      available_attributes: item.variants?.length 
        ? extractAvailableAttributes(item.variants)
        : {}
    };

    // Create or update global catalog entry
    const globalProduct = await prisma.global_product_catalog.upsert({
      where: { product_slug: productSlug },
      update: {
        name: item.name,
        description: item.description || '',
        brand: item.brand || '',
        category_path: item.category_path || [],
        gtin_upc: item.gtin || null,
        catalog_metadata: catalogMetadata,
        updated_at: new Date()
      },
      create: {
        id: generateGlobalProductId(),
        product_slug: productSlug,
        universal_sku: item.sku,
        name: item.name,
        description: item.description || '',
        brand: item.brand || '',
        category_path: item.category_path || [],
        gtin_upc: item.gtin || null,
        catalog_metadata: catalogMetadata,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // Create or update slug registry entry
    // universal_sku rules:
    // - UPC products: universal_sku = UPC code (unique across tenants)
    // - LPC products: universal_sku = NULL (not unique, tenant-scoped)
    const universalSku = item.gtin && item.gtin.trim() !== '' && item.gtin.trim().length >= 6
      ? item.gtin.trim()  // UPC: use the UPC code
      : null;              // LPC: no universal SKU

    const slugRegistry = await prisma.product_slug_registry.upsert({
      where: { product_slug: productSlug },
      update: {
        tenant_id: item.tenant_id,
        original_sku: item.sku,
        universal_sku: universalSku,
        slug_type: item.gtin ? 'upc' : 'lpc',
        format_version: 'v2',
        is_active: true,
      },
      create: {
        id: `psr-${item.id}`,
        product_slug: productSlug,
        universal_sku: universalSku,
        slug_hash: productSlug.split('_').slice(0, 3).join('_'), // Simple hash from slug parts
        tenant_id: item.tenant_id,
        original_sku: item.sku,
        slug_type: item.gtin ? 'upc' : 'lpc',
        slug_prefix: item.gtin ? 'upc' : 'lpc',
        brand_normalized: item.brand?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || null,
        category_normalized: item.category_path?.[0]?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'general',
        format_version: 'v2',
        migration_status: 'auto_created',
        is_active: true,
        created_at: new Date()
      }
    });

    console.log(`[Global Catalog Sync] Created/updated global entry: ${productSlug} for SKU: ${item.sku}`);

    return { globalProduct, slugRegistry };
  } catch (error) {
    logger.error('[Global Catalog Sync] Error creating global entry:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    throw error;
  }
}

/**
 * Batch create global catalog entries for multiple items
 */
export async function ensureGlobalCatalogEntries(items: Array<{
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  category_path?: string[];
  gtin?: string;
  price_cents?: number;
  image_url?: string;
}>): Promise<Array<{ success: boolean; error?: string; sku: string }>> {
  const results = [];

  for (const item of items) {
    try {
      await ensureGlobalCatalogEntry(item);
      results.push({ success: true, sku: item.sku });
    } catch (error) {
      logger.error(`[Global Catalog Sync] Failed for SKU ${item.sku}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      results.push({ success: false, error: error instanceof Error ? error.message : 'Unknown error', sku: item.sku });
    }
  }

  return results;
}

/**
 * Check if a product has global catalog entries
 */
export async function hasGlobalCatalogEntry(sku: string): Promise<boolean> {
  const slugRegistry = await prisma.product_slug_registry.findFirst({
    where: { universal_sku: sku }
  });

  if (!slugRegistry) return false;

  const globalProduct = await prisma.global_product_catalog.findFirst({
    where: { product_slug: slugRegistry.product_slug, status: 'active' }
  });

  return !!globalProduct;
}
