/**
 * Tier Singleton Service - API Server Singleton
 * 
 * Manages subscription tiers, limits, and pricing
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';

// Tier Types
export interface Tier {
  id: string;
  name: string;
  slug: string;
  description: string;
  level: number; // 1 = basic, 2 = professional, 3 = enterprise, etc.
  price: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  limits: {
    products: number;
    locations: number;
    users: number;
    storage: number; // MB
    apiCalls: number; // per month
    features: string[];
  };
  features: {
    basicAnalytics: boolean;
    advancedAnalytics: boolean;
    customBranding: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    bulkOperations: boolean;
    customIntegrations: boolean;
    whiteLabel: boolean;
  };
  status: 'active' | 'inactive' | 'deprecated';
  createdAt: string;
  updatedAt: string;
  metadata: {
    displayOrder?: number;
    badgeColor?: string;
    recommendedFor?: string[];
    upgradeFrom?: string[];
  };
}

export interface TierStats {
  totalTiers: number;
  activeTiers: number;
  tiersByLevel: Record<number, number>;
  totalSubscriptions: number;
  subscriptionsByTier: Record<string, number>;
  revenue: {
    monthly: number;
    yearly: number;
    total: number;
  };
  upgradeRequests: number;
  popularTiers: Array<{
    tierId: string;
    tierName: string;
    subscriptionCount: number;
    revenue: number;
  }>;
}

export interface CreateTierRequest {
  name: string;
  slug: string;
  description: string;
  level: number;
  price: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  limits: Tier['limits'];
  features: Tier['features'];
  metadata?: Tier['metadata'];
}

export interface UpdateTierRequest {
  name?: string;
  description?: string;
  price?: {
    monthly?: number;
    yearly?: number;
  };
  limits?: Partial<Tier['limits']>;
  features?: Partial<Tier['features']>;
  status?: Tier['status'];
  metadata?: Partial<Tier['metadata']>;
}

class TierSingletonService extends UniversalSingleton {
  private static instance: TierSingletonService;
  private tierCache: Map<string, Tier> = new Map();

  constructor() {
    super('tier-service', {
      enableCache: true,
      enableEncryption: false,
      enablePrivateCache: true,
      authenticationLevel: 'authenticated',
      defaultTTL: 7200, // 2 hours
      maxCacheSize: 100,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize with mock data for testing
    this.initializeMockData();
  }

  static getInstance(): TierSingletonService {
    if (!TierSingletonService.instance) {
      TierSingletonService.instance = new TierSingletonService();
    }
    return TierSingletonService.instance;
  }

  // ====================
  // TIER MANAGEMENT
  // ====================

  /**
   * Get tier by ID
   */
  async getTier(tierId: string): Promise<Tier | null> {
    // Check local cache first
    const localCached = this.tierCache.get(tierId);
    if (localCached) {
      return localCached;
    }

    // Check persistent cache
    const cacheKey = `tier-${tierId}`;
    const cached = await this.getFromCache<Tier>(cacheKey);
    if (cached) {
      this.tierCache.set(tierId, cached);
      return cached;
    }

    try {
      // Query database for tier
      const tier = await this.queryTier(tierId);
      
      if (tier) {
        // Update caches
        this.tierCache.set(tierId, tier);
        await this.setCache(cacheKey, tier);
        return tier;
      }

      return null;
    } catch (error) {
      this.logError('Error fetching tier', error);
      return null;
    }
  }

  /**
   * Get tier by slug
   */
  async getTierBySlug(slug: string): Promise<Tier | null> {
    try {
      const tiers = await this.listTiers();
      return tiers.find(tier => tier.slug === slug) || null;
    } catch (error) {
      this.logError('Error fetching tier by slug', error);
      return null;
    }
  }

  /**
   * Create new tier
   */
  async createTier(request: CreateTierRequest): Promise<Tier> {
    const newTier: Tier = {
      id: this.generateId(),
      name: request.name,
      slug: request.slug,
      description: request.description,
      level: request.level,
      price: request.price,
      limits: request.limits,
      features: request.features,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: request.metadata || {}
    };

    try {
      // Store in database
      await this.storeTier(newTier);
      
      // Update caches
      this.tierCache.set(newTier.id, newTier);
      const cacheKey = `tier-${newTier.id}`;
      await this.setCache(cacheKey, newTier);

      this.logInfo('Tier created successfully', { tierId: newTier.id, name: newTier.name });
      
      return newTier;
    } catch (error) {
      this.logError('Error creating tier', error);
      throw new Error('Failed to create tier');
    }
  }

  /**
   * Update tier
   */
  async updateTier(tierId: string, updates: UpdateTierRequest): Promise<Tier> {
    const existingTier = await this.getTier(tierId);
    if (!existingTier) {
      throw new Error('Tier not found');
    }

    const updatedTier: Tier = {
      ...existingTier,
      ...updates,
      price: updates.price ? {
        ...existingTier.price,
        ...updates.price
      } : existingTier.price,
      limits: updates.limits ? {
        ...existingTier.limits,
        ...updates.limits
      } : existingTier.limits,
      features: updates.features ? {
        ...existingTier.features,
        ...updates.features
      } : existingTier.features,
      updatedAt: new Date().toISOString()
    };

    try {
      // Update in database
      await this.updateTierInDatabase(tierId, updates);
      
      // Update caches
      this.tierCache.set(tierId, updatedTier);
      const cacheKey = `tier-${tierId}`;
      await this.setCache(cacheKey, updatedTier);

      this.logInfo('Tier updated successfully', { tierId, updates });
      
      return updatedTier;
    } catch (error) {
      this.logError('Error updating tier', error);
      throw new Error('Failed to update tier');
    }
  }

  /**
   * Delete tier
   */
  async deleteTier(tierId: string): Promise<void> {
    const tier = await this.getTier(tierId);
    if (!tier) {
      throw new Error('Tier not found');
    }

    // Prevent deletion of tiers with active subscriptions
    const subscriptionCount = await this.getTierSubscriptionCount(tierId);
    if (subscriptionCount > 0) {
      throw new Error('Cannot delete tier with active subscriptions');
    }

    try {
      // Delete from database
      await this.deleteTierFromDatabase(tierId);
      
      // Clear caches
      this.tierCache.delete(tierId);
      const cacheKey = `tier-${tierId}`;
      await this.clearCache(cacheKey);

      this.logInfo('Tier deleted successfully', { tierId });
    } catch (error) {
      this.logError('Error deleting tier', error);
      throw new Error('Failed to delete tier');
    }
  }

  /**
   * List all tiers
   */
  async listTiers(filters: {
    status?: Tier['status'];
    level?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<Tier[]> {
    try {
      const tiers = await this.queryTiers(filters);
      
      // Sort by level and display order
      return tiers.sort((a, b) => {
        if (a.level !== b.level) {
          return a.level - b.level;
        }
        return (a.metadata.displayOrder || 0) - (b.metadata.displayOrder || 0);
      });
    } catch (error) {
      this.logError('Error listing tiers', error);
      return [];
    }
  }

  // ====================
  // TIER ANALYTICS
  // ====================

  /**
   * Get tier statistics
   */
  async getTierStats(): Promise<TierStats> {
    try {
      const cacheKey = 'tier-stats';
      const cached = await this.getFromCache<TierStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const stats = await this.calculateTierStats();
      
      // Cache for 30 minutes
      await this.setCache(cacheKey, stats, { ttl: 1800 });
      
      return stats;
    } catch (error) {
      this.logError('Error fetching tier stats', error);
      throw new Error('Failed to fetch tier statistics');
    }
  }

  /**
   * Check if tenant can upgrade to a tier
   */
  async canUpgradeToTier(tenantId: string, targetTierId: string): Promise<{
    canUpgrade: boolean;
    reason?: string;
    currentTier?: Tier;
    targetTier?: Tier;
  }> {
    try {
      // Get current tenant tier (mock implementation)
      const currentTier = await this.getTenantCurrentTier(tenantId);
      const targetTier = await this.getTier(targetTierId);
      
      if (!targetTier) {
        return { canUpgrade: false, reason: 'Target tier not found' };
      }

      if (!currentTier) {
        return { canUpgrade: true, targetTier };
      }

      // Check if target tier is higher level
      if (targetTier.level <= currentTier.level) {
        return { 
          canUpgrade: false, 
          reason: 'Target tier must be higher than current tier',
          currentTier,
          targetTier
        };
      }

      // Check upgrade path
      const upgradePath = currentTier.metadata.upgradeFrom || [];
      if (upgradePath.length > 0 && !upgradePath.includes(currentTier.id)) {
        return {
          canUpgrade: false,
          reason: 'Invalid upgrade path',
          currentTier,
          targetTier
        };
      }

      return { canUpgrade: true, currentTier, targetTier };
    } catch (error) {
      this.logError('Error checking upgrade eligibility', error);
      return { canUpgrade: false, reason: 'Error checking eligibility' };
    }
  }

  // ====================
  // UTILITY METHODS
  // ====================

  /**
   * Get tier limits for validation
   */
  async getTierLimits(tierId: string): Promise<Tier['limits'] | null> {
    const tier = await this.getTier(tierId);
    return tier?.limits || null;
  }

  /**
   * Check if tier has specific feature
   */
  async hasFeature(tierId: string, feature: keyof Tier['features']): Promise<boolean> {
    const tier = await this.getTier(tierId);
    return tier?.features[feature] || false;
  }

  // ====================
  // MOCK DATA IMPLEMENTATION
  // ====================

  private initializeMockData(): void {
    // Create mock tiers for testing
    const mockTiers: Tier[] = [
      {
        id: 'tier-basic-001',
        name: 'Basic',
        slug: 'basic',
        description: 'Perfect for small businesses just getting started',
        level: 1,
        price: {
          monthly: 29,
          yearly: 290,
          currency: 'USD'
        },
        limits: {
          products: 100,
          locations: 1,
          users: 3,
          storage: 1000,
          apiCalls: 10000,
          features: ['basic-listing', 'basic-analytics']
        },
        features: {
          basicAnalytics: true,
          advancedAnalytics: false,
          customBranding: false,
          prioritySupport: false,
          apiAccess: false,
          bulkOperations: false,
          customIntegrations: false,
          whiteLabel: false
        },
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
        metadata: {
          displayOrder: 1,
          badgeColor: 'green',
          recommendedFor: ['small-business', 'startup']
        }
      },
      {
        id: 'tier-professional-001',
        name: 'Professional',
        slug: 'professional',
        description: 'Ideal for growing businesses with multiple locations',
        level: 2,
        price: {
          monthly: 99,
          yearly: 990,
          currency: 'USD'
        },
        limits: {
          products: 1000,
          locations: 5,
          users: 10,
          storage: 5000,
          apiCalls: 50000,
          features: ['advanced-listing', 'advanced-analytics', 'custom-branding']
        },
        features: {
          basicAnalytics: true,
          advancedAnalytics: true,
          customBranding: true,
          prioritySupport: false,
          apiAccess: true,
          bulkOperations: true,
          customIntegrations: false,
          whiteLabel: false
        },
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
        metadata: {
          displayOrder: 2,
          badgeColor: 'blue',
          recommendedFor: ['growing-business', 'multi-location'],
          upgradeFrom: ['tier-basic-001']
        }
      },
      {
        id: 'tier-enterprise-001',
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Complete solution for large organizations',
        level: 3,
        price: {
          monthly: 299,
          yearly: 2990,
          currency: 'USD'
        },
        limits: {
          products: 10000,
          locations: 50,
          users: 100,
          storage: 50000,
          apiCalls: 500000,
          features: ['all-features', 'priority-support', 'white-label']
        },
        features: {
          basicAnalytics: true,
          advancedAnalytics: true,
          customBranding: true,
          prioritySupport: true,
          apiAccess: true,
          bulkOperations: true,
          customIntegrations: true,
          whiteLabel: true
        },
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString(),
        metadata: {
          displayOrder: 3,
          badgeColor: 'purple',
          recommendedFor: ['enterprise', 'large-organization'],
          upgradeFrom: ['tier-professional-001']
        }
      }
    ];

    // Cache mock tiers
    mockTiers.forEach(tier => {
      this.tierCache.set(tier.id, tier);
    });
  }

  // ====================
  // DATABASE STUBS
  // ====================

  private async queryTier(tierId: string): Promise<Tier | null> {
    console.log('Querying tier:', tierId);
    return this.tierCache.get(tierId) || null;
  }

  private async storeTier(tier: Tier): Promise<void> {
    console.log('Storing tier:', tier.id);
    this.tierCache.set(tier.id, tier);
  }

  private async updateTierInDatabase(tierId: string, updates: UpdateTierRequest): Promise<void> {
    console.log('Updating tier in database:', tierId, updates);
  }

  private async deleteTierFromDatabase(tierId: string): Promise<void> {
    console.log('Deleting tier from database:', tierId);
  }

  private async queryTiers(filters: any): Promise<Tier[]> {
    console.log('Querying tiers with filters:', filters);
    return Array.from(this.tierCache.values());
  }

  private async getTierSubscriptionCount(tierId: string): Promise<number> {
    console.log('Getting subscription count for tier:', tierId);
    // Mock implementation - return 0 for testing
    return 0;
  }

  private async calculateTierStats(): Promise<TierStats> {
    const tiers = Array.from(this.tierCache.values());
    
    const stats: TierStats = {
      totalTiers: tiers.length,
      activeTiers: tiers.filter(t => t.status === 'active').length,
      tiersByLevel: tiers.reduce((acc, tier) => {
        acc[tier.level] = (acc[tier.level] || 0) + 1;
        return acc;
      }, {} as Record<number, number>),
      totalSubscriptions: 150, // Mock data
      subscriptionsByTier: tiers.reduce((acc, tier) => {
        acc[tier.id] = Math.floor(Math.random() * 50) + 10; // Mock subscription counts
        return acc;
      }, {} as Record<string, number>),
      revenue: {
        monthly: 15000, // Mock data
        yearly: 150000,
        total: 165000
      },
      upgradeRequests: 25, // Mock data
      popularTiers: tiers.map(tier => ({
        tierId: tier.id,
        tierName: tier.name,
        subscriptionCount: Math.floor(Math.random() * 50) + 10,
        revenue: tier.price.monthly * (Math.floor(Math.random() * 50) + 10)
      }))
    };

    return stats;
  }

  private async getTenantCurrentTier(tenantId: string): Promise<Tier | null> {
    // Mock implementation - return professional tier for test tenant
    if (tenantId === 'tid-m8ijkrnk') {
      return this.tierCache.get('tier-professional-001') || null;
    }
    return this.tierCache.get('tier-basic-001') || null;
  }
}

export default TierSingletonService;
