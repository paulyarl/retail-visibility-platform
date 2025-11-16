/**
 * GBP Category Sync Service
 * Handles automated syncing of Google Business Profile categories
 * Similar to TaxonomySyncService but for GBP categories
 */

import { prisma } from '../prisma';
import { decryptToken, refreshAccessToken, encryptToken } from '../lib/google/oauth';

interface GBPCategory {
  categoryId: string;
  displayName: string;
  serviceTypes?: string[];
  moreHoursTypes?: string[];
}

interface GBPCategoryChange {
  type: 'new' | 'updated' | 'deleted';
  categoryId: string;
  oldData?: any;
  newData?: any;
}

export class GBPCategorySyncService {
  private readonly API_BASE = 'https://mybusiness.googleapis.com/v4';
  
  /**
   * Get any valid Google OAuth access token with business.manage scope.
   * Uses the shared google_oauth_tokens table and refreshes tokens when expired.
   */
  private async getAnyValidAccessToken(): Promise<string | null> {
    try {
      const tokenRecord = await prisma.googleOAuthToken.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (!tokenRecord) {
        console.error('[GBPCategorySync] No Google OAuth token found for GBP categories');
        return null;
      }

      const now = new Date();
      if (tokenRecord.expiresAt <= now) {
        console.log('[GBPCategorySync] Token expired, refreshing for GBP categories...');

        const refreshToken = decryptToken(tokenRecord.refreshTokenEncrypted);
        const newTokens = await refreshAccessToken(refreshToken);

        if (!newTokens) {
          console.error('[GBPCategorySync] Failed to refresh token for GBP categories');
          return null;
        }

        const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
        await prisma.googleOAuthToken.update({
          where: { accountId: tokenRecord.accountId },
          data: {
            accessTokenEncrypted: encryptToken(newTokens.access_token),
            expiresAt: newExpiresAt,
            scopes: newTokens.scope.split(' '),
          },
        });

        return newTokens.access_token;
      }

      return decryptToken(tokenRecord.accessTokenEncrypted);
    } catch (error) {
      console.error('[GBPCategorySync] Error getting valid access token:', error);
      return null;
    }
  }

