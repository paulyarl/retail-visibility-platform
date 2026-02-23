/**
 * Tier System Service
 * 
 * Extends AdminApiSingleton to provide tier system management
 * Handles tier CRUD, status management, and sorting operations with admin privileges
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface Tier {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  currency: string;
  billingInterval: 'monthly' | 'yearly';
  features: Record<string, any>;
  limits: {
    skus: number;
    locations: number;
    users: number;
    storage: number;
    bandwidth: number;
  };
  isActive: boolean;
  sortOrder: number;
  type: 'individual' | 'organization';
  createdAt: string;
  updatedAt: string;
}

/**
 * Service for managing tier system operations
 * Handles tier CRUD, status management, and sorting operations
 */
export class TierSystemService extends AdminApiSingleton {
  private static instance: TierSystemService;

  protected constructor() {
    super('tier-system-service', {
      ttl: 60 * 60 * 1000 // 1 hour for tier data (changes infrequently)
    });
  }

  static getInstance(): TierSystemService {
    if (!TierSystemService.instance) {
      TierSystemService.instance = new TierSystemService();
    }
    return TierSystemService.instance;
  }

  /**
   * Get tier system tiers
   */
  async getTierSystemTiers(): Promise<Tier[] | null> {
    const response = await this.makeDefaultRequest<{ 
      individual: Tier[];
      organization: Tier[];
    }>(
      '/api/admin/tiers/tiers',
      {},
      'tier-system-tiers',
      60 * 60 * 1000 // 1 hour cache
    );

    // Combine individual and organization tiers
    const allTiers = [
      ...(response?.data?.individual || []),
      ...(response?.data?.organization || [])
    ];

    return allTiers.length > 0 ? allTiers : null;
  }

  /**
   * Update tier active status
   */
  async updateTierStatus(tierId: string, isActive: boolean): Promise<Tier | null> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const response = await this.makeDefaultRequest<Tier>(
      `/api/admin/tiers/${tierId}/status`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: isActive })
      },
      `update-tier-status-${tierId}`,
      0 // No cache for admin operations
    );

    // Invalidate tier cache
    this.invalidateCache('tier-system-tiers');

    return response?.data || null;
  }

  /**
   * Update tier
   */
  async updateTier(tierId: string, tierData: Partial<Tier>): Promise<Tier | null> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const response = await this.makeDefaultRequest<Tier>(
      `/api/admin/tiers/${tierId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tierData)
      },
      `update-tier-${tierId}`,
      0 // No cache for admin operations
    );

    // Invalidate tier cache
    this.invalidateCache('tier-system-tiers');

    return response?.data || null;
  }

  /**
   * Update tier sort order
   */
  async updateTierSortOrder(tierId: string, sortOrder: number): Promise<void> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    await this.makeDefaultRequest<void>(
      `/api/admin/tiers/${tierId}/sort-order`,
      {
        method: 'PUT',
        body: JSON.stringify({ sortOrder }),
      },
      `tier-sort-${tierId}`,
      0
    );

    // Invalidate tier cache
    this.invalidateCache('tier-system-tiers');
  }

  /**
   * Create tier
   */
  async createTier(tierData: Omit<Tier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tier | null> {
    const response = await this.makeDefaultRequest<Tier>(
      `/api/admin/tiers`,
      {
        method: 'POST',
        body: JSON.stringify(tierData)
      },
      'tier-system-tiers',
      0
    );

    // Invalidate tier cache
    this.invalidateCache('tier-system-tiers');

    return response?.data || null;
  }

  /**
   * Create tier from template
   */
  async createTierFromTemplate(templateId: string, newTierData: Partial<Tier>): Promise<Tier | null> {
    const response = await this.makeDefaultRequest<Tier>(
      `/api/admin/tiers/from-template/${templateId}`,
      {
        method: 'POST',
        body: JSON.stringify(newTierData)
      },
      'tier-system-tiers',
      0
    );

    // Invalidate tier cache
    this.invalidateCache('tier-system-tiers');

    return response?.data || null;
  }

  /**
   * Delete tier
   */
  async deleteTier(tierId: string): Promise<void> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    await this.makeDefaultRequest<void>(
      `/api/admin/tiers/${tierId}`,
      { method: 'DELETE' },
      'tier-system-tiers',
      0
    );

    // Invalidate tier cache
    this.invalidateCache('tier-system-tiers');
  }

  /**
   * Get individual tiers only
   */
  async getIndividualTiers(): Promise<Tier[] | null> {
    const response = await this.makeDefaultRequest<{ individual: Tier[] }>(
      `/api/admin/tiers/individual`,
      {},
      'tier-system-tiers',
      60 * 60 * 1000
    );

    return response?.data?.individual || null;
  }

  /**
   * Get organization tiers only
   */
  async getOrganizationTiers(): Promise<Tier[] | null> {
    const response = await this.makeDefaultRequest<{ organization: Tier[] }>(
      `/api/admin/tiers/organization`,
      {},
      'tier-system-tiers',
      60 * 60 * 1000
    );

    return response?.data?.organization || null;
  }

  /**
   * Bulk update tier sort orders
   */
  async bulkUpdateSortOrders(tierUpdates: Array<{ id: string; sortOrder: number }>): Promise<void> {
    await this.makeDefaultRequest<void>(
      `/api/admin/tiers/bulk-update-sort`,
      {
        method: 'POST',
        body: JSON.stringify({ updates: tierUpdates })
      },
      'tier-system-tiers',
      0
    );

    // Invalidate tier cache
    this.invalidateCache('tier-system-tiers');
  }

  /**
   * Clone tier (create new tier based on existing one)
   */
  async cloneTier(tierId: string, newTierData: Partial<Tier>): Promise<Tier | null> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const response = await this.makeDefaultRequest<Tier>(
      `/api/admin/tiers/${tierId}/clone`,
      {
        method: 'POST',
        body: JSON.stringify(newTierData)
      },
      'tier-system-tiers',
      0
    );

    // Invalidate tier cache
    this.invalidateCache('tier-system-tiers');

    return response?.data || null;
  }
}

// Export singleton instance
export const tierSystemService = TierSystemService.getInstance();
