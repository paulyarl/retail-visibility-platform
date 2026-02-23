/**
 * Store Publish Singleton
 * 
 * Manages store publishing workflow and directory integration.
 * Handles authentication, permissions, and category validation.
 * Provides real-time updates to directory consumers.
 */

import { AutoUserCacheOptions } from '@/utils/userIdentification';
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { SingletonCacheOptions } from '@/providers/base/FlexibleApiSingleton';

// Directory Category Types
export interface DirectoryCategory {
  id: string;
  name: string;
  slug: string;
  level: 'primary' | 'secondary';
  parentId?: string;
}

// Store Photo Types
export interface StorePhoto {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
  order: number;
}

// Store Data Types
export interface StoreBranding {
  logo: string;
  banner: string;
  colors: {
    primary: string;
    secondary: string;
  };
  theme: string;
}

export interface StoreLocation {
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface StoreHours {
  monday: { open: string; close: string; closed: boolean };
  tuesday: { open: string; close: string; closed: boolean };
  wednesday: { open: string; close: string; closed: boolean };
  thursday: { open: string; close: string; closed: boolean };
  friday: { open: string; close: string; closed: boolean };
  saturday: { open: string; close: string; closed: boolean };
  sunday: { open: string; close: string; closed: boolean };
}

export interface StoreContact {
  phone: string;
  email: string;
  website: string;
}

export interface StoreSocial {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
}

// Main Published Store Interface
export interface PublishedStore {
  id: string;
  tenantId: string;
  publishedBy: string; // user ID who published
  publishedAt: string;
  publishState: 'draft' | 'published' | 'unpublished';
  
  // Directory Categories (required for publishing)
  primaryCategory: DirectoryCategory;
  secondaryCategories: DirectoryCategory[];
  
  // Store Assets
  gallery: StorePhoto[]; // up to 10 photos
  branding: StoreBranding;
  location: StoreLocation;
  hours: StoreHours;
  contact: StoreContact;
  social: StoreSocial;
  
