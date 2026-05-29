/**
 * Storefront Type Service
 *
 * Capability-aware service for resolving and managing storefront type options.
 * Determines which storefront types (online, retail, service) are available
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

export type StorefrontType = 'online' | 'retail' | 'service' | 'both' | 'none';

export interface StorefrontTypeState {
  /** Whether storefront is enabled at the tier level (master gate) */
  enabled: boolean;
  /** Storefront type determined by tier features */
  type: StorefrontType;
  /** Whether the tier allows choosing between multiple types */
  isFlexible: boolean;
  /** Which storefront types are allowed by the tier */
  allowedTypes: StorefrontType[];
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

      // Fetch storefront_ feature keys from tier_features_list
      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          feature_key: { startsWith: 'storefront_' },
          is_enabled: true,
        },
        include: {
          capability_type_list: { select: { key: true } },
        },
      });

      // Only include features from the storefront_types capability type (not storefront_options)
      const storefrontTypeFeatures = tierFeatures.filter(
        tf => tf.capability_type_list?.key === 'storefront_types'
      );

      // Merge features: union across tiers (most-permissive-wins)
      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of storefrontTypeFeatures) {
        mergedFeatures[tf.feature_key] = mergedFeatures[tf.feature_key] || tf.is_enabled;
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

    // Flexible gate
    const bothOptions = !!features.storefront_both_options;

    // Determine enabled state
    // 1. Deactivation master gate takes highest priority
    // 2. Activation master gates enable explicitly
    // 3. Feature/flexible gates enable implicitly when master gates are untouched
    const hasAnyFeatureGate = online || retail || service || bothOptions;
    const isEnabled = masterDeactivate
      ? false
      : masterActivate
        ? true
        : hasAnyFeatureGate;

    // Determine type from feature gates
    let type: StorefrontType = 'none';
    if (!isEnabled) {
      type = 'none';
    } else if (bothOptions || (online && retail) || (online && service) || (retail && service)) {
      type = 'both';
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
        allowedTypes.push('online', 'retail', 'service');
      } else {
        if (online) allowedTypes.push('online');
        if (retail) allowedTypes.push('retail');
        if (service) allowedTypes.push('service');
      }
    }

    return {
      enabled: isEnabled,
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
      features: {},
    };
  }
}

export default StorefrontTypeService;
