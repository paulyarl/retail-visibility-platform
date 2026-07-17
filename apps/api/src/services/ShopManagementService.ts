/**
 * Real Shop Management Service
 * 
 * Provides persistent shop management operations using actual database models
 * Integrates with tenants, tenant_business_profiles_list, and related tables
 * Extends UniversalSingleton for consistent slug generation and caching
 */

import { prisma } from '../prisma';
import { UniversalSingleton, type SingletonCacheOptions } from '../lib/UniversalSingleton';
import TenantSingletonService  from './TenantSingletonService';
import GBPCategorySyncSingletonService, { type GBPCategory } from './GBPCategorySyncSingletonService';
import { logger } from '../logger';

export interface ShopData {
  id: string;
  shopUniqueId: string; // Unique ID using tenant autoId
  tenantId: string;
  name: string;
  slug: string;
  autoId: string; // Tenant autoId from UniversalSingleton
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    countryCode: string;
  };
  hours?: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  timezone?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  category?: {
    id: string;
    name: string;
    categoryId: string; // GBP category ID
    serviceTypes?: string[];
    moreHoursTypes?: string[];
  };
  isPublished: boolean;
  isActive: boolean;
  isVerified: boolean;
  rating?: number;
  reviewCount?: number;
  productCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopCreateData {
  tenantId: string;
  name: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    countryCode: string;
  };
  hours?: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  categoryId?: string;
  timezone?: string;
}

export interface ShopUpdateData {
  name?: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryCode?: string;
  };
  hours?: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  categoryId?: string;
  timezone?: string;
}

// Cache options for shop data
const SHOP_CACHE_OPTIONS: SingletonCacheOptions = {
  enableCache: true,
  defaultTTL: 300, // 5 minutes
  maxCacheSize: 500,
  enableMetrics: true,
  enableLogging: true,
  enableEncryption: false,
  authenticationLevel: 'authenticated'
};

class ShopManagementService extends UniversalSingleton {
  private static instance: ShopManagementService;
  private tenantService: typeof TenantSingletonService;
  private gbpCategoryService: GBPCategorySyncSingletonService;

  private constructor() {
    super('ShopManagementService', SHOP_CACHE_OPTIONS);
    this.tenantService = TenantSingletonService.getInstance();
    this.gbpCategoryService = GBPCategorySyncSingletonService.getInstance();
  }

  static getInstance(): ShopManagementService {
    if (!ShopManagementService.instance) {
      ShopManagementService.instance = new ShopManagementService();
    }
    return ShopManagementService.instance;
  }

  /**
   * Get shop data for a tenant
   * Combines tenant data with business profile
   * Uses singleton caching system
   */
  async getShop(tenantId: string): Promise<ShopData | null> {
    const cacheKey = `shop_data:${tenantId}`;
    
    // Check cache first using singleton system
    const cached = await this.getFromCache<ShopData>(cacheKey);
    if (cached) return cached;

    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        return null;
      }

      const businessProfile = await prisma.tenant_business_profiles_list.findUnique({
        where: { tenant_id: tenantId }
      });

      // Get product count
      const productCount = await prisma.inventory_items.count({
        where: { tenant_id: tenantId }
      });

      // Get published status from metadata
      const metadata = (tenant.metadata as Record<string, any>) || {};
      const isPublished = metadata.isPublished || false;

      // Get slug from tenant service (uses gated slug creation)
      const tenantIdentifiers = await this.tenantService.getTenantIdentifiersAsync(tenantId);
      const slug = tenantIdentifiers.slug;
      const autoId = tenantIdentifiers.autoId;

      // Generate shop unique ID
      const shopUniqueId = this.generateShopUniqueId(tenantId);

      // Get timezone from hours JSON field
      const hoursData = (businessProfile?.hours as Record<string, any>) || {};
      const timezone = hoursData.timezone || 'America/New_York';

      const shopData = {
        id: tenant.id,
        shopUniqueId,
        tenantId: tenant.id,
        name: businessProfile?.business_name || tenant.name,
        slug,
        autoId,
        description: businessProfile?.business_description || undefined,
        logoUrl: businessProfile?.logo_url || undefined,
        bannerUrl: businessProfile?.banner_url || undefined,
        email: businessProfile?.email || undefined,
        phone: businessProfile?.phone_number || undefined,
        website: businessProfile?.website || undefined,
        address: businessProfile ? {
          line1: businessProfile.address_line1,
          line2: businessProfile.address_line2 || undefined,
          city: businessProfile.city,
          state: businessProfile.state || undefined,
          postalCode: businessProfile.postal_code,
          countryCode: businessProfile.country_code
        } : undefined,
        hours: (businessProfile?.hours as Record<string, string>) || undefined,
        socialLinks: (businessProfile?.social_links as Record<string, string>) || undefined,
        category: businessProfile?.gbp_category_id ? {
          id: businessProfile.gbp_category_id,
          name: businessProfile.gbp_category_name || 'Unknown',
          categoryId: businessProfile.gbp_category_id
        } : undefined,
        isPublished,
        isActive: tenant.location_status === 'active',
        isVerified: true, // Could be based on verification status
        rating: 0, // Could be calculated from reviews
        reviewCount: 0, // Could be calculated from reviews
        productCount,
        createdAt: tenant.created_at,
        updatedAt: businessProfile?.updated_at || tenant.created_at,
        timezone
      };

