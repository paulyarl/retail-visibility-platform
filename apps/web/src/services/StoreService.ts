/**
 * Store Service
 * 
 * Fetches rich store data from mv_global view
 * Provides comprehensive store information for product pages
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface StoreData {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  website?: string;
  business_type?: string;
  business_category?: string;
  subscription_tier?: string;
  shop_category?: string;
  average_rating?: string;
  review_count?: string;
  description?: string;
  hours?: any;
  social_links?: any;
  payment_methods?: any[];
  delivery_options?: any[];
  created_at?: string;
  updated_at?: string;
  // New fields from mv_global_discovery
  product_count?: number;
  has_featured_products?: boolean;
}

export interface StoreHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

export interface SocialLinks {
  website?: string;
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
}

class StoreService extends PublicApiSingleton {
  private static instance: StoreService;

  private constructor() {
    super('store-service', { encrypt: false });
  }

  public static getInstance(): StoreService {
    if (!StoreService.instance) {
      StoreService.instance = new StoreService();
    }
    return StoreService.instance;
  }

  /**
   * Fetch comprehensive store data by tenant ID
   */
  async getStoreWithDetails(tenantId: string): Promise<StoreData | null> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/public/stores/${tenantId}/profile`,
        {},
        `store-profile-${tenantId}`
      );
      
      if (!response.success) {
        console.warn('[StoreService] Failed to fetch store details:', response.error);
        return null;
      }

      return this.transformStoreData(response.data);
    } catch (error) {
      console.warn(`Failed to fetch store details: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Fetch store product count
   */
  async getStoreProductCount(tenantId: string): Promise<number> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/public/stores/${tenantId}/products/count`,
        {},
        `store-product-count-${tenantId}`
      );
      
      if (!response.success) {
        console.warn('[StoreService] Failed to fetch store product count:', response.error);
        return 0;
      }

      return response.data.count || 0;
    } catch (error) {
      console.warn(`Failed to fetch store product count: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return 0;
    }
  }

  /**
   * Transform raw store data from API response
   */
  private transformStoreData(data: any): StoreData {
    // Handle API response structure: { success: true, data: {...}, metadata: {...} }
    const store = data.data || data;
    
    return {
      id: store.id || store.tenant_id,
      name: store.name || store.tenant_name || store.businessName,
      slug: store.slug || store.tenant_slug,
      logo_url: store.logo_url || store.logoUrl || store.tenant_logo_url,
      city: store.city || store.tenant_city,
      state: store.state || store.tenant_state,
      country: store.country || store.tenant_country,
      zip: store.zip || store.zipCode || store.tenant_zip,
      address: store.address || store.tenant_address,
      latitude: store.latitude || store.tenant_latitude,
      longitude: store.longitude || store.tenant_longitude,
      phone: store.phone,
      email: store.email,
      website: store.website,
      business_type: store.business_type,
      business_category: store.business_category,
      subscription_tier: store.subscription_tier,
      shop_category: store.shop_category || store.primaryCategory,
      average_rating: store.average_rating || store.store_average_rating,
      review_count: store.review_count || store.store_review_count,
      description: store.description,
      hours: store.hours,
      social_links: store.social_links,
      payment_methods: store.payment_methods,
      delivery_options: store.delivery_options,
      created_at: store.created_at || store.createdAt,
      updated_at: store.updated_at || store.updatedAt
    };
  }
}

// Export singleton instance
export const storeService = StoreService.getInstance();
export default StoreService;
