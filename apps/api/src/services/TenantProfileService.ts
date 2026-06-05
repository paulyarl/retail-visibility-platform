/**
 * Tenant Profile Service - API Server Singleton
 * 
 * Manages tenant profile data, updates, and analytics
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';

// Tenant Profile Types
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
  settings?: Partial<Pick<TenantProfile['settings'], 'enablePublicProfile' | 'enableContactForm' | 'enableReviews' | 'enableAnalytics'>> & 
    Pick<TenantProfile['settings'], 'timezone' | 'language' | 'currency'>;
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
 * Tenant Profile Service - API Server Singleton
 * 
 * Manages tenant profile data and analytics
 */
class TenantProfileService extends UniversalSingleton {
  private static instance: TenantProfileService;
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

  static getInstance(): TenantProfileService {
    if (!TenantProfileService.instance) {
      TenantProfileService.instance = new TenantProfileService('tenant-profile-service');
    }
    return TenantProfileService.instance;
  }

  // ====================
  // INITIALIZATION
  // ====================

  private initializeProfileManagement(): void {
    // Start update processing
    this.updateInterval = setInterval(() => {
      this.processUpdateQueue();
    }, 10000); // Process every 10 seconds
  }

  // ====================
  // TENANT PROFILE MANAGEMENT
  // ====================

