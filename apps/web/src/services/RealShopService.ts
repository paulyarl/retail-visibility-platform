/**
 * Real Shop Service
 * 
 * Connects to the actual shop management API endpoints using AuthenticatedApiSingleton
 * Follows platform patterns for authentication, caching, and API communication
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';
import { clientLogger } from '@/lib/client-logger';

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
  categoryId?: string;
  isVerified: boolean;
  isActive: boolean;
  isPublished: boolean;
  rating: number;
  reviewCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShopCreateData {
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
  timezone?: string;
  categoryId?: string;
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
  timezone?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  categoryId?: string;
}

export interface ShopAnalytics {
  views: number;
  products: number;
  orders: number;
  revenue: number;
  rating: number;
  reviews: number;
}

export interface GBPCategory {
  categoryId: string;
  display_name: string;
  serviceTypes?: string[];
  moreHoursTypes?: string[];
}

export interface ShopLimitCheck {
  canCreate: boolean;
  currentCount: number;
  maxCount: number;
  tierName: string;
}

class RealShopService extends AuthenticatedApiSingleton {
  private static instance: RealShopService;

  private constructor() {
    super('real-shop-service');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for shop data
  }

  static getInstance(): RealShopService {
    if (!RealShopService.instance) {
      RealShopService.instance = new RealShopService();
    }
    return RealShopService.instance;
  }

  /**
   * Get shop data for a tenant
   */
  async getShop(tenantId: string): Promise<ShopData | null> {
    try {
      // Use makeDefaultRequest for automatic caching and authentication
      const result = await this.makeDefaultRequest<ShopData>(
        `/api/shop-management/${tenantId}`,
        {},
        `shop-${tenantId}`
      );
      
      return result.data || null;
    } catch (error: any) {
      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        return null;
      }
      clientLogger.error('Error getting shop:', { detail: error });
      throw error;
    }
  }

  /**
   * Create or update shop data
   */
  async upsertShop(tenantId: string, data: ShopCreateData | ShopUpdateData): Promise<ShopData> {
    try {
      const result = await this.makeDefaultRequest<ShopData>(
        `/api/shop-management/${tenantId}`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
        `shop-upsert-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error saving shop:', { detail: error });
      throw error;
    }
  }

  /**
   * Update shop data
   */
  async updateShop(tenantId: string, data: ShopUpdateData): Promise<ShopData> {
    try {
      const result = await this.makeDefaultRequest<ShopData>(
        `/api/shop-management/${tenantId}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
        `shop-update-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error updating shop:', { detail: error });
      throw error;
    }
  }

  /**
   * Publish shop
   */
  async publishShop(tenantId: string): Promise<ShopData> {
    try {
      const result = await this.makeDefaultRequest<ShopData>(
        `/api/shop-management/${tenantId}/publish`,
        {
          method: 'POST',
        },
        `shop-publish-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error publishing shop:', { detail: error });
      throw error;
    }
  }

  /**
   * Unpublish shop
   */
  async unpublishShop(tenantId: string): Promise<ShopData> {
    try {
      const result = await this.makeDefaultRequest<ShopData>(
        `/api/shop-management/${tenantId}/unpublish`,
        {
          method: 'POST',
        },
        `shop-unpublish-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error unpublishing shop:', { detail: error });
      throw error;
    }
  }

  /**
   * Update shop category
   */
  async updateShopCategory(tenantId: string, categoryId: string): Promise<ShopData> {
    try {
      const result = await this.makeDefaultRequest<ShopData>(
        `/api/shop-management/${tenantId}/category`,
        {
          method: 'PUT',
          body: JSON.stringify({ categoryId }),
        },
        `shop-category-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error updating shop category:', { detail: error });
      throw error;
    }
  }

  /**
   * Update shop branding
   */
  async updateShopBranding(tenantId: string, branding: {
    logoUrl?: string;
    bannerUrl?: string;
    colors?: Record<string, string>;
  }): Promise<ShopData> {
    try {
      const result = await this.makeDefaultRequest<ShopData>(
        `/api/shop-management/${tenantId}/branding`,
        {
          method: 'PUT',
          body: JSON.stringify(branding),
        },
        `shop-branding-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error updating shop branding:', { detail: error });
      throw error;
    }
  }

  /**
   * Update shop hours
   */
  async updateShopHours(tenantId: string, hours: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  }, timezone?: string): Promise<ShopData> {
    try {
      const result = await this.makeDefaultRequest<ShopData>(
        `/api/shop-management/${tenantId}/hours`,
        {
          method: 'PUT',
          body: JSON.stringify({ hours, timezone }),
        },
        `shop-hours-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error updating shop hours:', { detail: error });
      throw error;
    }
  }

  /**
   * Update social media links
   */
  async updateSocialLinks(tenantId: string, socialLinks: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  }): Promise<ShopData> {
    try {
      const result = await this.makeDefaultRequest<ShopData>(
        `/api/shop-management/${tenantId}/social`,
        {
          method: 'PUT',
          body: JSON.stringify(socialLinks),
        },
        `shop-social-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error updating social links:', { detail: error });
      throw error;
    }
  }

  /**
   * Get shop analytics
   */
  async getShopAnalytics(tenantId: string): Promise<ShopAnalytics> {
    try {
      const result = await this.makeDefaultRequest<ShopAnalytics>(
        `/api/shop-management/${tenantId}/analytics`,
        {},
        `shop-analytics-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error getting shop analytics:', { detail: error });
      throw error;
    }
  }

  /**
   * Check tenant tier limits for shop creation
   */
  async checkShopLimits(tenantId: string): Promise<ShopLimitCheck> {
    try {
      const result = await this.makeDefaultRequest<ShopLimitCheck>(
        `/api/shop-management/${tenantId}/limits`,
        {},
        `shop-limits-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error checking shop limits:', { detail: error });
      throw error;
    }
  }

  /**
   * Delete shop data
   */
  async deleteShop(tenantId: string): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/shop-management/${tenantId}`,
        {
          method: 'DELETE',
        },
        `shop-delete-${tenantId}`
      );
    } catch (error) {
      clientLogger.error('Error deleting shop:', { detail: error });
      throw error;
    }
  }

  /**
   * Get available GBP categories for shop creation
   */
  async getAvailableCategories(): Promise<GBPCategory[]> {
    try {
      const result = await this.makeDefaultRequest<GBPCategory[]>(
        '/api/shop-management/categories',
        {},
        'shop-categories'
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error getting available categories:', { detail: error });
      throw error;
    }
  }

  /**
   * Set shop category with GBP validation
   */
  async setShopCategory(tenantId: string, categoryId: string): Promise<ShopData> {
    try {
      const result = await this.makeDefaultRequest<ShopData>(
        `/api/shop-management/${tenantId}/category`,
        {
          method: 'PUT',
          body: JSON.stringify({ categoryId }),
        },
        `shop-category-set-${tenantId}`
      );
      
      if (!result.data) {
        throw new Error('Failed to save shop: No data returned');
      }
      return result.data;
    } catch (error) {
      clientLogger.error('Error setting shop category:', { detail: error });
      throw error;
    }
  }
}

export default RealShopService;