      // Cache the result using singleton system
      await this.setCache(cacheKey, shopData);
      return shopData;
    } catch (error) {
      logger.error('Error getting shop data:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Check if tenant can create more shops based on tier limits
   */
  async checkTenantShopLimit(tenantId: string): Promise<{
    canCreate: boolean;
    currentCount: number;
    maxCount: number;
    tierName: string;
  }> {
    try {
      // Get tenant tier information
      const tierResponse = await fetch(`${process.env.API_BASE_URL || 'http://localhost:4000'}/api/tiers/${tenantId}`);
      if (!tierResponse.ok) {
        throw new Error('Failed to get tenant tier information');
      }
      
      const tierData = await tierResponse.json() as { data: any };
      const tier = tierData.data;
      
      // Get current shop count (for now, we assume 1 shop per tenant, but this could be extended)
      const currentCount = await this.getTenantShopCount(tenantId);
      
      return {
        canCreate: currentCount < tier.tier.limits.maxShops,
        currentCount,
        maxCount: tier.tier.limits.maxShops,
        tierName: tier.tier.name
      };
    } catch (error) {
      logger.error('Error checking tenant shop limit:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      // Default to allowing creation if we can't check limits
      return {
        canCreate: true,
        currentCount: 0,
        maxCount: 1,
        tierName: 'Unknown'
      };
    }
  }

  /**
   * Get current shop count for tenant
   */
  private async getTenantShopCount(tenantId: string): Promise<number> {
    try {
      // For now, check if shop data exists (1 shop per tenant model)
      // This could be extended for multi-shop scenarios
      const shop = await this.getShop(tenantId);
      return shop ? 1 : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate unique shop ID using tenant autoId
   */
  private generateShopUniqueId(tenantId: string): string {
    // Get tenant identifiers including autoId from base singleton
    const tenantIdentifiers = this.tenantService.getTenantIdentifiers(tenantId);
    const autoId = tenantIdentifiers.autoId;
    
    // Generate a unique shop ID using the tenant autoId
    // Format: shop-{autoId}-{timestamp}
    const timestamp = Date.now().toString(36).slice(-4);
    return `shop-${autoId}-${timestamp}`;
  }

  /**
   * Get available GBP categories for shop creation
   * Returns categories that can be used for new shops
   */
  async getAvailableCategories(): Promise<GBPCategory[]> {
    try {
      const categories = await this.gbpCategoryService.getAvailableCategories();
      return categories;
    } catch (error) {
      logger.error('Error getting available GBP categories:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Validate and set shop category
   * Ensures the category ID is valid GBP category
   */
  async setShopCategory(tenantId: string, categoryId: string): Promise<ShopData> {
    try {
      // Validate that the category exists in GBP categories
      const categories = await this.getAvailableCategories();
      const category = categories.find(cat => cat.categoryId === categoryId);
      
      if (!category) {
        throw new Error(`Invalid GBP category ID: ${categoryId}`);
      }

      // Update shop with validated category
      const shop = await this.upsertShop(tenantId, { categoryId });
      
      return shop;
    } catch (error) {
      logger.error('Error setting shop category:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Create or update shop data
   */
  async upsertShop(tenantId: string, data: ShopCreateData | ShopUpdateData): Promise<ShopData> {
    try {
      // First, ensure tenant exists
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Generate unique shop ID if this is a new shop
      const shopId = this.generateShopUniqueId(tenantId);

      // If name is being updated, trigger slug regeneration through tenant service
      if (data.name && data.name !== tenant.name) {
        // Update tenant name which will trigger slug regeneration
        await prisma.tenants.update({
          where: { id: tenantId },
          data: { name: data.name }
        });
      }

      // Note: Cache clearing disabled due to protected method access
      // In production, we would clear tenant cache here to force slug regeneration

      // Prepare business profile data
      const businessProfileData = {
        business_name: data.name || tenant.name,
        business_description: data.description || '',
        email: data.email || '',
        phone_number: data.phone || '',
        website: data.website || '',
        address_line1: data.address?.line1 || '',
        address_line2: data.address?.line2 || '',
        city: data.address?.city || '',
        state: data.address?.state || '',
        postal_code: data.address?.postalCode || '',
        country_code: data.address?.countryCode || 'US',
        hours: data.hours as any,
        social_links: data.socialLinks as any,
        gbp_category_id: data.categoryId,
        updated_at: new Date()
      };

      // Upsert business profile
      const businessProfile = await prisma.tenant_business_profiles_list.upsert({
        where: { tenant_id: tenantId },
        update: businessProfileData,
        create: {
          tenant_id: tenantId,
          ...businessProfileData,
          display_map: false,
          map_privacy_mode: 'precise'
        }
      });

      // Update tenant name if provided
      if (data.name && data.name !== tenant.name) {
        await prisma.tenants.update({
          where: { id: tenantId },
          data: { name: data.name }
        });
      }

      // Clear shop cache to force refresh
      await this.clearCache(`shop_data:${tenantId}`);

      // Return updated shop data
      return await this.getShop(tenantId) as ShopData;
    } catch (error) {
      logger.error('Error upserting shop:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Publish shop (makes it publicly visible)
   */
  async publishShop(tenantId: string): Promise<ShopData> {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Update tenant metadata to mark as published
      const metadata = (tenant.metadata as Record<string, any>) || {};
      const updatedMetadata = {
        ...metadata,
        isPublished: true,
        publishedAt: new Date().toISOString()
      };

      await prisma.tenants.update({
        where: { id: tenantId },
        data: {
          metadata: updatedMetadata as any
        }
      });

      // Could also trigger directory listing creation here
      await this.createOrUpdateDirectoryListing(tenantId);

      // Clear shop cache to force refresh
      await this.clearCache(`shop_data:${tenantId}`);

      return await this.getShop(tenantId) as ShopData;
    } catch (error) {
      logger.error('Error publishing shop:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Unpublish shop (makes it private)
   */
  async unpublishShop(tenantId: string): Promise<ShopData> {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Update tenant metadata to mark as unpublished
      const metadata = (tenant.metadata as Record<string, any>) || {};
      const updatedMetadata = {
        ...metadata,
        isPublished: false,
        unpublishedAt: new Date().toISOString()
      };

      await prisma.tenants.update({
        where: { id: tenantId },
        data: {
          metadata: updatedMetadata as any
        }
      });

      // Could also remove from directory listings here
      await this.removeDirectoryListing(tenantId);

      // Clear shop cache to force refresh
      await this.clearCache(`shop_data:${tenantId}`);

      return await this.getShop(tenantId) as ShopData;
    } catch (error) {
      logger.error('Error unpublishing shop:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Get all shops for a tenant (for multi-shop tenants)
   */
  async getTenantShops(tenantId: string): Promise<ShopData[]> {
    try {
      // For now, return single shop per tenant
      // Could be extended for multi-shop scenarios
      const shop = await this.getShop(tenantId);
      return shop ? [shop] : [];
    } catch (error) {
      logger.error('Error getting tenant shops:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Delete shop data
   */
  async deleteShop(tenantId: string): Promise<void> {
    try {
      // Delete business profile
      await prisma.tenant_business_profiles_list.delete({
        where: { tenant_id: tenantId }
      });

      // Clear shop-related metadata
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId }
      });

      if (tenant) {
        const metadata = (tenant.metadata as Record<string, any>) || {};
        const updatedMetadata = {
          ...metadata,
          isPublished: false,
          shopDeleted: true,
          deletedAt: new Date().toISOString()
        };

        await prisma.tenants.update({
          where: { id: tenantId },
          data: {
            metadata: updatedMetadata as any
          }
        });
      }
    } catch (error) {
      logger.error('Error deleting shop:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Create or update directory listing
   */
  private async createOrUpdateDirectoryListing(tenantId: string): Promise<void> {
    try {
      const shop = await this.getShop(tenantId);
      if (!shop) return;

      // This would integrate with your directory system
      // For now, just log the action
      console.log(`Creating/updating directory listing for tenant: ${tenantId}`);
      
      // Example: await prisma.directory_listings_list.upsert({...});
    } catch (error) {
      logger.error('Error creating directory listing:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    }
  }

  /**
   * Remove directory listing
   */
  private async removeDirectoryListing(tenantId: string): Promise<void> {
    try {
      // This would remove from your directory system
      console.log(`Removing directory listing for tenant: ${tenantId}`);
      
      // Example: await prisma.directory_listings_list.deleteMany({where: {tenant_id: tenantId}});
    } catch (error) {
      logger.error('Error removing directory listing:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    }
  }

  /**
   * Get shop analytics
   */
  async getShopAnalytics(tenantId: string): Promise<{
    views: number;
    products: number;
    orders: number;
    revenue: number;
    rating: number;
    reviews: number;
  }> {
    try {
      // Get product count
      const productCount = await prisma.inventory_items.count({
        where: { tenant_id: tenantId }
      });

      // Get analytics from trending analytics table
      const analytics = await prisma.shop_trending_analytics.findFirst({
        where: { tenant_id: tenantId }
      });

      return {
        views: analytics?.view_count || 0,
        products: productCount,
        orders: 0, // Would come from orders table
        revenue: 0, // Would come from orders table
        rating: 0, // Would come from reviews table
        reviews: 0 // Would come from reviews table
      };
    } catch (error) {
      logger.error('Error getting shop analytics:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }
}

export default ShopManagementService;
