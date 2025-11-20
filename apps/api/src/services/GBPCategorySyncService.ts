/**
 * GBP Category Sync Service
 * Handles automated syncing of Google Business Profile categories
 * Similar to TaxonomySyncService but for GBP categories
 */

import { google } from 'googleapis';
import { prisma } from '../prisma';
import { encryptToken, decryptToken, refreshAccessToken } from '../lib/google/oauth';

interface GBPCategory {
  categoryId: string;
  display_name: string;
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
      const tokenRecord = await prisma.google_oauth_tokens.findFirst({
        orderBy: { created_at: 'desc' },
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
        await prisma.google_oauth_tokens.update({
          where: { accountId: tokenRecord.accountId },
          data: {
            accessTokenEncrypted: encryptToken(newTokens.access_token),
            expires_at: newExpiresAt,
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
   * Get access token from oauth_integrations table (platform-level)
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      // Check for platform-level Google Business OAuth integration
      const oauthIntegration = await prisma.$queryRaw<any[]>`
        SELECT access_token, refresh_token, expires_at, scopes
        FROM oauth_integrations
        WHERE provider = 'google_business'
          AND tenant_id IS NULL
          AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (!oauthIntegration || oauthIntegration.length === 0) {
        console.log('[GBPCategorySync] No Google Business OAuth integration found');
        return null;
      }

      const integration = oauthIntegration[0];
      const tokens = JSON.parse(integration.access_token);

      // Check if token is expired (use expires_at from database or calculate from expires_in)
      const now = new Date();
      const expiresAt = integration.expires_at ? new Date(integration.expires_at) : null;
      
      if (expiresAt && expiresAt <= now) {
        console.log('[GBPCategorySync] Token expired, attempting refresh...');
        
        // Try to refresh token if we have a refresh token
        if (tokens.refresh_token || integration.refresh_token) {
          try {
            const refreshToken = tokens.refresh_token || integration.refresh_token;
            const newAccessToken = await this.refreshAccessToken(refreshToken);
            return newAccessToken;
          } catch (refreshError) {
            console.error('[GBPCategorySync] Token refresh failed:', refreshError);
            return null;
          }
        }
        
        console.log('[GBPCategorySync] Token expired and no refresh token available');
        return null;
      }

      return tokens.access_token;
    } catch (error) {
      console.error('[GBPCategorySync] Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Refresh access token using existing OAuth credentials
   */
  private async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_BUSINESS_CLIENT_ID,
        process.env.GOOGLE_BUSINESS_CLIENT_SECRET,
        process.env.GOOGLE_BUSINESS_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      // Get new access token
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newAccessToken = credentials.access_token!;

      // Update the stored tokens in oauth_integrations table
      await this.updateStoredTokens(newAccessToken, refreshToken, credentials.expiry_date);

      return newAccessToken;
    } catch (error) {
      console.error('[GBPCategorySync] Failed to refresh access token:', error);
      throw error;
    }
  }

  /**
   * Update stored tokens in oauth_integrations table
   */
  private async updateStoredTokens(accessToken: string, refreshToken: string, expiryDate?: number | null): Promise<void> {
    try {
      const tokenData = {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expiry_date: expiryDate
      };

      await prisma.$executeRaw`
        UPDATE oauth_integrations
        SET access_token = ${JSON.stringify(tokenData)},
            expires_at = ${expiryDate ? new Date(expiryDate) : null},
            updated_at = NOW()
        WHERE provider = 'google_business'
          AND tenant_id IS NULL
          AND is_active = true
      `;

      console.log('[GBPCategorySync] Updated stored tokens in oauth_integrations');
    } catch (error) {
      console.error('[GBPCategorySync] Failed to update stored tokens:', error);
      // Don't throw - token refresh succeeded, just couldn't save
    }
  }

  
  /**
   * Fetch latest GBP categories from Google API
   */
  async fetchLatestCategories(options: {
    regionCode?: string;
    languageCode?: string;
    pageSize?: number;
  } = {}): Promise<{
    categories: any[];
    totalCount: number;
    version: string;
  }> {
    const {
      regionCode = 'US',
      languageCode = 'en',
      pageSize = 100
    } = options;

    try {
      // Get access token from existing OAuth integration
      const accessToken = await this.getAccessToken();
      
      if (!accessToken) {
        console.log('[GBPCategorySync] No OAuth token available, using hardcoded fallback');
        return this.getHardcodedCategories();
      }

      // Fetch categories using direct API call
      const categories: any[] = [];
      let nextPageToken: string | undefined;
      let totalCount = 0;

      console.log('[GBPCategorySync] Fetching categories from Google API...');

      do {
        const params = new URLSearchParams({
          regionCode,
          languageCode,
          pageSize: pageSize.toString(),
          ...(nextPageToken && { pageToken: nextPageToken })
        });

        const response = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/categories?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Google API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.categories) {
          categories.push(...data.categories.map((cat: any) => ({
            categoryId: cat.name || '',
            display_name: cat.displayName || '',
            serviceTypes: cat.serviceTypes || [],
            moreHoursTypes: cat.moreHoursTypes || []
          })));
        }

        totalCount = data.totalCategoryCount || 0;
        nextPageToken = data.nextPageToken;
        
        console.log(`[GBPCategorySync] Fetched ${categories.length}/${totalCount} categories`);
      } while (nextPageToken);

      console.log(`[GBPCategorySync] Successfully fetched ${categories.length} categories from Google API`);

      return {
        categories,
        totalCount,
        version: this.generateVersion()
      };
    } catch (error) {
      console.error('[GBPCategorySync] Failed to fetch categories from API:', error);
      
      // Fallback to hardcoded categories
      console.log('[GBPCategorySync] Falling back to hardcoded categories');
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
      const current = await prisma.gbp_categories.findMany({
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
            await prisma.gbp_categories.create({
              data: {
                id: change.categoryId,
                name: change.newData.displayName,
                display_name: change.newData.displayName,
                isActive: true
              }
            });
            applied++;
            break;

          case 'updated':
            await prisma.gbp_categories.update({
              where: { id: change.categoryId },
              data: {
                display_name: change.newData.displayName,
                updated_at: new Date()
              }
            });
            applied++;
            break;

          case 'deleted':
            await prisma.gbp_categories.update({
              where: { id: change.categoryId },
              data: {
                isActive: false,
                updated_at: new Date()
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
   * Seed hardcoded GBP categories to database as fallback when OAuth is unavailable
   */
  async seedHardcodedCategories(): Promise<number> {
    const hardcodedCategories = [
      { id: "gcid:grocery_store", name: "Grocery store", display_name: "Grocery store" },
      { id: "gcid:convenience_store", name: "Convenience store", display_name: "Convenience store" },
      { id: "gcid:supermarket", name: "Supermarket", display_name: "Supermarket" },
      { id: "gcid:liquor_store", name: "Liquor store", display_name: "Liquor store" },
      { id: "gcid:specialty_food_store", name: "Specialty food store", display_name: "Specialty food store" },
      { id: "gcid:clothing_store", name: "Clothing store", display_name: "Clothing store" },
      { id: "gcid:shoe_store", name: "Shoe store", display_name: "Shoe store" },
      { id: "gcid:electronics_store", name: "Electronics store", display_name: "Electronics store" },
      { id: "gcid:furniture_store", name: "Furniture store", display_name: "Furniture store" },
      { id: "gcid:hardware_store", name: "Hardware store", display_name: "Hardware store" },
      { id: "gcid:pharmacy", name: "Pharmacy", display_name: "Pharmacy" },
      { id: "gcid:beauty_supply_store", name: "Beauty supply store", display_name: "Beauty supply store" },
      { id: "gcid:cosmetics_store", name: "Cosmetics store", display_name: "Cosmetics store" },
      { id: "gcid:health_and_beauty_shop", name: "Health and beauty shop", display_name: "Health and beauty shop" },
      { id: "gcid:book_store", name: "Book store", display_name: "Book store" },
      { id: "gcid:pet_store", name: "Pet store", display_name: "Pet store" },
      { id: "gcid:toy_store", name: "Toy store", display_name: "Toy store" },
      { id: "gcid:sporting_goods_store", name: "Sporting goods store", display_name: "Sporting goods store" },
      { id: "gcid:gift_shop", name: "Gift shop", display_name: "Gift shop" },
      { id: "gcid:department_store", name: "Department store", display_name: "Department store" },
      { id: "gcid:discount_store", name: "Discount store", display_name: "Discount store" },
      { id: "gcid:variety_store", name: "Variety store", display_name: "Variety store" },
      { id: "gcid:home_goods_store", name: "Home goods store", display_name: "Home goods store" },
      { id: "gcid:jewelry_store", name: "Jewelry store", display_name: "Jewelry store" },
      { id: "gcid:florist", name: "Florist", display_name: "Florist" },
      { id: "gcid:bakery", name: "Bakery", display_name: "Bakery" },
      { id: "gcid:butcher_shop", name: "Butcher shop", display_name: "Butcher shop" },
      { id: "gcid:produce_market", name: "Produce market", display_name: "Produce market" },
      { id: "gcid:wine_store", name: "Wine store", display_name: "Wine store" },
    ];

    try {
      console.log(`[GBPCategorySync] Seeding ${hardcodedCategories.length} GBP categories...`);

      // Use a transaction to ensure atomicity and better performance
      const result = await prisma.$transaction(async (tx) => {
        let upserted = 0;

        for (const category of hardcodedCategories) {
          // Check if category exists
          const existing = await tx.gBPCategory.findUnique({
            where: { id: category.id },
            select: { id: true, display_name: true }
          });

          if (!existing) {
            // Create new category
            await tx.gBPCategory.create({
              data: {
                id: category.id,
                name: category.name,
                display_name: category.displayName,
                isActive: true
              }
            });
            upserted++;
          } else if (existing.displayName !== category.displayName) {
            // Update existing category if displayName changed
            await tx.gBPCategory.update({
              where: { id: category.id },
              data: {
                display_name: category.displayName,
                updated_at: new Date()
              }
            });
            upserted++;
          }
        }

        return upserted;
      });

      console.log(`[GBPCategorySync] Successfully seeded/updated ${result} GBP categories`);
      return result;

    } catch (error) {
      console.error('[GBPCategorySync] Failed to seed GBP categories:', error);

      // Fallback: try individual operations with error handling
      console.log('[GBPCategorySync] Attempting fallback individual seeding...');
      let seeded = 0;

      for (const category of hardcodedCategories) {
        try {
          await prisma.gbp_categories.upsert({
            where: { id: category.id },
            update: {
              display_name: category.display_name,
              updated_at: new Date()
            },
            create: {
              id: category.id,
              name: category.name,
              display_name: category.display_name,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            }
          });
          seeded++;
        } catch (error) {
          console.error(`[GBPCategorySync] Failed to seed ${category.id}:`, error);
        }
      }

      console.log(`[GBPCategorySync] Fallback seeding completed: ${seeded}/${hardcodedCategories.length} categories`);
      return seeded;
    }
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
      { categoryId: 'gcid:grocery_store', display_name: 'Grocery store' },
      { categoryId: 'gcid:convenience_store', display_name: 'Convenience store' },
      { categoryId: 'gcid:supermarket', display_name: 'Supermarket' },
      { categoryId: 'gcid:liquor_store', display_name: 'Liquor store' },
      { categoryId: 'gcid:specialty_food_store', display_name: 'Specialty food store' },

      // General Retail
      { categoryId: 'gcid:clothing_store', display_name: 'Clothing store' },
      { categoryId: 'gcid:shoe_store', display_name: 'Shoe store' },
      { categoryId: 'gcid:electronics_store', display_name: 'Electronics store' },
      { categoryId: 'gcid:furniture_store', display_name: 'Furniture store' },
      { categoryId: 'gcid:hardware_store', display_name: 'Hardware store' },

      // Health & Beauty
      { categoryId: 'gcid:pharmacy', display_name: 'Pharmacy' },
      { categoryId: 'gcid:beauty_supply_store', display_name: 'Beauty supply store' },
      { categoryId: 'gcid:cosmetics_store', display_name: 'Cosmetics store' },
      { categoryId: 'gcid:health_and_beauty_shop', display_name: 'Health and beauty shop' },

      // Specialty Stores
      { categoryId: 'gcid:book_store', display_name: 'Book store' },
      { categoryId: 'gcid:pet_store', display_name: 'Pet store' },
      { categoryId: 'gcid:toy_store', display_name: 'Toy store' },
      { categoryId: 'gcid:sporting_goods_store', display_name: 'Sporting goods store' },
      { categoryId: 'gcid:gift_shop', display_name: 'Gift shop' },

      // Additional common categories
      { categoryId: 'gcid:department_store', display_name: 'Department store' },
      { categoryId: 'gcid:discount_store', display_name: 'Discount store' },
      { categoryId: 'gcid:variety_store', display_name: 'Variety store' },
      { categoryId: 'gcid:home_goods_store', display_name: 'Home goods store' },
      { categoryId: 'gcid:jewelry_store', display_name: 'Jewelry store' },
      { categoryId: 'gcid:florist', display_name: 'Florist' },
      { categoryId: 'gcid:bakery', display_name: 'Bakery' },
      { categoryId: 'gcid:butcher_shop', display_name: 'Butcher shop' },
      { categoryId: 'gcid:produce_market', display_name: 'Produce market' },
      { categoryId: 'gcid:wine_store', display_name: 'Wine store' },
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
