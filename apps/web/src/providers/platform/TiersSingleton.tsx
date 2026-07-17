/**
 * Tiers Singleton - Producer Pattern
 * 
 * Produces and manages tier data with AuthenticatedApiSingleton integration
 * Extends AuthenticatedApiSingleton for consistent caching and metrics
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import { SingletonCacheOptions } from '@/providers/base/FlexibleApiSingleton';
import { clientLogger } from '@/lib/client-logger';

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

class TiersSingleton extends TenantApiSingleton {
  private static instance: TiersSingleton;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tiers-singleton*',
      'tier-system*',
      'tier-upgrades*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tiers-singleton*');
    await this.invalidateCachePattern('tier-system*');
    await this.invalidateCachePattern('tier-upgrades*');
  }

  constructor() {
    super('tiers-singleton');
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes for tier data (changes rarely)
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
    const result = await this.makeDefaultRequest<{ tier: Tier }>(
      `/api/tiers-singleton/${tierId}`,
      {},
      `tier-${tierId}`
    );
    
    if (!result.success) {
      if (result.status === 404) {
        return null;
      }
      clientLogger.error('Error fetching tier', { detail: result.error });
      return null;
    }
    
    return result.data?.tier || null;
  }

  /**
   * Get tier by slug
   */
  async getTierBySlug(slug: string): Promise<Tier | null> {
    const result = await this.makeDefaultRequest<{ tier: Tier }>(
      `/api/tiers-singleton/slug/${slug}`,
      {},
      `tier-slug-${slug}`
    );
    
    if (!result.success) {
      if (result.status === 404) {
        return null;
      }
      clientLogger.error('Error fetching tier by slug', { detail: result.error });
      return null;
    }
    
    return result.data?.tier || null;
  }

  /**
   * Create new tier
   */
  async createTier(request: CreateTierRequest): Promise<Tier> {
    const result = await this.makeDefaultRequest<{ tier: Tier }>(
      '/api/tiers-singleton',
      {
        method: 'POST',
        body: JSON.stringify(request)
      },
      'tier-create'
    );
    
    if (!result.success) {
      clientLogger.error('Error creating tier', { detail: result.error });
      throw new Error(getErrorMessage(result.error) || 'Failed to create tier');
    }

    console.log('Tier created successfully', { tierId: result.data?.tier.id });
    return result.data?.tier || (() => { 
      throw new Error('No tier data received'); 
    })();
  }

  /**
   * Update tier
   */
  async updateTier(tierId: string, updates: UpdateTierRequest): Promise<Tier> {
    const result = await this.makeDefaultRequest<{ tier: Tier }>(
      `/api/tiers-singleton/${tierId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates)
      },
      `tier-update-${tierId}`
    );
    
    if (!result.success) {
      clientLogger.error('Error updating tier', { detail: result.error });
      throw new Error(getErrorMessage(result.error) || 'Failed to update tier');
    }

    console.log('Tier updated successfully', { tierId });
    return result.data?.tier || (() => { 
      throw new Error('No tier data received'); 
    })();
  }

  /**
   * Delete tier
   */
  async deleteTier(tierId: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/tiers-singleton/${tierId}`,
      {
        method: 'DELETE'
      },
      `tier-delete-${tierId}`
    );
    
    if (!result.success) {
      clientLogger.error('Error deleting tier', { detail: result.error });
      throw new Error(getErrorMessage(result.error) || 'Failed to delete tier');
    }

    console.log('Tier deleted successfully', { tierId });
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
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.level) params.append('level', filters.level.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const cacheKey = `tiers-list-${params.toString()}`;

      const result = await this.makeDefaultRequest<{ tiers: Tier[] }>(
        `/api/tiers-singleton?${params}`,
        {},
        cacheKey
      );
      
      if (!result.success) {
        clientLogger.error('Error listing tiers', { detail: result.error });
        return [];
      }

      return result.data?.tiers || [];
    } catch (error) {
      clientLogger.error('Error listing tiers', { detail: error });
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
    const result = await this.makeDefaultRequest<{ stats: TierStats }>(
      '/api/tiers-singleton/stats',
      {},
      'tier-stats'
    );
    
    if (!result.success) {
      clientLogger.error('Error fetching tier stats', { detail: result.error });
      throw new Error(getErrorMessage(result.error) || 'Failed to fetch tier stats');
    }

    return result.data?.stats || (() => { 
      throw new Error('No tier stats data received'); 
    })();
  }

  /**
   * Check if tenant can upgrade to tier
   */
  async canUpgradeToTier(tenantId: string, targetTierId: string): Promise<UpgradeEligibility> {
    const result = await this.makeDefaultRequest<UpgradeEligibility>(
      `/api/tiers-singleton/${targetTierId}/can-upgrade/${tenantId}`,
      {},
      `upgrade-check-${tenantId}-${targetTierId}`
    );
    
    if (!result.success) {
      clientLogger.error('Error checking upgrade eligibility', { detail: result.error });
      throw new Error(getErrorMessage(result.error) || 'Failed to check upgrade eligibility');
    }

    return result.data || (() => { 
      throw new Error('No upgrade eligibility data received'); 
    })();
  }

  // ====================
  // TIER UTILITIES
  // ====================

  /**
   * Get tier limits
   */
  async getTierLimits(tierId: string): Promise<Tier['limits'] | null> {
    const result = await this.makeDefaultRequest<{ limits: Tier['limits'] }>(
      `/api/tiers-singleton/${tierId}/limits`,
      {},
      `tier-limits-${tierId}`
    );
    
    if (!result.success) {
      if (result.status === 404) {
        return null;
      }
      clientLogger.error('Error fetching tier limits', { detail: result.error });
      return null;
    }

    return result.data?.limits || null;
  }

  /**
   * Check if tier has feature
   */
  async hasFeature(tierId: string, feature: keyof Tier['features']): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ hasFeature: boolean }>(
      `/api/tiers-singleton/${tierId}/has-feature/${feature}`,
      {},
      `tier-feature-${tierId}-${feature}`
    );
    
    if (!result.success) {
      clientLogger.error('Error checking tier feature', { detail: result.error });
      return false;
    }

    return result.data?.hasFeature || false;
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
      clientLogger.error('Error getting upgrade path', { detail: error });
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
      clientLogger.error('Error calculating upgrade cost', { detail: error });
      throw error;
    }
  }

  // ====================
  // PRIVATE METHODS
  // ====================

}

export default TiersSingleton;
