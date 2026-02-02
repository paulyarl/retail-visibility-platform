/**
 * Real Shop Service
 * 
 * Connects to the actual shop management API endpoints using UniversalSingletonClient
 * Follows platform patterns for authentication, caching, and API communication
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

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

class RealShopService {
  private static instance: RealShopService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with platform defaults
    // Auth token is retrieved dynamically for each request
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      enableLogging: true,
      enableMetrics: true
    });
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
    console.log('[RealShopService] getShop called with tenantId:', tenantId);
    
    if (!tenantId) {
      console.error('[RealShopService] getShop: tenantId is undefined or null');
      throw new Error('Tenant ID is required');
    }

    try {
      // Use UniversalSingletonClient for automatic caching and authentication
      const result = await this.client.makeRequest<ShopData>(`/api/shop-management/${tenantId}`);
      
      if (!result.data) {
        return null;
      }
      
      return result.data;
    } catch (error: any) {
      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        return null;
      }
      console.error('Error getting shop:', error);
      throw error;
    }
  }

  /**
   * Create or update shop data
   */
  async upsertShop(tenantId: string, data: ShopCreateData | ShopUpdateData): Promise<ShopData> {
    try {
      const result = await this.client.makeRequest<ShopData>(`/api/shop-management/${tenantId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error saving shop:', error);
      throw error;
    }
  }

  /**
   * Update shop data
   */
  async updateShop(tenantId: string, data: ShopUpdateData): Promise<ShopData> {
    try {
      const result = await this.client.makeRequest<ShopData>(`/api/shop-management/${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error updating shop:', error);
      throw error;
    }
  }

  /**
   * Publish shop
   */
  async publishShop(tenantId: string): Promise<ShopData> {
    try {
      const result = await this.client.makeRequest<ShopData>(`/api/shop-management/${tenantId}/publish`, {
        method: 'POST',
      });
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error publishing shop:', error);
      throw error;
    }
  }

  /**
   * Unpublish shop
   */
  async unpublishShop(tenantId: string): Promise<ShopData> {
    try {
      const result = await this.client.makeRequest<ShopData>(`/api/shop-management/${tenantId}/unpublish`, {
        method: 'POST',
      });
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error unpublishing shop:', error);
      throw error;
    }
  }

  /**
   * Update shop category
   */
  async updateShopCategory(tenantId: string, categoryId: string): Promise<ShopData> {
    try {
      const result = await this.client.makeRequest<ShopData>(`/api/shop-management/${tenantId}/category`, {
        method: 'PUT',
        body: JSON.stringify({ categoryId }),
      });
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error updating shop category:', error);
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
      const result = await this.client.makeRequest<ShopData>(`/api/shop-management/${tenantId}/branding`, {
        method: 'PUT',
        body: JSON.stringify(branding),
      });
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error updating shop branding:', error);
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
      const result = await this.client.makeRequest<ShopData>(`/api/shop-management/${tenantId}/hours`, {
        method: 'PUT',
        body: JSON.stringify({ hours, timezone }),
      });
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error updating shop hours:', error);
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
      const result = await this.client.makeRequest<ShopData>(`/api/shop-management/${tenantId}/social`, {
        method: 'PUT',
        body: JSON.stringify(socialLinks),
      });
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error updating social links:', error);
      throw error;
    }
  }

  /**
   * Get shop analytics
   */
  async getShopAnalytics(tenantId: string): Promise<ShopAnalytics> {
    try {
      const result = await this.client.makeRequest<ShopAnalytics>(`/api/shop-management/${tenantId}/analytics`);
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error getting shop analytics:', error);
      throw error;
    }
  }

  /**
   * Check tenant tier limits for shop creation
   */
  async checkShopLimits(tenantId: string): Promise<ShopLimitCheck> {
    try {
      const result = await this.client.makeRequest<ShopLimitCheck>(`/api/shop-management/${tenantId}/limits`);
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error checking shop limits:', error);
      throw error;
    }
  }

  /**
   * Delete shop data
   */
  async deleteShop(tenantId: string): Promise<void> {
    try {
      await this.client.makeRequest<void>(`/api/shop-management/${tenantId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error deleting shop:', error);
      throw error;
    }
  }

  /**
   * Get available GBP categories for shop creation
   */
  async getAvailableCategories(): Promise<GBPCategory[]> {
    try {
      const result = await this.client.makeRequest<GBPCategory[]>('/api/shop-management/categories');
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error getting available categories:', error);
      throw error;
    }
  }

  /**
   * Set shop category with GBP validation
   */
  async setShopCategory(tenantId: string, categoryId: string): Promise<ShopData> {
    try {
      const result = await this.client.makeRequest<ShopData>(`/api/shop-management/${tenantId}/category`, {
        method: 'PUT',
        body: JSON.stringify({ categoryId }),
      });
      
      if (!result.data) {
        throw new Error('No data returned from API');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error setting shop category:', error);
      throw error;
    }
  }
}

export default RealShopService;