  // Metadata
  lastUpdated: string;
  featuredRank?: number;
  trending?: boolean;
  viewCount: number;
  rating: number;
  reviewCount: number;
}

// Store Publish Data Response
export interface StorePublishData {
  stores: PublishedStore[];
  totalCount: number;
  lastUpdated: string;
  categories: DirectoryCategory[];
}

// Store Publish Options
export interface StorePublishOptions {
  limit?: number;
  offset?: number;
  category?: string;
  state?: 'draft' | 'published' | 'unpublished';
  sortBy?: 'publishedAt' | 'lastUpdated' | 'rating' | 'viewCount' | 'featuredRank';
  sortOrder?: 'asc' | 'desc';
  featured?: boolean;
  trending?: boolean;
}

class StorePublishSingleton extends PublicApiSingleton {
  private static instance: StorePublishSingleton;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey);
    this.cacheTTL = 10 * 60 * 1000; // 10 minutes for store publish data
  }

  static getInstance(options?: { encrypt?: boolean; userId?: string }): StorePublishSingleton {
    if (!StorePublishSingleton.instance) {
      StorePublishSingleton.instance = new StorePublishSingleton('store-publish-singleton', options);
    }
    return StorePublishSingleton.instance;
  }

  // Get published stores with filtering and pagination
  async getPublishedStores(options: StorePublishOptions = {}, cacheOptions?: AutoUserCacheOptions): Promise<StorePublishData> {
    const {
      limit = 50,
      offset = 0,
      category,
      state = 'published',
      sortBy = 'publishedAt',
      sortOrder = 'desc',
      featured = false,
      trending = false
    } = options;

    // Default empty result
    const defaultResult: StorePublishData = {
      stores: [],
      totalCount: 0,
      lastUpdated: new Date().toISOString(),
      categories: []
    };

    try {
      // Build query parameters
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        state,
        sortBy,
        sortOrder
      });

      if (category) params.append('category', category);
      if (featured) params.append('featured', 'true');
      if (trending) params.append('trending', 'true');

      const cacheKey = `store-publish-${params.toString()}`;

      // Fetch published stores
      const result = await this.makeDefaultRequest<StorePublishData>(
        `/api/stores/published?${params}`,
        {},
        cacheKey
      );
      
      if (!result.success || !result.data || !result.data.stores) {
        console.error('[StorePublishSingleton] Failed to fetch published stores:', result.error);
        return defaultResult;
      }

      return {
        stores: result.data.stores,
        totalCount: result.data.totalCount,
        lastUpdated: result.data.lastUpdated,
        categories: result.data.categories
      };
    } catch (error) {
      console.warn('Store publish API error:', error);
      return defaultResult;
    }
  }

  // Get a single published store by ID
  async getPublishedStore(storeId: string): Promise<PublishedStore | null> {
    try {
      const result = await this.makeDefaultRequest<PublishedStore>(
        `/api/stores/published/${storeId}`,
        {},
        `store-publish-single-${storeId}`
      );

      if (!result.success) {
        console.error('Error fetching published store:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('Error fetching published store:', error);
      return null;
    }
  }

  // Publish a store (for store owners and admins)
  async publishStore(storeId: string, storeData: Partial<PublishedStore>): Promise<PublishedStore | null> {
    const result = await this.makeDefaultRequest<PublishedStore>(
      '/api/stores/publish',
      {
        method: 'POST',
        body: JSON.stringify({ storeId, ...storeData })
      },
      `store-publish-${storeId}`
    );
    
    if (!result.success) {
      console.error('Error publishing store:', result.error);
      return null;
    }
    
    return result.data || null;
  }

  // Unpublish a store
  async unpublishStore(storeId: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<void>(
      `/api/stores/publish/${storeId}`,
      {
        method: 'DELETE'
      },
      `store-unpublish-${storeId}`
    );
    
    if (!result.success) {
      console.error('Error unpublishing store:', result.error);
      return false;
    }
    
    return true;
  }

  // Update published store
  async updatePublishedStore(storeId: string, updates: Partial<PublishedStore>): Promise<PublishedStore | null> {
    const result = await this.makeDefaultRequest<PublishedStore>(
      `/api/stores/published/${storeId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates)
      },
      `store-update-${storeId}`
    );
    
    if (!result.success) {
      console.error('Error updating published store:', result.error);
      return null;
    }
    
    return result.data || null;
  }

  // Get available directory categories
  async getDirectoryCategories(): Promise<DirectoryCategory[]> {
    const result = await this.makeDefaultRequest<DirectoryCategory[]>(
      '/api/directory/categories',
      {},
      'directory-categories'
    );
    
    if (!result.success) {
      console.error('Error fetching directory categories:', result.error);
      return [];
    }
    
    // Handle null response
    if (!result.data || !Array.isArray(result.data)) {
      return [];
    }

    return result.data;
  }

  // Validate store publishing requirements
  validatePublishingRequirements(storeData: Partial<PublishedStore>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!storeData.primaryCategory) {
      errors.push('Primary category is required');
    }

    if (!storeData.location?.address) {
      errors.push('Store address is required');
    }

    if (!storeData.contact?.phone) {
      errors.push('Contact phone is required');
    }

    if (!storeData.gallery || storeData.gallery.length === 0) {
      errors.push('At least one store photo is required');
    }

    if (storeData.gallery && storeData.gallery.length > 10) {
      errors.push('Maximum 10 photos allowed in gallery');
    }

    // Check photo requirements
    if (storeData.gallery) {
      const primaryPhotos = storeData.gallery.filter(photo => photo.isPrimary);
      if (primaryPhotos.length !== 1) {
        errors.push('Exactly one photo must be marked as primary');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Check user permissions for store publishing
  async checkPublishingPermissions(userId: string, tenantId?: string): Promise<{
    canPublish: boolean;
    canPublishAny: boolean;
    reason?: string;
  }> {
    const result = await this.makeDefaultRequest<{
      canPublish: boolean;
      canPublishAny: boolean;
      reason?: string;
    }>(
      '/api/stores/publish/permissions',
      {
        method: 'POST',
        body: JSON.stringify({ userId, tenantId })
      },
      `permissions-${userId}-${tenantId || 'default'}`
    );

    if (!result.success) {
      console.error('Error checking publishing permissions:', result.error);
      return { canPublish: false, canPublishAny: false, reason: 'Permission check error' };
    }

    return result.data || { canPublish: false, canPublishAny: false, reason: 'No permission data received' };
  }

  // Store publishing metrics for UniversalSingleton
  protected getCustomMetrics(): Record<string, any> {
    return {
      totalStores: 0, // Would be tracked in a real implementation
      lastUpdated: new Date().toISOString()
    };
  }

  // Invalidate cache when stores are published/updated
  async invalidateCache(): Promise<void> {
    // Clear all store publish related caches
    await super.clearCache();
  }

  // Get featured stores (for directory homepage)
  async getFeaturedStores(limit: number = 10): Promise<PublishedStore[]> {
    return this.getPublishedStores({ 
      limit, 
      featured: true, 
      sortBy: 'featuredRank',
      sortOrder: 'asc'
    }).then(data => data.stores);
  }

  // Get trending stores
  async getTrendingStores(limit: number = 10): Promise<PublishedStore[]> {
    return this.getPublishedStores({ 
      limit, 
      trending: true, 
      sortBy: 'viewCount',
      sortOrder: 'desc'
    }).then(data => data.stores);
  }

  // Get stores by category
  async getStoresByCategory(categoryId: string, limit: number = 20): Promise<PublishedStore[]> {
    return this.getPublishedStores({ 
      limit, 
      category: categoryId,
      sortBy: 'rating',
      sortOrder: 'desc'
    }).then(data => data.stores);
  }
}

export default StorePublishSingleton;
