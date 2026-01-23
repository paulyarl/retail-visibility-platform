/**
 * Store Publish Singleton
 * 
 * Manages store publishing workflow and directory integration.
 * Handles authentication, permissions, and category validation.
 * Provides real-time updates to directory consumers.
 */

import { AutoUserCacheOptions } from '@/utils/userIdentification';
import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

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

class StorePublishSingleton extends UniversalSingleton {
  private static instance: StorePublishSingleton;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
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

    const cacheKey = `store-publish-${JSON.stringify({ limit, offset, category, state, sortBy, sortOrder, featured, trending })}`;
    
    // Try cache first
    const cached = await this.getFromCache(cacheKey, cacheOptions);
    if (cached) {
      try {
        const cachedData = cached as any;
        if (cachedData && typeof cachedData === 'object' && 'stores' in cachedData) {
          return cachedData as StorePublishData;
        }
      } catch (error) {
        console.warn('[StorePublishSingleton] Invalid cache data');
      }
    }

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

      // Fetch published stores
      const response = await fetch(`/api/stores/published?${params}`);
      
      if (!response.ok) {
        console.warn('Store publish API response not ok');
        await this.setCache(cacheKey, defaultResult, cacheOptions);
        return defaultResult;
      }

      const data = await response.json();
      
      if (!data || !data.stores) {
        await this.setCache(cacheKey, defaultResult, cacheOptions);
        return defaultResult;
      }

      const result: StorePublishData = {
        stores: data.stores || [],
        totalCount: data.totalCount || 0,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
        categories: data.categories || []
      };

      // Cache the result
      // Cache the result
      await this.setCache(cacheKey, result, cacheOptions); // 10 minutes

      return result;
    } catch (error) {
      console.error('Error fetching published stores:', error);
      await this.setCache(cacheKey, defaultResult, cacheOptions);
      return defaultResult;
    }
  }

  // Get a single published store by ID
  async getPublishedStore(storeId: string): Promise<PublishedStore | null> {
    const cacheKey = `store-publish-single-${storeId}`;
    
    // Try cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      try {
        return cached as unknown as PublishedStore;
      } catch (error) {
        console.warn('[StorePublishSingleton] Invalid single store cache data');
      }
    }

    try {
      const response = await fetch(`/api/stores/published/${storeId}`);
      
      if (!response.ok) {
        return null;
      }

      const store = await response.json();
      
      // Cache the single store
      await this.setCache(cacheKey, store); // 15 minutes

      return store;
    } catch (error) {
      console.error('Error fetching published store:', error);
      return null;
    }
  }

  // Publish a store (for store owners and admins)
  async publishStore(storeId: string, storeData: Partial<PublishedStore>): Promise<PublishedStore | null> {
    try {
      const response = await fetch('/api/stores/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId,
          ...storeData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to publish store');
      }

      const publishedStore = await response.json();
      
      // Invalidate relevant caches
      this.invalidateCache();
      
      return publishedStore;
    } catch (error) {
      console.error('Error publishing store:', error);
      return null;
    }
  }

  // Unpublish a store
  async unpublishStore(storeId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/stores/publish/${storeId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to unpublish store');
      }

      // Invalidate relevant caches
      this.invalidateCache();
      
      return true;
    } catch (error) {
      console.error('Error unpublishing store:', error);
      return false;
    }
  }

  // Update published store
  async updatePublishedStore(storeId: string, updates: Partial<PublishedStore>): Promise<PublishedStore | null> {
    try {
      const response = await fetch(`/api/stores/published/${storeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update published store');
      }

      const updatedStore = await response.json();
      
      // Invalidate relevant caches
      this.invalidateCache();
      
      return updatedStore;
    } catch (error) {
      console.error('Error updating published store:', error);
      return null;
    }
  }

  // Get available directory categories
  async getDirectoryCategories(): Promise<DirectoryCategory[]> {
    const cacheKey = 'directory-categories';
    
    // Try cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      try {
        return cached as unknown as DirectoryCategory[];
      } catch (error) {
        console.warn('[StorePublishSingleton] Invalid categories cache data');
      }
    }

    try {
      const response = await fetch('/api/directory/categories');
      
      if (!response.ok) {
        return [];
      }

      const categories = await response.json();
      
      // Handle null response
      if (!categories || !Array.isArray(categories)) {
        return [];
      }
      
      // Cache categories for longer period
      await this.setCache(cacheKey, categories); // 1 hour

      return categories;
    } catch (error) {
      console.error('Error fetching directory categories:', error);
      return [];
    }
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
    try {
      const response = await fetch('/api/stores/publish/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, tenantId })
      });

      if (!response.ok) {
        return { canPublish: false, canPublishAny: false, reason: 'Permission check failed' };
      }

      const permissions = await response.json();
      return permissions;
    } catch (error) {
      console.error('Error checking publishing permissions:', error);
      return { canPublish: false, canPublishAny: false, reason: 'Permission check error' };
    }
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
