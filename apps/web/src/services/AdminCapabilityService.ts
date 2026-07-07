/**
 * Admin Capability Service
 * 
 * Extends AdminApiSingleton to provide admin capability management operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 * Routes directly to API server via AdminApiSingleton (RequestTarget.API)
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface CapabilityData {
  capability_type_key: string;
  capability_type_name: string;
  category: string;
  tier_key: string;
  tier_name: string;
  description: string;
  feature_count: number;
  enabled_feature_count?: number;
  disabled_feature_count?: number;
  is_fully_enabled?: boolean;
  has_disabled?: boolean;
  has_flexible?: boolean;
  is_org_scoped?: boolean;
  features_in_capability: string;
  capability_sort_order?: number;
  tier_sort_order?: number;
}

export interface TierCapability {
  tier_key: string;
  tier_name: string;
  capability_type_key: string;
  capability_type_name: string;
  capability_enabled: boolean;
  is_highlighted: boolean;
  highlight_order: number;
  marketing_name: string;
  features: Array<{
    feature_key: string;
    feature_name: string;
    is_enabled: boolean;
    effective_restrictions?: any;
  }>;
  capability_category?: string;
  tier_specific_restrictions?: any;
  total_features?: number;
}

export interface CapabilityUpdateRequest {
  tier_key: string;
  capability_type_key: string;
  capability_enabled: boolean;
  is_highlighted?: boolean;
  highlight_order?: number;
  marketing_name?: string;
  features?: Array<{
    feature_key: string;
    is_enabled: boolean;
    effective_restrictions?: any;
  }>;
}

export interface Feature {
  feature_key: string;
  feature_name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CapabilityType {
  capability_type_key: string;
  capability_type_name: string;
  description?: string;
  category?: string;
  is_active?: boolean;
  sort_order?: number;
  allowed_features?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Tier {
  tier_key: string;
  tier_name: string;
  description?: string;
  features: string[];
  capabilities: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ConstraintData {
  id: string;
  constraint_id: string;
  type: string;
  severity: string;
  source_capability: string;
  source_field: string;
  source_operator: string;
  source_value: string;
  target_capability: string;
  target_field: string;
  target_operator: string;
  target_value: string;
  message: string;
  resolution_hint: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ConstraintFieldMeta {
  field: string;
  label: string;
  value_type: 'string' | 'boolean' | 'array';
  operators: string[];
  values?: string[];
}

export interface ConstraintCapabilityMeta {
  key: string;
  label: string;
  fields: ConstraintFieldMeta[];
}

export interface ConstraintMetadata {
  capabilities: ConstraintCapabilityMeta[];
  operators: string[];
  types: string[];
  severities: string[];
}

/**
 * Service for managing admin capability operations
 */
export class AdminCapabilityService extends AdminApiSingleton {
  private static instance: AdminCapabilityService;

  private constructor() {
    super('AdminCapabilityService');
  }

  static getInstance(): AdminCapabilityService {
    if (!AdminCapabilityService.instance) {
      AdminCapabilityService.instance = new AdminCapabilityService();
    }
    return AdminCapabilityService.instance;
  }

  /**
   * Get all capabilities overview for admin management
   */
  async getAllCapabilities(): Promise<CapabilityData[]> {
    const result = await this.makeDefaultRequest<CapabilityData[]>(
      '/api/admin/capabilities',
      {},
      'admin-capabilities-all',
      this.cacheTTL,
    );

    if (!result.success) {
      console.error('[AdminCapabilityService] Failed to get capabilities:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch capabilities');
    }

    return result.data!;
  }

  /**
   * Get detailed capabilities for a specific tier
   */
  async getTierCapabilities(tierKey: string): Promise<TierCapability[]> {
    const result = await this.makeDefaultRequest<TierCapability[]>(
      `/api/admin/tier-capabilities?tierKey=${tierKey}`,
      {},
      `admin-capabilities-tier-${tierKey}`,
      this.cacheTTL,
    );

    if (!result.success) {
      console.error(`[AdminCapabilityService] Failed to get tier capabilities for ${tierKey}:`, result.error);
      throw new Error(typeof result.error === 'string' ? result.error : `Failed to fetch tier capabilities for ${tierKey}`);
    }

    return result.data!;
  }

