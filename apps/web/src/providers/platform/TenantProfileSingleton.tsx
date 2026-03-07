/**
 * Tenant Profile Singleton - Producer Pattern
 * 
 * Produces and manages tenant profile data
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import { SingletonCacheOptions } from '@/providers/base/FlexibleApiSingleton';

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
class TenantProfileSingleton extends TenantApiSingleton {
  private static instance: TenantProfileSingleton;
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
    const result = await this.makeDefaultRequest<TenantProfile>(`/api/tenants/${tenantId}/profile`, {}, `tenant-profile-${tenantId}`);
    
    if (!result.success) {
      if (result.status === 404) {
        return null;
      }
      console.error('Error fetching tenant profile:', result.error);
      return null;
    }
    
    const profile = result.data;
    
    if (!profile) {
      return null;
    }

    return profile;
  }

  /**
   * Create tenant profile
   */
  async createTenantProfile(
    tenantId: string,
    profile: Omit<TenantProfile, 'id' | 'createdAt' | 'updatedAt' | 'lastActivityAt'>
  ): Promise<TenantProfile> {
    const newProfile: TenantProfile = {
      ...profile,
      id: tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    const result = await this.makeDefaultRequest<TenantProfile>(`/api/tenants/${tenantId}/profile`, {
      method: 'POST',
      body: JSON.stringify(newProfile)
    }, `create-tenant-profile-${tenantId}`);
    
    if (!result.success) {
      console.error('Error creating tenant profile:', result.error);
      throw new Error(getErrorMessage(result.error) || 'Failed to create tenant profile');
    }
    
    const createdProfile = result.data;
    
    if (!createdProfile) {
      throw new Error('No profile data received from server');
    }

    return createdProfile;
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
    const result = await this.makeDefaultRequest(`/api/tenants/${tenantId}/profile`, {
      method: 'PUT',
      body: JSON.stringify({
        ...updates,
        updatedAt: new Date().toISOString()
      })
    }, `update-tenant-profile-${tenantId}`);
    
    if (!result.success) {
      console.error('Error processing profile update:', result.error);
      throw new Error(getErrorMessage(result.error) || 'Failed to process profile update');
    }

    // Invalidate cache to force refresh
    await this.invalidateCache(`tenant-profile-${tenantId}`);
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
    const result = await this.makeDefaultRequest<TenantProfileStats>(`/api/tenants/${tenantId}/profile/stats`, {}, `tenant-profile-stats-${tenantId}`);
    
    if (!result.success) {
      console.error('Error fetching tenant profile stats:', result.error);
      
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
    
    return result.data || (() => { 
      throw new Error('No profile stats data received'); 
    })();
  }

  /**
   * Update tenant analytics
   */
  async updateTenantAnalytics(
    tenantId: string,
    analytics: Partial<TenantProfile['analytics']>
  ): Promise<void> {
    const result = await this.makeDefaultRequest(`/api/tenants/${tenantId}/analytics`, {
      method: 'PUT',
      body: JSON.stringify({
        ...analytics,
        lastActivityAt: new Date().toISOString()
      })
    }, `update-tenant-analytics-${tenantId}`);
    
    if (!result.success) {
      console.error('Error updating tenant analytics:', result.error);
      throw new Error(getErrorMessage(result.error) || 'Failed to update tenant analytics');
    }

    // Invalidate cache
    await this.invalidateCache(`tenant-profile-${tenantId}`);
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
    const result = await this.makeDefaultRequest(`/api/tenants/${tenantId}/activity`, {
      method: 'POST',
      body: JSON.stringify({
        ...activity,
        timestamp: new Date().toISOString()
      })
    }, `record-tenant-activity-${tenantId}`);
    
    if (!result.success) {
      console.error('Error recording tenant activity:', result.error);
      throw new Error(getErrorMessage(result.error) || 'Failed to record tenant activity');
    }

    // Update last activity - invalidate cache
    await this.invalidateCache(`tenant-profile-${tenantId}`);
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
    try {
      const params = new URLSearchParams();
      params.append('q', query);
      if (filters.category) params.append('category', filters.category);
      if (filters.size) params.append('size', filters.size);
      if (filters.location) params.append('location', filters.location);
      if (filters.plan) params.append('plan', filters.plan);
      params.append('limit', limit.toString());

      const result = await this.makeDefaultRequest<TenantProfile[]>(`/api/tenants/search?${params}`, {}, `tenant-profile-search-${JSON.stringify({ query, filters, limit })}`);
      
      if (!result.success) {
        console.error('Error searching tenant profiles:', result.error);
        return [];
      }
      
      return result.data || [];
    } catch (error) {
      console.error('Error searching tenant profiles:', error);
      return [];
    }
  }

  /**
   * Get featured tenant profiles
   */
  async getFeaturedTenantProfiles(limit: number = 10): Promise<TenantProfile[]> {
    const result = await this.makeDefaultRequest<TenantProfile[]>(`/api/tenants/featured?limit=${limit}`, {}, `featured-tenant-profiles-${limit}`);
    
    if (!result.success) {
      console.error('Error fetching featured tenant profiles:', result.error);
      return [];
    }
    
    return result.data || [];
  }

  // ====================
  // TENANT PROFILE SPECIFIC METRICS
  // ====================

  protected getCustomMetrics(): Record<string, any> {
    return {
      updateQueueSize: this.updateQueue.length,
      updateProcessingActive: !!this.updateInterval,
      lastUpdateProcess: new Date().toISOString()
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
    
    // Clear cache
    await this.clearCache();
  }
}

// Export singleton instance
export const tenantProfileSingleton = TenantProfileSingleton.getInstance();

export default TenantProfileSingleton;
