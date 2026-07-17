/**
 * TikTok Shop Product Feed Generator
 * Phase 2B: TikTok Shop Integration
 *
 * Transforms platform inventory items to TikTok Shop product format.
 */

import { prisma } from '../../prisma';

export interface TikTokFeedItem {
  sku_id: string;
  product_id: string;
  title: string;
  description: string;
  main_image_url: string;
  sub_image_urls: string[];
  category_id: string;
  brand: string;
  price: { amount: string; currency: string };
  sale_price?: { amount: string; currency: string };
  stock_quantity: number;
  status: string;
  condition: string;
  package_weight: { value: string; unit: string };
  package_length: { value: string; unit: string };
  package_width: { value: string; unit: string };
  package_height: { value: string; unit: string };
  product_url: string;
}

/**
 * Generate TikTok Shop product feed for a tenant
 */
export async function generateTikTokProductFeed(tenant_id: string, websiteUrl?: string): Promise<TikTokFeedItem[]> {
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
      const stock = item.stock ?? 0;
      const currency = item.currency || 'USD';

      const feedItem: TikTokFeedItem = {
        sku_id: item.sku || item.id,
        product_id: item.id,
        title: item.name || item.title || '',
        description: (item.description || item.name || '').slice(0, 5000),
        main_image_url: item.image_url || metadata.primary_image_url || '',
        sub_image_urls: Array.isArray(metadata.additional_images) ? metadata.additional_images.slice(0, 5) : [],
        category_id: metadata.tiktok_category_id || '0',
        brand: item.brand || 'Unknown',
        price: { amount: (priceCents / 100).toFixed(2), currency },
        stock_quantity: stock,
        status: stock > 0 ? 'PUBLISHED' : 'UNPUBLISHED',
        condition: 'NEW',
        package_weight: { value: String(metadata.weight || '1'), unit: 'KILOGRAM' },
        package_length: { value: String(metadata.length || '10'), unit: 'CENTIMETER' },
        package_width: { value: String(metadata.width || '10'), unit: 'CENTIMETER' },
        package_height: { value: String(metadata.height || '10'), unit: 'CENTIMETER' },
        product_url: metadata.product_url || `${baseUrl}/products/${item.id}`,
      };

      if (salePriceCents > 0 && salePriceCents < priceCents) {
        feedItem.sale_price = { amount: (salePriceCents / 100).toFixed(2), currency };
      }

      return feedItem;
    });
  } catch (error) {
    console.error('[TikTok Feed Generator] Error:', error);
    throw error;
  }
}

/**
 * Get feed statistics for a tenant
 */
export async function getTikTokFeedStats(tenant_id: string) {
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