  /**
   * Update capabilities for a specific tier
   */
  async updateTierCapabilities(tierKey: string, updateData: CapabilityUpdateRequest): Promise<TierCapability[]> {
    const result = await this.makeDefaultRequest<TierCapability[]>(
      `/api/admin/tier-capabilities?tierKey=${tierKey}`,
      {
        method: 'PUT',
        body: JSON.stringify(updateData),
      },
      `admin-capabilities-tier-${tierKey}`,
      0, // No cache for write operations
    );

    if (!result.success) {
      console.error(`[AdminCapabilityService] Failed to update tier capabilities for ${tierKey}:`, result.error);
      throw new Error(typeof result.error === 'string' ? result.error : `Failed to update tier capabilities for ${tierKey}`);
    }

    // Clear related caches
    await this.invalidateCachePattern('admin-capabilities-all');
    
    return result.data!;
  }

  /**
   * Create a new tier capability (assign a capability type to a tier)
   */
  async createTierCapability(data: {
    tier_key: string;
    capability_type_key: string;
    capability_enabled?: boolean;
    is_highlighted?: boolean;
    highlight_order?: number;
    marketing_name?: string;
    features?: Array<{ feature_key: string; is_enabled: boolean }>;
  }): Promise<TierCapability> {
    const result = await this.makeDefaultRequest<TierCapability>(
      '/api/admin/tier-capabilities',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'admin-tier-capabilities-create',
      0,
    );

    if (!result.success) {
      console.error('[AdminCapabilityService] Failed to create tier capability:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create tier capability');
    }

    await this.invalidateCachePattern('admin-capabilities');
    await this.invalidateCachePattern(`admin-capabilities-tier-${data.tier_key}`);

    return result.data!;
  }

