/**
 * Meta Commerce Product Feed Generator
 * Phase 2A: Meta Commerce Integration
 *
 * Transforms platform inventory items to Meta Commerce product format.
 * Follows Google feed-generator.ts pattern but outputs Meta-compatible fields.
 *
 * Key differences from Google feed:
 * - Uses SKU as retailer_id (per social-commerce skill best practice)
 * - Includes item_group_id for variant grouping
 * - Meta Catalog Batch API format
 */

import { prisma } from '../../prisma';

export interface MetaFeedItem {
  retailer_id: string;        // SKU — must be stable
  title: string;
  description: string;
  availability: 'in stock' | 'out of stock' | 'preorder';
  condition: 'new' | 'refurbished' | 'used';
  price: string;              // "12.99 USD"
  sale_price?: string;        // "9.99 USD"
  link: string;
  image_url: string;
  additional_image_urls?: string[];
  brand: string;
  item_group_id?: string;     // Groups variants together
  google_product_category?: string;
  color?: string;
  size?: string;
  gtin?: string;
  mpn?: string;
}

/**
 * Generate Meta Commerce product feed for a tenant
 * Only includes items with itemStatus='active' AND visibility='public'
 */
export async function generateMetaProductFeed(tenant_id: string, websiteUrl?: string): Promise<MetaFeedItem[]> {
  try {
    const items = await prisma.inventory_items.findMany({
      where: {
        tenant_id: tenant_id,
        item_status: 'active',
        visibility: 'public',
      },
      select: {
        id: true,
        sku: true,
        name: true,
        title: true,
        brand: true,
        description: true,
        price_cents: true,
        sale_price_cents: true,
        currency: true,
        availability: true,
        image_url: true,
        condition: true,
        stock: true,
        metadata: true,
      },
    });

    const baseUrl = websiteUrl || process.env.WEB_URL || 'https://visibleshelf.com';

    return items.map(item => {
      const metadata = item.metadata as any || {};
      const priceCents = item.price_cents || 0;
      const salePriceCents = item.sale_price_cents || 0;
      const inStock = (item.stock ?? 0) > 0;

      const normalizedCondition = (() => {
        const c = item.condition;
        if (c === 'brand_new') return 'new' as const;
        if (c === 'refurbished') return 'refurbished' as const;
        if (c === 'used') return 'used' as const;
        return 'new' as const;
      })();

      const feedItem: MetaFeedItem = {
        retailer_id: item.sku || item.id,
        title: item.name || item.title || '',
        description: (item.description || item.name || '').slice(0, 9999),
        availability: inStock ? 'in stock' : 'out of stock',
        condition: normalizedCondition,
        price: `${(priceCents / 100).toFixed(2)} USD`,
        link: metadata.product_url || `${baseUrl}/products/${item.id}`,
        image_url: item.image_url || metadata.primary_image_url || '',
        brand: item.brand || 'Unknown',
        item_group_id: item.id,  // Groups variants together
      };

      // Add sale price if lower than regular price
      if (salePriceCents > 0 && salePriceCents < priceCents) {
        feedItem.sale_price = `${(salePriceCents / 100).toFixed(2)} USD`;
      }

      // Add variant attributes from metadata
      if (metadata.color) feedItem.color = metadata.color;
      if (metadata.size) feedItem.size = metadata.size;
      if (metadata.gtin) feedItem.gtin = metadata.gtin;
      if (metadata.mpn) feedItem.mpn = metadata.mpn;
      if (metadata.google_product_category) feedItem.google_product_category = metadata.google_product_category;

      // Additional images
      if (metadata.additional_images && Array.isArray(metadata.additional_images)) {
        feedItem.additional_image_urls = metadata.additional_images.slice(0, 10);
      }

      return feedItem;
    });
  } catch (error) {
    console.error('[Meta Feed Generator] Error:', error);
    throw error;
  }
}

/**
 * Get feed statistics for a tenant
 */
export async function getMetaFeedStats(tenant_id: string) {
  const [total, active, syncing] = await Promise.all([
    prisma.inventory_items.count({ where: { tenant_id: tenant_id } }),
    prisma.inventory_items.count({ where: { tenant_id: tenant_id, item_status: 'active' } }),
    prisma.inventory_items.count({
      where: { tenant_id: tenant_id, item_status: 'active', visibility: 'public' },
    }),
  ]);

  return {
    total,
    active,
    syncing,
    notSyncing: total - syncing,
  };
}
