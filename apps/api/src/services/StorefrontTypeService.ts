/**
 * Storefront Type Service
 *
 * Capability-aware service for resolving and managing storefront type options.
 * Determines which storefront types (online, retail, service, social) are available
 * to a tenant based on their tier capabilities.
 *
 * Pattern: Follows IntegrationOptionsService for consistency.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type StorefrontType = 'online' | 'retail' | 'service' | 'social' | 'flexible' | 'none';

export interface StorefrontTypeState {
  /** Whether storefront is enabled at the tier level (master gate) */
  enabled: boolean;
  /** Storefront type determined by tier features */
  type: StorefrontType;
  /** Whether the tier allows choosing between multiple types */
  isFlexible: boolean;
  /** Which storefront types are allowed by the tier */
  allowedTypes: StorefrontType[];
  /** Whether storefront policies feature is enabled for the tier */
  policiesEnabled: boolean;
  /** Raw feature map from tier capabilities */
  features: Record<string, boolean>;
}

// ====================
// SERVICE
// ====================

class StorefrontTypeService {
  private static instance: StorefrontTypeService;

  private constructor() {}

  static getInstance(): StorefrontTypeService {
    if (!StorefrontTypeService.instance) {
      StorefrontTypeService.instance = new StorefrontTypeService();
    }
    return StorefrontTypeService.instance;
  }

  /**
   * Resolve storefront type state for a tenant from their tier capabilities.
   * Reads the storefront_types capability group from the tenant's tier features.
   */
  async resolveStorefrontTypeState(tenantId: string): Promise<StorefrontTypeState> {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          subscription_tier: true,
          subscription_status: true,
          organization_id: true,
          organizations_list: {
            select: { subscription_tier: true },
          },
        },
      });

      if (!tenant) {
        logger.warn('[StorefrontTypeService] Tenant not found', undefined, { tenantId });
        return this.getDisabledState();
      }

      // Collect tier keys (org + tenant, most-permissive-wins)
      const orgTierKey = tenant.organizations_list?.subscription_tier || null;
      const tenantTierKey = tenant.subscription_tier || null;
      const resolvedOrgTierKey = orgTierKey ? getEffectiveTier(orgTierKey) : null;
      const resolvedTenantTierKey = tenantTierKey ? getEffectiveTier(tenantTierKey) : null;
      const tierKeys = [resolvedOrgTierKey, resolvedTenantTierKey].filter((k): k is string => !!k);

      if (tierKeys.length === 0) {
        return this.getDisabledState();
      }

      // Fetch tier records
      const tiers = await prisma.subscription_tiers_list.findMany({
        where: { tier_key: { in: tierKeys } },
      });

      const tierIds = tiers.map(t => t.id);

      // Primary: query by capability_type_id (robust against feature key typos/spaces)
      // Fallback: query by feature_key prefix if capability type not found
      const sfTypeCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_types' },
      });

      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          ...(sfTypeCapType
            ? { capability_type_id: sfTypeCapType.id }
            : { feature_key: { startsWith: 'storefront_' } }),
          is_enabled: true,
        },
      });

      // Merge features: union across tiers (most-permissive-wins)
      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of tierFeatures) {
        const cleanKey = tf.feature_key.trim();
        mergedFeatures[cleanKey] = mergedFeatures[cleanKey] || tf.is_enabled;
      }

      return this.resolveFromFeatures(mergedFeatures);
    } catch (error) {
      logger.error('[StorefrontTypeService] Error resolving storefront type state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve StorefrontTypeState from a raw feature map.
   * Mirrors the frontend resolveStorefrontState logic.
   */
  resolveFromFeatures(features: Record<string, boolean>): StorefrontTypeState {
    // Master gates (explicit activation/deactivation)
    const masterActivate = !!features.storefront || !!features.storefront_enabled;
    const masterDeactivate = !!features.storefront_disabled;

    // Feature gates (implicit activation)
    const online = !!features.storefront_online;
    const retail = !!features.storefront_retail;
    const service = !!features.storefront_service;
    const social = !!features.storefront_social;

    // Flexible gate
    const bothOptions = !!features.storefront_flexible;

    // Policies gate (platform key, no merchant control)
    const policiesEnabled = !!features.storefront_policies;

    // Determine enabled state
    // 1. Deactivation master gate takes highest priority
    // 2. Activation master gates enable explicitly
    // 3. Any individual feature gate enabled implies enabled
    // 4. Default to disabled when nothing is enabled
    const hasAnyFeatureGate = online || retail || service || social || bothOptions;
    const isEnabled = masterDeactivate
      ? false
      : masterActivate
        ? true
        : hasAnyFeatureGate;

    // Determine type from feature gates
    let type: StorefrontType = 'none';
    if (!isEnabled) {
      type = 'none';
    } else if (bothOptions || (online && retail) || (online && service) || (online && social) || (retail && service) || (retail && social) || (service && social)) {
      type = 'flexible';
    } else if (social) {
      type = 'social';
    } else if (online) {
      type = 'online';
    } else if (retail) {
      type = 'retail';
    } else if (service) {
      type = 'service';
    }

    // Compute allowed types
    const allowedTypes: StorefrontType[] = [];
    if (isEnabled) {
      if (bothOptions) {
        // Flexible: all individual types allowed
        allowedTypes.push('online', 'retail', 'service', 'social');
      } else {
        if (online) allowedTypes.push('online');
        if (retail) allowedTypes.push('retail');
        if (service) allowedTypes.push('service');
        if (social) allowedTypes.push('social');
      }
    }

    return {
      enabled: isEnabled,
      policiesEnabled,
      type,
      isFlexible: bothOptions,
      allowedTypes,
      features,
    };
  }

  /**
   * Check if a specific storefront type is allowed for a tenant.
   */
  async isStorefrontTypeAllowed(tenantId: string, type: StorefrontType): Promise<boolean> {
    const state = await this.resolveStorefrontTypeState(tenantId);
    return state.enabled && state.allowedTypes.includes(type);
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): StorefrontTypeState {
    return {
      enabled: false,
      type: 'none',
      isFlexible: false,
      allowedTypes: [],
      policiesEnabled: false,
      features: {},
    };
  }
}

export default StorefrontTypeService;