  /**
   * Fetch latest GBP categories from Google API
   * Requires OAuth token with business.manage scope
   */
  async fetchLatestCategories(options: {
    regionCode?: string;
    languageCode?: string;
    pageSize?: number;
  } = {}): Promise<{
    categories: GBPCategory[];
    totalCount: number;
    version: string;
  }> {
    const {
      regionCode = 'US',
      languageCode = 'en',
      pageSize = 100
    } = options;

    try {
      const accessToken = await this.getAnyValidAccessToken();

      // If we don't have an OAuth token yet, fall back to hardcoded categories
      if (!accessToken) {
        console.log('[GBPCategorySync] No OAuth token available, using hardcoded GBP categories');
        return this.getHardcodedCategories();
      }

      const categories: GBPCategory[] = [];
      let nextPageToken: string | undefined;
      let totalCount = 0;

      do {
        const params = new URLSearchParams({
          regionCode,
          languageCode,
          pageSize: pageSize.toString(),
        });

        if (nextPageToken) {
          params.set('pageToken', nextPageToken);
        }

        const response = await fetch(`${this.API_BASE}/categories?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[GBPCategorySync] Failed to fetch GBP categories from API:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
          return this.getHardcodedCategories();
        }

        const data: any = await response.json();

        if (Array.isArray(data.categories)) {
          for (const cat of data.categories) {
            categories.push({
              categoryId: cat.name || '',
              displayName: cat.displayName || '',
              serviceTypes: cat.serviceTypes || [],
              moreHoursTypes: cat.moreHoursTypes || [],
            });
          }
        }

        totalCount = typeof data.totalCategoryCount === 'number'
          ? data.totalCategoryCount
          : categories.length;
        nextPageToken = data.nextPageToken;
      } while (nextPageToken);

      return {
        categories,
        totalCount,
        version: this.generateVersion(),
      };
    } catch (error) {
      console.error('[GBPCategorySync] Failed to fetch categories:', error);
      return this.getHardcodedCategories();
    }
  }

  /**
   * Check for updates by comparing with database
   */
  async checkForUpdates(): Promise<{
    hasUpdates: boolean;
    changes: GBPCategoryChange[];
  }> {
    try {
      // Fetch latest from Google API
      const latest = await this.fetchLatestCategories();
      
      // Get current categories from database
      const current = await prisma.gBPCategory.findMany({
        where: { isActive: true }
      });

      // Detect changes
      const changes = this.detectChanges(current, latest.categories);

      return {
        hasUpdates: changes.length > 0,
        changes
      };
    } catch (error) {
      console.error('[GBPCategorySync] Failed to check for updates:', error);
      throw error;
    }
  }

  /**
   * Apply updates to database
   */
  async applyUpdates(changes: GBPCategoryChange[]): Promise<{
    applied: number;
    failed: number;
  }> {
    let applied = 0;
    let failed = 0;

    for (const change of changes) {
      try {
        switch (change.type) {
          case 'new':
            await prisma.gBPCategory.create({
              data: {
                id: change.categoryId,
                name: change.newData.displayName,
                displayName: change.newData.displayName,
                isActive: true
              }
            });
            applied++;
            break;

          case 'updated':
            await prisma.gBPCategory.update({
              where: { id: change.categoryId },
              data: {
                displayName: change.newData.displayName,
                updatedAt: new Date()
              }
            });
            applied++;
            break;

          case 'deleted':
            await prisma.gBPCategory.update({
              where: { id: change.categoryId },
              data: {
                isActive: false,
                updatedAt: new Date()
              }
            });
            applied++;
            break;
        }
      } catch (error) {
        console.error(`[GBPCategorySync] Failed to apply change for ${change.categoryId}:`, error);
        failed++;
      }
    }

    return { applied, failed };
  }

  /**
   * Seed database with hardcoded categories (fallback)
   * Used when OAuth is not configured or API is unavailable
   */
  async seedHardcodedCategories(): Promise<number> {
    const hardcodedCategories = [
      // Food & Beverage
      { id: "gcid:grocery_store", name: "Grocery store", displayName: "Grocery store" },
      { id: "gcid:convenience_store", name: "Convenience store", displayName: "Convenience store" },
      { id: "gcid:supermarket", name: "Supermarket", displayName: "Supermarket" },
      { id: "gcid:liquor_store", name: "Liquor store", displayName: "Liquor store" },
      { id: "gcid:specialty_food_store", name: "Specialty food store", displayName: "Specialty food store" },
      
      // General Retail
      { id: "gcid:clothing_store", name: "Clothing store", displayName: "Clothing store" },
      { id: "gcid:shoe_store", name: "Shoe store", displayName: "Shoe store" },
      { id: "gcid:electronics_store", name: "Electronics store", displayName: "Electronics store" },
      { id: "gcid:furniture_store", name: "Furniture store", displayName: "Furniture store" },
      { id: "gcid:hardware_store", name: "Hardware store", displayName: "Hardware store" },
      
      // Health & Beauty
      { id: "gcid:pharmacy", name: "Pharmacy", displayName: "Pharmacy" },
      { id: "gcid:beauty_supply_store", name: "Beauty supply store", displayName: "Beauty supply store" },
      { id: "gcid:cosmetics_store", name: "Cosmetics store", displayName: "Cosmetics store" },
      { id: "gcid:health_and_beauty_shop", name: "Health and beauty shop", displayName: "Health and beauty shop" },
      
      // Specialty Stores
      { id: "gcid:book_store", name: "Book store", displayName: "Book store" },
      { id: "gcid:pet_store", name: "Pet store", displayName: "Pet store" },
      { id: "gcid:toy_store", name: "Toy store", displayName: "Toy store" },
      { id: "gcid:sporting_goods_store", name: "Sporting goods store", displayName: "Sporting goods store" },
      { id: "gcid:gift_shop", name: "Gift shop", displayName: "Gift shop" },
      
      // Additional common categories
      { id: "gcid:department_store", name: "Department store", displayName: "Department store" },
      { id: "gcid:discount_store", name: "Discount store", displayName: "Discount store" },
      { id: "gcid:variety_store", name: "Variety store", displayName: "Variety store" },
      { id: "gcid:home_goods_store", name: "Home goods store", displayName: "Home goods store" },
      { id: "gcid:jewelry_store", name: "Jewelry store", displayName: "Jewelry store" },
      { id: "gcid:florist", name: "Florist", displayName: "Florist" },
      { id: "gcid:bakery", name: "Bakery", displayName: "Bakery" },
      { id: "gcid:butcher_shop", name: "Butcher shop", displayName: "Butcher shop" },
      { id: "gcid:produce_market", name: "Produce market", displayName: "Produce market" },
      { id: "gcid:wine_store", name: "Wine store", displayName: "Wine store" },
    ];

    let seeded = 0;

    for (const category of hardcodedCategories) {
      try {
        await prisma.gBPCategory.upsert({
          where: { id: category.id },
          update: {
            displayName: category.displayName,
            updatedAt: new Date()
          },
          create: {
            id: category.id,
            name: category.name,
            displayName: category.displayName,
            isActive: true
          }
        });
        seeded++;
      } catch (error) {
        console.error(`[GBPCategorySync] Failed to seed ${category.id}:`, error);
      }
    }

    return seeded;
  }

  /**
   * Get hardcoded GBP categories as a fallback when OAuth / API is unavailable.
   */
  private getHardcodedCategories(): {
    categories: GBPCategory[];
    totalCount: number;
    version: string;
  } {
    const categories: GBPCategory[] = [
      // Food & Beverage
      { categoryId: 'gcid:grocery_store', displayName: 'Grocery store' },
      { categoryId: 'gcid:convenience_store', displayName: 'Convenience store' },
      { categoryId: 'gcid:supermarket', displayName: 'Supermarket' },
      { categoryId: 'gcid:liquor_store', displayName: 'Liquor store' },
      { categoryId: 'gcid:specialty_food_store', displayName: 'Specialty food store' },

      // General Retail
      { categoryId: 'gcid:clothing_store', displayName: 'Clothing store' },
      { categoryId: 'gcid:shoe_store', displayName: 'Shoe store' },
      { categoryId: 'gcid:electronics_store', displayName: 'Electronics store' },
      { categoryId: 'gcid:furniture_store', displayName: 'Furniture store' },
      { categoryId: 'gcid:hardware_store', displayName: 'Hardware store' },

      // Health & Beauty
      { categoryId: 'gcid:pharmacy', displayName: 'Pharmacy' },
      { categoryId: 'gcid:beauty_supply_store', displayName: 'Beauty supply store' },
      { categoryId: 'gcid:cosmetics_store', displayName: 'Cosmetics store' },
      { categoryId: 'gcid:health_and_beauty_shop', displayName: 'Health and beauty shop' },

      // Specialty Stores
      { categoryId: 'gcid:book_store', displayName: 'Book store' },
      { categoryId: 'gcid:pet_store', displayName: 'Pet store' },
      { categoryId: 'gcid:toy_store', displayName: 'Toy store' },
      { categoryId: 'gcid:sporting_goods_store', displayName: 'Sporting goods store' },
      { categoryId: 'gcid:gift_shop', displayName: 'Gift shop' },

      // Additional common categories
      { categoryId: 'gcid:department_store', displayName: 'Department store' },
      { categoryId: 'gcid:discount_store', displayName: 'Discount store' },
      { categoryId: 'gcid:variety_store', displayName: 'Variety store' },
      { categoryId: 'gcid:home_goods_store', displayName: 'Home goods store' },
      { categoryId: 'gcid:jewelry_store', displayName: 'Jewelry store' },
      { categoryId: 'gcid:florist', displayName: 'Florist' },
      { categoryId: 'gcid:bakery', displayName: 'Bakery' },
      { categoryId: 'gcid:butcher_shop', displayName: 'Butcher shop' },
      { categoryId: 'gcid:produce_market', displayName: 'Produce market' },
      { categoryId: 'gcid:wine_store', displayName: 'Wine store' },
    ];

    return {
      categories,
      totalCount: categories.length,
      version: this.generateVersion(),
    };
  }

  /**
   * Detect changes between current and latest categories
   */
  private detectChanges(
    current: any[],
    latest: GBPCategory[]
  ): GBPCategoryChange[] {
    const changes: GBPCategoryChange[] = [];
    const currentMap = new Map(current.map(c => [c.id, c]));
    const latestMap = new Map(latest.map(c => [c.categoryId, c]));

    // Find new and updated categories
    for (const [id, latestCat] of latestMap) {
      const currentCat = currentMap.get(id);
      
      if (!currentCat) {
        changes.push({
          type: 'new',
          categoryId: id,
          newData: latestCat
        });
      } else if (currentCat.displayName !== latestCat.displayName) {
        changes.push({
          type: 'updated',
          categoryId: id,
          oldData: currentCat,
          newData: latestCat
        });
      }
    }

    // Find deleted categories
    for (const [id, currentCat] of currentMap) {
      if (!latestMap.has(id)) {
        changes.push({
          type: 'deleted',
          categoryId: id,
          oldData: currentCat
        });
      }
    }

    return changes;
  }

  /**
   * Generate version string based on current date
   */
  private generateVersion(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
