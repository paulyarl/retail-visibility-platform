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
  categoryPath?: string[];
}

/**
 * Generate product feed for Google Merchant Center
 * Only includes items with itemStatus='active' AND visibility='public'
 */
export async function generateProductFeed(tenantId: string): Promise<FeedItem[]> {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: {
        tenantId,
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

    return items.map(item => ({
      ...item,
      price: Number(item.price),
      description: item.description || undefined,
      imageUrl: item.imageUrl || undefined,
    }));
  } catch (error) {
    console.error('[Feed Generator] Error:', error);
    throw error;
  }
}

/**
 * Get feed statistics
 */
export async function getFeedStats(tenantId: string) {
  const [total, active, inactive, syncing, notSyncing] = await Promise.all([
    prisma.inventoryItem.count({ where: { tenantId } }),
    prisma.inventoryItem.count({ where: { tenantId, itemStatus: 'active' } }),
    prisma.inventoryItem.count({ where: { tenantId, itemStatus: 'inactive' } }),
    prisma.inventoryItem.count({ 
      where: { tenantId, itemStatus: 'active', visibility: 'public' } 
    }),
    prisma.inventoryItem.count({ 
      where: { 
        tenantId,
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
