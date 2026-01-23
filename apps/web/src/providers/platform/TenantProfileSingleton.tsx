/**
 * Tenant Profile Singleton - Producer Pattern
 * 
 * Produces and manages tenant profile data
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

// Tenant Profile Data Interfaces
export interface TenantProfile {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  contact: {
    email?: string;
    phone?: string;
    website?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  business: {
    category?: string;
    subcategory?: string;
    size?: 'small' | 'medium' | 'large' | 'enterprise';
    industry?: string;
    foundedYear?: number;
  };
  branding: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    font?: string;
    theme?: 'light' | 'dark' | 'auto';
  };
  settings: {
    enablePublicProfile: boolean;
    enableContactForm: boolean;
    enableReviews: boolean;
    enableAnalytics: boolean;
    timezone: string;
    language: string;
    currency: string;
  };
  subscription: {
    plan: string;
    tier: number;
    limits: {
      products: number;
      locations: number;
      users: number;
      storage: number; // MB
    };
    usage: {
      products: number;
      locations: number;
      users: number;
      storage: number; // MB
    };
    status: 'active' | 'trial' | 'expired' | 'suspended';
    expiresAt?: string;
  };
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImage?: string;
    canonicalUrl?: string;
  };
  social: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
  integrations: {
    square?: {
      enabled: boolean;
      connected: boolean;
      locationId?: string;
    };
    google?: {
      enabled: boolean;
      connected: boolean;
      businessProfileId?: string;
    };
    clover?: {
      enabled: boolean;
      connected: boolean;
      merchantId?: string;
    };
  };
  compliance: {
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    privacyPolicy?: string;
    termsOfService?: string;
    cookiePolicy?: string;
  };
  analytics: {
    pageViews: number;
    uniqueVisitors: number;
    averageSessionDuration: number;
    bounceRate: number;
    conversionRate: number;
    topPages: Array<{
      url: string;
      views: number;
      avgTimeOnPage: number;
    }>;
  };
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface TenantProfileUpdate {
  name?: string;
  description?: string;
  contact?: Partial<TenantProfile['contact']>;
  business?: Partial<TenantProfile['business']>;
  branding?: Partial<TenantProfile['branding']>;
  settings?: Partial<TenantProfile['settings']>;
  seo?: Partial<TenantProfile['seo']>;
  social?: Partial<TenantProfile['social']>;
  compliance?: Partial<TenantProfile['compliance']>;
  updatedAt?: string;
  lastActivityAt?: string;
}

export interface TenantProfileStats {
  profileCompleteness: number;
  missingFields: string[];
  recommendations: Array<{
    field: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    impact: string;
  }>;
  activityScore: number;
  engagementMetrics: {
    profileViews: number;
    contactFormSubmissions: number;
    reviewCount: number;
    averageRating: number;
  };
}

/**
 * Tenant Profile Singleton - Producer Pattern
 * 
 * Produces and manages tenant profile data and analytics
 */