  /**
   * Delete a tier capability (remove a capability type from a tier)
   */
  async deleteTierCapability(tierKey: string, capabilityTypeKey: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/tier-capabilities?tierKey=${tierKey}&capabilityTypeKey=${capabilityTypeKey}`,
      { method: 'DELETE' },
      `admin-tier-capabilities-delete-${tierKey}-${capabilityTypeKey}`,
      0,
    );

    if (!result.success) {
      console.error('[AdminCapabilityService] Failed to delete tier capability:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete tier capability');
    }

    await this.invalidateCachePattern('admin-capabilities');
    await this.invalidateCachePattern(`admin-capabilities-tier-${tierKey}`);
  }

  // ===== Features CRUD =====

  async getFeatures(): Promise<Feature[]> {
    const result = await this.makeDefaultRequest<Feature[]>(
      '/api/admin/features',
      {},
      'admin-features-all',
      this.cacheTTL,
    );
    if (!result.success) throw new Error('Failed to fetch features');
    return result.data!;
  }

  async createFeature(data: { feature_key: string; feature_name: string; description?: string }): Promise<Feature> {
    const result = await this.makeDefaultRequest<Feature>(
      '/api/admin/features',
      { method: 'POST', body: JSON.stringify(data) },
      'admin-features-create',
      0,
    );
    if (!result.success) throw new Error('Failed to create feature');
    await this.invalidateCachePattern('admin-features');
    return result.data!;
  }

  async updateFeature(data: { feature_key: string; feature_name: string; description?: string }): Promise<Feature> {
    const result = await this.makeDefaultRequest<Feature>(
      '/api/admin/features',
      { method: 'PUT', body: JSON.stringify(data) },
      'admin-features-update',
      0,
    );
    if (!result.success) throw new Error('Failed to update feature');
    await this.invalidateCachePattern('admin-features');
    return result.data!;
  }

  async deleteFeature(featureKey: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/features?feature_key=${featureKey}`,
      { method: 'DELETE' },
      'admin-features-delete',
      0,
    );
    if (!result.success) throw new Error('Failed to delete feature');
    await this.invalidateCachePattern('admin-features');
  }

  // ===== Capability Types CRUD =====

  async getCapabilityTypes(): Promise<CapabilityType[]> {
    const result = await this.makeDefaultRequest<CapabilityType[]>(
      '/api/admin/capability-types',
      {},
      'admin-capability-types-all',
      this.cacheTTL,
    );
    if (!result.success) throw new Error('Failed to fetch capability types');
    return result.data!;
  }

  async createCapabilityType(data: { capability_type_key: string; capability_type_name: string; description?: string; category?: string; is_active?: boolean; sort_order?: number; allowed_features?: string[] }): Promise<CapabilityType> {
    const result = await this.makeDefaultRequest<CapabilityType>(
      '/api/admin/capability-types',
      { method: 'POST', body: JSON.stringify(data) },
      'admin-capability-types-create',
      0,
    );
    if (!result.success) throw new Error('Failed to create capability type');
    await this.invalidateCachePattern('admin-capability-types');
    return result.data!;
  }

  async updateCapabilityType(data: { capability_type_key: string; capability_type_name: string; description?: string; category?: string; is_active?: boolean; sort_order?: number; allowed_features?: string[] }): Promise<CapabilityType> {
    const result = await this.makeDefaultRequest<CapabilityType>(
      '/api/admin/capability-types',
      { method: 'PUT', body: JSON.stringify(data) },
      'admin-capability-types-update',
      0,
    );
    if (!result.success) throw new Error('Failed to update capability type');
    await this.invalidateCachePattern('admin-capability-types');
    return result.data!;
  }

  async deleteCapabilityType(capabilityTypeKey: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/capability-types?capability_type_key=${capabilityTypeKey}`,
      { method: 'DELETE' },
      'admin-capability-types-delete',
      0,
    );
    if (!result.success) throw new Error('Failed to delete capability type');
    await this.invalidateCachePattern('admin-capability-types');
  }

  // ===== Tiers CRUD =====

  async getTiers(): Promise<Tier[]> {
    const result = await this.makeDefaultRequest<Tier[]>(
      '/api/admin/tiers',
      {},
      'admin-tiers-all',
      this.cacheTTL,
    );
    if (!result.success) throw new Error('Failed to fetch tiers');
    return result.data!;
  }

  async updateTier(data: { tier_key: string; tier_name?: string; description?: string; features?: string[]; capabilities?: string[] }): Promise<Tier> {
    const result = await this.makeDefaultRequest<Tier>(
      '/api/admin/tiers',
      { method: 'PUT', body: JSON.stringify(data) },
      'admin-tiers-update',
      0,
    );
    if (!result.success) throw new Error('Failed to update tier');
    await this.invalidateCachePattern('admin-tiers');
    await this.invalidateCachePattern('admin-capabilities');
    return result.data!;
  }

  // ===== Constraints CRUD =====

  async getConstraints(): Promise<ConstraintData[]> {
    const result = await this.makeDefaultRequest<ConstraintData[] | { constraints: ConstraintData[] }>(
      '/api/admin/capability-constraints',
      {},
      'admin-constraints-all',
      this.cacheTTL,
    );
    if (!result.success) throw new Error('Failed to fetch constraints');
    const data = result.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as any).constraints)) return (data as any).constraints;
    return [];
  }

  async getConstraintMetadata(): Promise<ConstraintMetadata> {
    const result = await this.makeDefaultRequest<ConstraintMetadata>(
      '/api/admin/capability-constraints/metadata',
      {},
      'admin-constraints-metadata',
      this.cacheTTL,
    );
    if (!result.success) throw new Error('Failed to fetch constraint metadata');
    return result.data!;
  }

  async createConstraint(data: Omit<ConstraintData, 'id' | 'created_at' | 'updated_at'>): Promise<ConstraintData> {
    const result = await this.makeDefaultRequest<ConstraintData>(
      '/api/admin/capability-constraints',
      { method: 'POST', body: JSON.stringify(data) },
      'admin-constraints-create',
      0,
    );
    if (!result.success) throw new Error('Failed to create constraint');
    await this.invalidateCachePattern('admin-constraints');
    return result.data!;
  }

  async updateConstraint(id: string, data: Partial<Omit<ConstraintData, 'id' | 'created_at' | 'updated_at'>>): Promise<ConstraintData> {
    const result = await this.makeDefaultRequest<ConstraintData>(
      `/api/admin/capability-constraints/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
      'admin-constraints-update',
      0,
    );
    if (!result.success) throw new Error('Failed to update constraint');
    await this.invalidateCachePattern('admin-constraints');
    return result.data!;
  }

  async deleteConstraint(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/capability-constraints/${id}`,
      { method: 'DELETE' },
      'admin-constraints-delete',
      0,
    );
    if (!result.success) throw new Error('Failed to delete constraint');
    await this.invalidateCachePattern('admin-constraints');
  }

  /**
   * Clear cache for all capability data
   */
  async clearCapabilityCache(): Promise<void> {
    await this.invalidateCachePattern('admin-capabilities');
  }

  /**
   * Clear cache for specific tier
   */
  async clearTierCache(tierKey: string): Promise<void> {
    await this.invalidateCachePattern(`admin-capabilities-tier-${tierKey}`);
    await this.invalidateCachePattern('admin-capabilities-all');
  }
}

// Export singleton instance
export const adminCapabilityService = AdminCapabilityService.getInstance();
