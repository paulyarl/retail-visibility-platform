import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Category Directory Service
 * 
 * Provides category-based store discovery for the directory.
 * Only includes stores that are:
 * - Actively syncing with Google
 * - Have active, public products
 * - Have been synced within last 24 hours
 */

export interface CategoryWithStores {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  storeCount: number;
  productCount: number;
}

export interface StoreWithProducts {
  id: string;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  distance?: number; // in miles
  productCount: number;
  verified: boolean;
  lastSync: Date | null;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  googleCategoryId: string | null;
  parentId: string | null;
  children: CategoryNode[];
  storeCount: number;
  productCount: number;
}

export class CategoryDirectoryService {
  /**
   * Get all categories that have stores with products
   * Only includes categories from stores that are syncing with Google
   */
  async getCategoriesWithStores(
    location?: { lat: number; lng: number },
    radius?: number
  ): Promise<CategoryWithStores[]> {
    // Build the where clause for location filtering
    const locationFilter = location && radius
      ? {
          AND: [
            { latitude: { not: null } },
            { longitude: { not: null } },
            // Note: For production, use PostGIS for accurate distance calculation
            // This is a simplified bounding box approach
          ],
        }
      : {};

    // Get categories with store and product counts
    const categories = await prisma.tenantCategory.findMany({
      where: {
        isActive: true,
        items: {
          some: {
            itemStatus: 'active',
            visibility: 'public',
            tenant: {
              googleSyncEnabled: true,
              googleLastSync: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
              },
              ...locationFilter,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        googleCategoryId: true,
        sortOrder: true,
        _count: {
          select: {
            items: {
              where: {
                itemStatus: 'active',
                visibility: 'public',
                tenant: {
                  googleSyncEnabled: true,
                  googleLastSync: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                  },
                },
              },
            },
          },
        },
        items: {
          where: {
            itemStatus: 'active',
            visibility: 'public',
            tenant: {
              googleSyncEnabled: true,
              googleLastSync: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          },
          select: {
            tenantId: true,
          },
          distinct: ['tenantId'],
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    // Transform to CategoryWithStores format
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      googleCategoryId: category.googleCategoryId,
      storeCount: category.items.length, // Distinct tenant count
      productCount: category._count.items,
    }));
  }

  /**
   * Get stores that have products in a specific category
   * Only includes verified stores (syncing with Google)
   */
  async getStoresByCategory(
    categoryId: string,
    location?: { lat: number; lng: number },
    radius?: number
  ): Promise<StoreWithProducts[]> {
    // Get the category to verify it exists
    const category = await prisma.tenantCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Get stores with products in this category
    const stores = await prisma.tenant.findMany({
      where: {
        googleSyncEnabled: true,
        googleLastSync: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        inventoryItems: {
          some: {
            tenantCategoryId: categoryId,
            itemStatus: 'active',
            visibility: 'public',
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        latitude: true,
        longitude: true,
        googleLastSync: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        _count: {
          select: {
            inventoryItems: {
              where: {
                tenantCategoryId: categoryId,
                itemStatus: 'active',
                visibility: 'public',
              },
            },
          },
        },
      },
    });

    // Calculate distances if location provided
    let storesWithDistance = stores.map((store) => {
      const result: StoreWithProducts = {
        id: store.id,
        name: store.name,
        slug: store.slug,
        latitude: store.latitude,
        longitude: store.longitude,
        productCount: store._count.inventoryItems,
        verified: true, // All stores in this query are verified
        lastSync: store.googleLastSync,
        address: store.address || undefined,
        city: store.city || undefined,
        state: store.state || undefined,
        zipCode: store.zipCode || undefined,
      };

      // Calculate distance if location provided
      if (location && store.latitude && store.longitude) {
        result.distance = this.calculateDistance(
          location.lat,
          location.lng,
          store.latitude,
          store.longitude
        );
      }

      return result;
    });

    // Filter by radius if provided
    if (radius && location) {
      storesWithDistance = storesWithDistance.filter(
        (store) => store.distance !== undefined && store.distance <= radius
      );
    }

    // Sort by distance if location provided, otherwise by name
    storesWithDistance.sort((a, b) => {
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return a.name.localeCompare(b.name);
    });

    return storesWithDistance;
  }

  /**
   * Get category hierarchy with store counts
   * Useful for tree navigation
   */
  async getCategoryHierarchy(categoryId?: string): Promise<CategoryNode[]> {
    // Get all active categories with store counts
    const categories = await prisma.tenantCategory.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { id: categoryId } : { parentId: null }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        googleCategoryId: true,
        parentId: true,
        sortOrder: true,
        _count: {
          select: {
            inventoryItems: {
              where: {
                itemStatus: 'active',
                visibility: 'public',
                tenant: {
                  googleSyncEnabled: true,
                  googleLastSync: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                  },
                },
              },
            },
          },
        },
        inventoryItems: {
          where: {
            itemStatus: 'active',
            visibility: 'public',
            tenant: {
              googleSyncEnabled: true,
              googleLastSync: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          },
          select: {
            tenantId: true,
          },
          distinct: ['tenantId'],
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    // Build hierarchy recursively
    const buildTree = async (parentId: string | null): Promise<CategoryNode[]> => {
      const nodes = categories.filter((c) => c.parentId === parentId);

      return Promise.all(
        nodes.map(async (node) => ({
          id: node.id,
          name: node.name,
          slug: node.slug,
          googleCategoryId: node.googleCategoryId,
          parentId: node.parentId,
          storeCount: node.inventoryItems.length,
          productCount: node._count.inventoryItems,
          children: await buildTree(node.id),
        }))
      );
    };

    return buildTree(categoryId || null);
  }

  /**
   * Verify if a store has syncing products in a category
   */
  async verifyStoreCategory(
    tenantId: string,
    categoryId: string
  ): Promise<boolean> {
    const count = await prisma.inventoryItem.count({
      where: {
        tenantId,
        tenantCategoryId: categoryId,
        itemStatus: 'active',
        visibility: 'public',
        tenant: {
          googleSyncEnabled: true,
          googleLastSync: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      },
    });

    return count > 0;
  }

  /**
   * Get category path (breadcrumb) from root to category
   */
  async getCategoryPath(categoryId: string): Promise<CategoryWithStores[]> {
    const path: CategoryWithStores[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = await prisma.tenantCategory.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          name: true,
          slug: true,
          googleCategoryId: true,
          parentId: true,
          _count: {
            select: {
              inventoryItems: {
                where: {
                  itemStatus: 'active',
                  visibility: 'public',
                  tenant: {
                    googleSyncEnabled: true,
                    googleLastSync: {
                      gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                  },
                },
              },
            },
          },
          inventoryItems: {
            where: {
              itemStatus: 'active',
              visibility: 'public',
              tenant: {
                googleSyncEnabled: true,
                googleLastSync: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
              },
            },
            select: {
              tenantId: true,
            },
            distinct: ['tenantId'],
          },
        },
      });

      if (!category) break;

      path.unshift({
        id: category.id,
        name: category.name,
        slug: category.slug,
        googleCategoryId: category.googleCategoryId,
        storeCount: category.inventoryItems.length,
        productCount: category._count.inventoryItems,
      });

      currentId = category.parentId;
    }

    return path;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in miles
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}

export const categoryDirectoryService = new CategoryDirectoryService();
