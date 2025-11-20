/**
 * Google Product Feed Generator
 * Generates product feeds filtered by itemStatus and visibility
 */

import { prisma } from '../../prisma';

export interface FeedItem {
  id: string;
  sku: string;
  name: string;
  title: string;
  brand: string;
  description?: string;
  price: number;
  currency: string;
  availability: string;
  imageUrl?: string;
  additionalImageLinks?: string[];
  categoryPath?: string[];
}

/**
 * Generate product feed for Google Merchant Center
 * Only includes items with itemStatus='active' AND visibility='public'
 */
export async function generateProductFeed(tenant_id: string): Promise<FeedItem[]> {
  try {
    const items = await prisma.inventory_item.findMany({
      where: {
        tenant_id: tenantId,
        item_status: 'active',  // Only active items
        visibility: 'public',   // Only public items
      },
      select: {
        id: true,
        sku: true,
        name: true,
        title: true,
        brand: true,
        description: true,
        price: true,
        currency: true,
        availability: true,
        image_url: true,
        category_path: true,
      },
    });

    return items.map(item => {
      return {
        id: item.id,
        sku: item.sku,
        name: item.name,
        title: item.title,
        brand: item.brand,
        description: item.description || undefined,
        price: Number(item.price),
        currency: item.currency,
        availability: item.availability,
        image_url: item.image_url || undefined,
        additionalImageLinks: undefined,
        category_path: item.categoryPath || undefined,
      } as FeedItem;
    });
  } catch (error) {
    console.error('[Feed Generator] Error:', error);
    throw error;
  }
}

/**
 * Get feed statistics
 */
export async function getFeedStats(tenant_id: string) {
  const [total, active, inactive, syncing, notSyncing] = await Promise.all([
    prisma.inventory_item.count({ where: { tenant_id: tenantId } }),
    prisma.inventory_item.count({ where: { tenant_id: tenantId, item_status: 'active' } }),
    prisma.inventory_item.count({ where: { tenant_id: tenantId, item_status: 'inactive' } }),
    prisma.inventory_item.count({ 
      where: { tenant_id: tenantId, item_status: 'active', visibility: 'public' } 
    }),
    prisma.inventory_item.count({ 
      where: { 
        tenant_id: tenantId,
        OR: [
          { item_status: { not: 'active' } },
          { visibility: { not: 'public' } },
        ]
      } 
    }),
  ]);

  return {
    total,
    active,
    inactive,
    syncing,
    notSyncing,
  };
}