  /**
   * Get tenant profile
   */
  async getTenantProfile(tenantId: string): Promise<TenantProfile | null> {
    // Check local cache first
    const localCached = this.profileCache.get(tenantId);
    if (localCached) {
      return localCached;
    }

    // Check persistent cache
    const cacheKey = `tenant-profile-${tenantId}`;
    const cached = await this.getFromCache<TenantProfile>(cacheKey);
    if (cached) {
      this.profileCache.set(tenantId, cached);
      return cached;
    }

    try {
      // Query database for tenant profile
      const profile = await this.queryTenantProfile(tenantId);
      
      if (profile) {
        // Update caches
        this.profileCache.set(tenantId, profile);
        await this.setCache(cacheKey, profile);
        return profile;
      }

      return null;
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

      // Store in database
      await this.storeTenantProfile(newProfile);
      
      // Update caches
      this.profileCache.set(tenantId, newProfile);
      await this.setCache(`tenant-profile-${tenantId}`, newProfile);

      return newProfile;
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
      const updatedProfile = {
        ...updates,
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      };

      // Update in database
      await this.updateTenantProfileInDatabase(tenantId, updatedProfile as Partial<TenantProfile>);

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

  /**
   * Get tenant analytics
   */
  async getTenantAnalytics(tenantId: string): Promise<TenantProfile['analytics'] | null> {
    const profile = await this.getTenantProfile(tenantId);
    return profile?.analytics || null;
  }

  /**
   * Update tenant analytics
   */
  async updateTenantAnalytics(
    tenantId: string,
    analytics: Partial<TenantProfile['analytics']>
  ): Promise<void> {
    try {
      const updatedAnalytics = {
        ...analytics,
        lastActivityAt: new Date().toISOString()
      };

      // Update in database
      await this.updateTenantAnalyticsInDatabase(tenantId, updatedAnalytics);

      // Clear cache
      this.profileCache.delete(tenantId);
      await this.clearCache(`tenant-profile-${tenantId}`);
    } catch (error) {
      console.error('Error updating tenant analytics:', error);
      throw error;
    }
  }

  /**
   * Track tenant activity (alias for recordTenantActivity)
   */
  async trackActivity(
    tenantId: string,
    activity: {
      type: string;
      description: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    return this.recordTenantActivity(tenantId, activity);
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
      // Store activity in database
      await this.storeTenantActivity(tenantId, {
        ...activity,
        timestamp: new Date().toISOString()
      });

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
    try {
      // Query database for tenant profiles
      const profiles = await this.searchTenantProfilesInDatabase(query, filters, limit);
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
    try {
      // Query database for featured tenant profiles
      const profiles = await this.getFeaturedTenantProfilesInDatabase(limit);
      return profiles;
    } catch (error) {
      console.error('Error fetching featured tenant profiles:', error);
      return [];
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
      const stats = await this.calculateTenantProfileStats(tenantId);
      
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
   * Calculate tenant profile statistics
   */
  private async calculateTenantProfileStats(tenantId: string): Promise<TenantProfileStats> {
    const profile = await this.getTenantProfile(tenantId);
    if (!profile) {
      throw new Error('Tenant profile not found');
    }

    const completeness = this.calculateProfileCompleteness(profile);
    const missingFields = this.getMissingFields(profile);
    const recommendations = this.getProfileRecommendations(profile);
    const activityScore = await this.calculateActivityScore(tenantId);
    const engagementMetrics = await this.getEngagementMetrics(tenantId);

    return {
      profileCompleteness: completeness,
      missingFields,
      recommendations,
      activityScore,
      engagementMetrics
    };
  }

  /**
   * Calculate profile completeness percentage
   */
  private calculateProfileCompleteness(profile: TenantProfile): number {
    const requiredFields = [
      'name',
      'slug',
      'description',
      'contact.email',
      'business.category',
      'settings.timezone',
      'settings.language'
    ];

    const completedFields = requiredFields.filter(field => {
      const value = this.getNestedValue(profile, field);
      return value !== undefined && value !== null && value !== '';
    });

    return Math.round((completedFields.length / requiredFields.length) * 100);
  }

  /**
   * Get missing fields from profile
   */
  private getMissingFields(profile: TenantProfile): string[] {
    const requiredFields = [
      { name: 'name', path: 'name' },
      { name: 'slug', path: 'slug' },
      { name: 'description', path: 'description' },
      { name: 'email', path: 'contact.email' },
      { name: 'category', path: 'business.category' },
      { name: 'timezone', path: 'settings.timezone' },
      { name: 'language', path: 'settings.language' }
    ];

    return requiredFields
      .filter(field => {
        const value = this.getNestedValue(profile, field.path);
        return value === undefined || value === null || value === '';
      })
      .map(field => field.name);
  }

  /**
   * Get profile recommendations
   */
  private getProfileRecommendations(profile: TenantProfile): Array<{
    field: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    impact: string;
  }> {
    const recommendations: Array<{
    field: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    impact: string;
  }> = [];

    if (!profile.description) {
      recommendations.push({
        field: 'description',
        priority: 'high',
        description: 'Add a description to help customers understand your business',
        impact: 'Improves SEO and customer engagement'
      });
    }

    if (!profile.contact.email) {
      recommendations.push({
        field: 'contact.email',
        priority: 'high',
        description: 'Add contact email for customer communication',
        impact: 'Enables contact form submissions and support'
      });
    }

    if (!profile.business.category) {
      recommendations.push({
        field: 'business.category',
        priority: 'medium',
        description: 'Select a business category for better discoverability',
        impact: 'Improves search and directory placement'
      });
    }

    if (!profile.logo) {
      recommendations.push({
        field: 'logo',
        priority: 'medium',
        description: 'Upload a logo to enhance brand recognition',
        impact: 'Improves visual appeal and trust'
      });
    }

    return recommendations as Array<{
    field: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    impact: string;
  }>;
  }

  /**
   * Calculate activity score
   */
  private async calculateActivityScore(tenantId: string): Promise<number> {
    // This would calculate activity based on recent events, updates, etc.
    return 0;
  }

  /**
   * Get engagement metrics
   */
  private async getEngagementMetrics(tenantId: string): Promise<{
    profileViews: number;
    contactFormSubmissions: number;
    reviewCount: number;
    averageRating: number;
  }> {
    // This would query the database for engagement metrics
    return {
      profileViews: 0,
      contactFormSubmissions: 0,
      reviewCount: 0,
      averageRating: 0
    };
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  // ====================
  // DATABASE OPERATIONS
  // ====================

  private async queryTenantProfile(tenantId: string): Promise<TenantProfile | null> {
    // Mock implementation for testing - returns sample tenant profile data
    console.log('Querying tenant profile:', tenantId);
    
    // Return mock data for the test tenant
    if (tenantId === 'tid-m8ijkrnk') {
      return {
        id: tenantId,
        name: 'Test Tenant',
        slug: 'test-tenant',
        description: 'Test tenant for UniversalSingleton integration',
        contact: {
          email: 'test@rvp.com',
          phone: '+1-555-123-4567',
          website: 'https://test.rvp.com',
          address: {
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        },
        business: {
          category: 'retail',
          subcategory: 'electronics',
          size: 'small',
          industry: 'technology',
          foundedYear: 2020
        },
        branding: {
          primaryColor: '#007bff',
          secondaryColor: '#6c757d',
          accentColor: '#28a745',
          font: 'Inter',
          theme: 'light'
        },
        settings: {
          enablePublicProfile: true,
          enableContactForm: true,
          enableReviews: true,
          enableAnalytics: true,
          timezone: 'America/New_York',
          language: 'en',
          currency: 'USD'
        },
        subscription: {
          plan: 'professional',
          tier: 2,
          limits: {
            products: 1000,
            locations: 10,
            users: 50,
            storage: 5000
          },
          usage: {
            products: 250,
            locations: 3,
            users: 12,
            storage: 1200
          },
          status: 'active'
        },
        seo: {
          title: 'Test Tenant - Retail Visibility Platform',
          description: 'Test tenant for demonstrating UniversalSingleton integration',
          keywords: ['test', 'retail', 'visibility', 'platform'],
          ogImage: 'https://test.rvp.com/og-image.jpg',
          canonicalUrl: 'https://test.rvp.com'
        },
        social: {
          facebook: 'https://facebook.com/testtenant',
          twitter: 'https://twitter.com/testtenant',
          instagram: 'https://instagram.com/testtenant',
          linkedin: 'https://linkedin.com/company/testtenant'
        },
        integrations: {
          square: {
            enabled: true,
            connected: false
          },
          google: {
            enabled: true,
            connected: false
          },
          clover: {
            enabled: false,
            connected: false
          }
        },
        compliance: {
          gdprCompliant: true,
          ccpaCompliant: true,
          privacyPolicy: 'https://test.rvp.com/privacy',
          termsOfService: 'https://test.rvp.com/terms'
        },
        analytics: {
          pageViews: 1000,
          uniqueVisitors: 50,
          averageSessionDuration: 300,
          bounceRate: 0.25,
          conversionRate: 0.05,
          topPages: [
            {
              url: '/',
              views: 400,
              avgTimeOnPage: 180
            },
            {
              url: '/products',
              views: 300,
              avgTimeOnPage: 240
            },
            {
              url: '/about',
              views: 200,
              avgTimeOnPage: 120
            }
          ]
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString()
      };
    }
    
    return null;
  }

  private async storeTenantProfile(profile: TenantProfile): Promise<void> {
    // Store tenant profile in database
    console.log('Storing tenant profile:', profile.id);
  }

  private async updateTenantProfileInDatabase(tenantId: string, updates: Partial<TenantProfile>): Promise<void> {
    // Update tenant profile in database
    console.log('Updating tenant profile:', tenantId);
  }

  private async updateTenantAnalyticsInDatabase(tenantId: string, analytics: Partial<TenantProfile['analytics']>): Promise<void> {
    // Update tenant analytics in database
    console.log('Updating tenant analytics:', tenantId);
  }

  private async storeTenantActivity(tenantId: string, activity: {
    type: string;
    description: string;
    metadata?: Record<string, any>;
    timestamp: string;
  }): Promise<void> {
    // Store tenant activity in database
    console.log('Storing tenant activity:', tenantId);
  }

  private async searchTenantProfilesInDatabase(
    query: string,
    filters: Record<string, string>,
    limit: number
  ): Promise<TenantProfile[]> {
    // Search tenant profiles in database
    console.log('Searching tenant profiles:', query);
    return [];
  }

  private async getFeaturedTenantProfilesInDatabase(limit: number): Promise<TenantProfile[]> {
    // Get featured tenant profiles from database
    console.log('Getting featured tenant profiles');
    return [];
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
export const tenantProfileService = TenantProfileService.getInstance();

export default TenantProfileService;
