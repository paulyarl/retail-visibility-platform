/**
 * Tiers Singleton - Producer Pattern
 * 
 * Produces and manages tier data with UniversalSingleton integration
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

// Tier Types (matching server-side)
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

export interface UpgradeEligibility {
  canUpgrade: boolean;
  reason?: string;
  currentTier?: Tier;
  targetTier?: Tier;
}

class TiersSingleton extends UniversalSingleton {
  private static instance: TiersSingleton;

  constructor() {
    super('tiers-singleton', {
      encrypt: false,
      userId: undefined
    });
  }

  static getInstance(): TiersSingleton {
    if (!TiersSingleton.instance) {
      TiersSingleton.instance = new TiersSingleton();
    }
    return TiersSingleton.instance;
  }

  // ====================
  // TIER MANAGEMENT
  // ====================

  /**
   * Get tier by ID
   */
  async getTier(tierId: string): Promise<Tier | null> {
    const cacheKey = `tier-${tierId}`;
    
    // Check cache first
    const cached = await this.getFromCache<Tier>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/tiers-singleton/${tierId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch tier: ${response.statusText}`);
      }

      const result = await response.json();
      const tier = result.data.tier;

      // Cache the result
      await this.setCache(cacheKey, tier);
      
      return tier;
    } catch (error) {
      console.error('Error fetching tier', error);
      return null;
    }
  }

  /**
   * Get tier by slug
   */
  async getTierBySlug(slug: string): Promise<Tier | null> {
    const cacheKey = `tier-slug-${slug}`;
    
    // Check cache first
    const cached = await this.getFromCache<Tier>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/tiers-singleton/slug/${slug}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch tier by slug: ${response.statusText}`);
      }

      const result = await response.json();
      const tier = result.data.tier;

      // Cache the result
      await this.setCache(cacheKey, tier);
      
      return tier;
    } catch (error) {
      console.error('Error fetching tier by slug', error);
      return null;
    }
  }

  /**
   * Create new tier
   */
  async createTier(request: CreateTierRequest): Promise<Tier> {
    try {
      const response = await fetch('/api/tiers-singleton', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Failed to create tier: ${response.statusText}`);
      }

      const result = await response.json();
      const tier = result.data.tier;

      // Clear tier list cache
      await this.clearCache('tiers-list');

      console.log('Tier created successfully', { tierId: tier.id });
      
      return tier;
    } catch (error) {
      console.error('Error creating tier', error);
      throw error;
    }
  }

  /**
   * Update tier
   */
  async updateTier(tierId: string, updates: UpdateTierRequest): Promise<Tier> {
    try {
      const response = await fetch(`/api/tiers-singleton/${tierId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update tier: ${response.statusText}`);
      }

      const result = await response.json();
      const tier = result.data.tier;

      // Update cache
      const cacheKey = `tier-${tierId}`;
      await this.setCache(cacheKey, tier);

      // Clear tier list cache
      await this.clearCache('tiers-list');

      console.log('Tier updated successfully', { tierId });
      
      return tier;
    } catch (error) {
      console.error('Error updating tier', error);
      throw error;
    }
  }

  /**
   * Delete tier
   */
  async deleteTier(tierId: string): Promise<void> {
    try {
      const response = await fetch(`/api/tiers-singleton/${tierId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete tier: ${response.statusText}`);
      }

      // Clear caches
      const cacheKey = `tier-${tierId}`;
      await this.clearCache(cacheKey);
      await this.clearCache('tiers-list');

      console.log('Tier deleted successfully', { tierId });
    } catch (error) {
      console.error('Error deleting tier', error);
      throw error;
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
    const cacheKey = `tiers-list-${JSON.stringify(filters)}`;
    
    // Check cache first
    const cached = await this.getFromCache<Tier[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.level) params.append('level', filters.level.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await fetch(`/api/tiers-singleton?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to list tiers: ${response.statusText}`);
      }

      const result = await response.json();
      const tiers = result.data.tiers;

      // Cache the result
      await this.setCache(cacheKey, tiers);
      
      return tiers;
    } catch (error) {
      console.error('Error listing tiers', error);
      throw error;
    }
  }

  // ====================
  // TIER ANALYTICS
  // ====================

  /**
   * Get tier statistics
   */
  async getTierStats(): Promise<TierStats> {
    const cacheKey = 'tier-stats';
    
    // Check cache first
    const cached = await this.getFromCache<TierStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/api/tiers-singleton/stats', {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tier stats: ${response.statusText}`);
      }

      const result = await response.json();
      const stats = result.data.stats;

      // Cache the result
      await this.setCache(cacheKey, stats);
      
      return stats;
    } catch (error) {
      console.error('Error fetching tier stats', error);
      throw error;
    }
  }

  /**
   * Check if tenant can upgrade to tier
   */
  async canUpgradeToTier(tenantId: string, targetTierId: string): Promise<UpgradeEligibility> {
    const cacheKey = `upgrade-check-${tenantId}-${targetTierId}`;
    
    // Check cache first
    const cached = await this.getFromCache<UpgradeEligibility>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/tiers-singleton/${targetTierId}/can-upgrade/${tenantId}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to check upgrade eligibility: ${response.statusText}`);
      }

      const result = await response.json();
      const eligibility = result.data;

      // Cache the result
      await this.setCache(cacheKey, eligibility);
      
      return eligibility;
    } catch (error) {
      console.error('Error checking upgrade eligibility', error);
      throw error;
    }
  }

  // ====================
  // TIER UTILITIES
  // ====================

  /**
   * Get tier limits
   */
  async getTierLimits(tierId: string): Promise<Tier['limits'] | null> {
    const cacheKey = `tier-limits-${tierId}`;
    
    // Check cache first
    const cached = await this.getFromCache<Tier['limits']>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/tiers-singleton/${tierId}/limits`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch tier limits: ${response.statusText}`);
      }

      const result = await response.json();
      const limits = result.data.limits;

      // Cache the result
      await this.setCache(cacheKey, limits);
      
      return limits;
    } catch (error) {
      console.error('Error fetching tier limits', error);
      return null;
    }
  }

  /**
   * Check if tier has feature
   */
  async hasFeature(tierId: string, feature: keyof Tier['features']): Promise<boolean> {
    const cacheKey = `tier-feature-${tierId}-${feature}`;
    
    // Check cache first
    const cached = await this.getFromCache<boolean>(cacheKey);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    try {
      const response = await fetch(`/api/tiers-singleton/${tierId}/has-feature/${feature}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to check tier feature: ${response.statusText}`);
      }

      const result = await response.json();
      const hasFeature = result.data.hasFeature;

      // Cache the result
      await this.setCache(cacheKey, hasFeature);
      
      return hasFeature;
    } catch (error) {
      console.error('Error checking tier feature', error);
      return false;
    }
  }

  /**
   * Get upgrade path for current tier
   */
  async getUpgradePath(currentTierId: string): Promise<Tier[]> {
    try {
      const currentTier = await this.getTier(currentTierId);
      if (!currentTier) {
        return [];
      }

      const allTiers = await this.listTiers({ status: 'active' });
      
      // Filter for higher level tiers
      const upgradeOptions = allTiers
        .filter(tier => tier.level > currentTier.level)
        .sort((a, b) => a.level - b.level);

      return upgradeOptions;
    } catch (error) {
      console.error('Error getting upgrade path', error);
      return [];
    }
  }

  /**
   * Calculate upgrade cost
   */
  async calculateUpgradeCost(currentTierId: string, targetTierId: string, billingCycle: 'monthly' | 'yearly' = 'monthly'): Promise<{
    currentCost: number;
    newCost: number;
    difference: number;
    savings: number; // for yearly billing
  }> {
    try {
      const [currentTier, targetTier] = await Promise.all([
        this.getTier(currentTierId),
        this.getTier(targetTierId)
      ]);

      if (!currentTier || !targetTier) {
        throw new Error('Invalid tier IDs');
      }

      const currentCost = currentTier.price[billingCycle];
      const newCost = targetTier.price[billingCycle];
      const difference = newCost - currentCost;
      const savings = billingCycle === 'yearly' 
        ? (currentTier.price.monthly * 12 - currentTier.price.yearly)
        : 0;

      return {
        currentCost,
        newCost,
        difference,
        savings
      };
    } catch (error) {
      console.error('Error calculating upgrade cost', error);
      throw error;
    }
  }

  // ====================
  // PRIVATE METHODS
  // ====================

  private getAuthToken(): string {
    // This would get the auth token from cookies, localStorage, or context
    // For now, return empty string - this would be implemented based on auth system
    return '';
  }
}

export default TiersSingleton;
