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
        tenantCategory: {
          select: {
            name: true,
            googleCategoryId: true,
          },
        },
        photos: {
          orderBy: { position: 'asc' },
          select: { url: true, position: true },
        },
      },
    });

    return items.map(item => {
      // Map photos: position 0 = imageLink, positions 1-10 = additionalImageLinks
      const primaryPhoto = item.photos.find(p => p.position === 0);
      const additionalPhotos = item.photos
        .filter(p => p.position > 0 && p.position <= 10)
        .map(p => p.url);

      return {
        ...item,
        price: Number(item.price),
        description: item.description || undefined,
        imageUrl: primaryPhoto?.url || item.imageUrl || undefined,
        additionalImageLinks: additionalPhotos.length > 0 ? additionalPhotos : undefined,
        photos: undefined, // Remove from output
      };
    });
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