class TenantProfileSingleton extends UniversalSingleton {
  private static instance: TenantProfileSingleton;
  private profileCache: Map<string, TenantProfile> = new Map();
  private updateQueue: Array<{
    tenantId: string;
    updates: TenantProfileUpdate;
    timestamp: string;
  }> = [];
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    this.initializeProfileManagement();
  }

  static getInstance(): TenantProfileSingleton {
    if (!TenantProfileSingleton.instance) {
      TenantProfileSingleton.instance = new TenantProfileSingleton('tenant-profile-singleton');
    }
    return TenantProfileSingleton.instance;
  }

  // ====================
  // TENANT PROFILE MANAGEMENT
  // ====================

  private initializeProfileManagement(): void {
    // Start update processing
    this.updateInterval = setInterval(() => {
      this.processUpdateQueue();
    }, 10000); // Process every 10 seconds
  }

  /**
   * Get tenant profile
   */
  async getTenantProfile(tenantId: string): Promise<TenantProfile | null> {
    const cacheKey = `tenant-profile-${tenantId}`;
    
    // Check local cache first
    const localCached = this.profileCache.get(tenantId);
    if (localCached) {
      return localCached;
    }

    // Check persistent cache
    const cached = await this.getFromCache<TenantProfile>(cacheKey);
    if (cached) {
      this.profileCache.set(tenantId, cached);
      return cached;
    }

    try {
      const response = await fetch(`/api/tenants/${tenantId}/profile`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch tenant profile');
      }

      const profile = await response.json();
      
      // Update caches
      this.profileCache.set(tenantId, profile);
      await this.setCache(cacheKey, profile);

      return profile;
    } catch (error) {
      console.error('Error fetching tenant profile:', error);
      return null;
    }
  }

  /**
   * Create tenant profile
   */
  async createTenantProfile(
    tenantId: string,
    profile: Omit<TenantProfile, 'id' | 'createdAt' | 'updatedAt' | 'lastActivityAt'>
  ): Promise<TenantProfile> {
    try {
      const newProfile: TenantProfile = {
        ...profile,
        id: tenantId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      };

      const response = await fetch(`/api/tenants/${tenantId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile)
      });

      if (!response.ok) {
        throw new Error('Failed to create tenant profile');
      }

      const createdProfile = await response.json();
      
      // Update caches
      this.profileCache.set(tenantId, createdProfile);
      await this.setCache(`tenant-profile-${tenantId}`, createdProfile);

      return createdProfile;
    } catch (error) {
      console.error('Error creating tenant profile:', error);
      throw error;
    }
  }

  /**
   * Update tenant profile
   */
  async updateTenantProfile(
    tenantId: string,
    updates: TenantProfileUpdate
  ): Promise<TenantProfile> {
    try {
      // Add to update queue for batch processing
      this.updateQueue.push({
        tenantId,
        updates,
        timestamp: new Date().toISOString()
      });

      // Process immediately for critical updates
      const criticalUpdates = ['name', 'slug', 'settings'];
      const hasCriticalUpdate = Object.keys(updates).some(key => criticalUpdates.includes(key));
      
      if (hasCriticalUpdate) {
        await this.processProfileUpdate(tenantId, updates);
      }

      // Get updated profile
      const updatedProfile = await this.getTenantProfile(tenantId);
      if (!updatedProfile) {
        throw new Error('Failed to retrieve updated profile');
      }

      return updatedProfile;
    } catch (error) {
      console.error('Error updating tenant profile:', error);
      throw error;
    }
  }

  /**
   * Process profile update
   */
  private async processProfileUpdate(tenantId: string, updates: TenantProfileUpdate): Promise<void> {
    try {
      const response = await fetch(`/api/tenants/${tenantId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updates,
          updatedAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update tenant profile');
      }

      // Clear cache to force refresh
      this.profileCache.delete(tenantId);
      await this.clearCache(`tenant-profile-${tenantId}`);
    } catch (error) {
      console.error('Error processing profile update:', error);
      throw error;
    }
  }

  /**
   * Process update queue
   */
  private async processUpdateQueue(): Promise<void> {
    if (this.updateQueue.length === 0) return;

    const updates = [...this.updateQueue];
    this.updateQueue = [];

    // Group updates by tenant
    const groupedUpdates = updates.reduce((acc, update) => {
      if (!acc[update.tenantId]) {
        acc[update.tenantId] = [];
      }
      acc[update.tenantId].push(update);
      return acc;
    }, {} as Record<string, typeof updates>);

    // Process updates for each tenant
    for (const [tenantId, tenantUpdates] of Object.entries(groupedUpdates)) {
      try {
        // Merge all updates for this tenant
        const mergedUpdates = tenantUpdates.reduce((acc, update) => {
          return { ...acc, ...update.updates };
        }, {} as TenantProfileUpdate);

        await this.processProfileUpdate(tenantId, mergedUpdates);
      } catch (error) {
        console.error(`Error processing updates for tenant ${tenantId}:`, error);
      }
    }
  }

  // ====================
  // TENANT PROFILE ANALYTICS
  // ====================

  /**
   * Get tenant profile statistics
   */
  async getTenantProfileStats(tenantId: string): Promise<TenantProfileStats> {
    const cacheKey = `tenant-profile-stats-${tenantId}`;
    
    const cached = await this.getFromCache<TenantProfileStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/tenants/${tenantId}/profile/stats`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tenant profile stats');
      }

      const stats = await response.json();
      
      await this.setCache(cacheKey, stats);
      return stats;
    } catch (error) {
      console.error('Error fetching tenant profile stats:', error);
      
      // Return default stats
      return {
        profileCompleteness: 0,
        missingFields: [],
        recommendations: [],
        activityScore: 0,
        engagementMetrics: {
          profileViews: 0,
          contactFormSubmissions: 0,
          reviewCount: 0,
          averageRating: 0
        }
      };
    }
  }

  /**
   * Update tenant analytics
   */
  async updateTenantAnalytics(
    tenantId: string,
    analytics: Partial<TenantProfile['analytics']>
  ): Promise<void> {
    try {
      const response = await fetch(`/api/tenants/${tenantId}/analytics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...analytics,
          lastActivityAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update tenant analytics');
      }

      // Clear cache
      await this.clearCache(`tenant-profile-${tenantId}`);
      this.profileCache.delete(tenantId);
    } catch (error) {
      console.error('Error updating tenant analytics:', error);
      throw error;
    }
  }

  /**
   * Record tenant activity
   */
  async recordTenantActivity(
    tenantId: string,
    activity: {
      type: string;
      description: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const response = await fetch(`/api/tenants/${tenantId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...activity,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to record tenant activity');
      }

      // Update last activity
      await this.updateTenantProfile(tenantId, {
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error recording tenant activity:', error);
      throw error;
    }
  }

  // ====================
  // TENANT PROFILE UTILITIES
  // ====================

  /**
   * Get multiple tenant profiles
   */
  async getMultipleTenantProfiles(tenantIds: string[]): Promise<Map<string, TenantProfile>> {
    const profiles = new Map<string, TenantProfile>();
    
    // Fetch profiles in parallel
    const promises = tenantIds.map(async (tenantId) => {
      try {
        const profile = await this.getTenantProfile(tenantId);
        if (profile) {
          profiles.set(tenantId, profile);
        }
      } catch (error) {
        console.error(`Failed to fetch profile for tenant ${tenantId}:`, error);
      }
    });

    await Promise.all(promises);
    return profiles;
  }

  /**
   * Search tenant profiles
   */
  async searchTenantProfiles(
    query: string,
    filters: {
      category?: string;
      size?: string;
      location?: string;
      plan?: string;
    } = {},
    limit: number = 20
  ): Promise<TenantProfile[]> {
    const cacheKey = `tenant-profile-search-${JSON.stringify({ query, filters, limit })}`;
    
    const cached = await this.getFromCache<TenantProfile[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      params.append('q', query);
      if (filters.category) params.append('category', filters.category);
      if (filters.size) params.append('size', filters.size);
      if (filters.location) params.append('location', filters.location);
      if (filters.plan) params.append('plan', filters.plan);
      params.append('limit', limit.toString());

      const response = await fetch(`/api/tenants/search?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to search tenant profiles');
      }

      const profiles = await response.json();
      
      await this.setCache(cacheKey, profiles);
      return profiles;
    } catch (error) {
      console.error('Error searching tenant profiles:', error);
      return [];
    }
  }

  /**
   * Get featured tenant profiles
   */
  async getFeaturedTenantProfiles(limit: number = 10): Promise<TenantProfile[]> {
    const cacheKey = `featured-tenant-profiles-${limit}`;
    
    const cached = await this.getFromCache<TenantProfile[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/tenants/featured?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch featured tenant profiles');
      }

      const profiles = await response.json();
      
      await this.setCache(cacheKey, profiles);
      return profiles;
    } catch (error) {
      console.error('Error fetching featured tenant profiles:', error);
      return [];
    }
  }

  // ====================
  // TENANT PROFILE SPECIFIC METRICS
  // ====================

  protected getCustomMetrics(): Record<string, any> {
    return {
      cachedProfiles: this.profileCache.size,
      updateQueueSize: this.updateQueue.length,
      updateProcessingActive: !!this.updateInterval,
      lastUpdateProcess: new Date().toISOString(),
      profilesCreated: 0,
      profilesUpdated: 0
    };
  }

  // ====================
  // CLEANUP
  // ====================

  /**
   * Cleanup tenant profile resources
   */
  async cleanup(): Promise<void> {
    // Process remaining updates
    await this.processUpdateQueue();
    
    // Clear update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Clear caches
    this.profileCache.clear();
    await this.clearCache();
  }
}

// Export singleton instance
export const tenantProfileSingleton = TenantProfileSingleton.getInstance();

export default TenantProfileSingleton;
