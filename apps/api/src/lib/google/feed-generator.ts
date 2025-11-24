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
    const items = await prisma.inventoryItem.findMany({
      where: {
        tenantId: tenant_id, 
        itemStatus: 'active',  // Only active items
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
        imageUrl: true,
        categoryPath: true,
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
        image_url: item.imageUrl || undefined,
        additionalImageLinks: undefined,
        categoryPath: item.categoryPath || undefined,
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
    prisma.inventoryItem.count({ where: { tenantId: tenant_id } }),
    prisma.inventoryItem.count({ where: { tenantId: tenant_id, itemStatus: 'active' } }),
    prisma.inventoryItem.count({ where: { tenantId: tenant_id, itemStatus: 'inactive' } }),
    prisma.inventoryItem.count({ 
      where: { tenantId: tenant_id, itemStatus: 'active', visibility: 'public' } 
    }),
    prisma.inventoryItem.count({ 
      where: { 
        tenantId: tenant_id,
        OR: [
          { itemStatus: { not: 'active' } },
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
