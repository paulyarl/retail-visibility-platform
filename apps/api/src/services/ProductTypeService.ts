/**
 * Product Type Service
 *
 * Capability-aware service for resolving and managing product type options.
 * Determines which product types (physical, digital, hybrid, service) are available
 * to a tenant based on their tier capabilities.
 *
 * Pattern: Follows StorefrontTypeService for consistency.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type ProductType = 'physical' | 'digital' | 'hybrid' | 'service' | 'flexible' | 'none';

export interface ProductTypeState {
  /** Whether product types is enabled at the tier level (master gate) */
  enabled: boolean;
  /** Product type determined by tier features */
  type: ProductType;
  /** Whether the tier allows choosing between multiple types */
  isFlexible: boolean;
  /** Which product types are allowed by the tier */
  allowedTypes: ProductType[];
  /** Raw feature map from tier capabilities */
  features: Record<string, boolean>;
}

// ====================
// SERVICE
// ====================

class ProductTypeService {
  private static instance: ProductTypeService;

  private constructor() {}

  static getInstance(): ProductTypeService {
    if (!ProductTypeService.instance) {
      ProductTypeService.instance = new ProductTypeService();
    }
    return ProductTypeService.instance;
  }

  /**
   * Resolve product type state for a tenant from their tier capabilities.
   * Reads the product_types capability group from the tenant's tier features.
   */
  async resolveProductTypeState(tenantId: string): Promise<ProductTypeState> {
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
        logger.warn('[ProductTypeService] Tenant not found', undefined, { tenantId });
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
      const ptCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'product_types' },
      });

      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          ...(ptCapType
            ? { capability_type_id: ptCapType.id }
            : { feature_key: { startsWith: 'product_types_' } }),
          is_enabled: true,
        },
      });

      // Also fetch legacy product_options features for backward compat fallback
      const poCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'product_options' },
      });

      let legacyFeatures: Record<string, boolean> = {};
      if (tierFeatures.length === 0 && poCapType) {
        const legacyTierFeatures = await prisma.tier_features_list.findMany({
          where: {
            tier_id: { in: tierIds },
            capability_type_id: poCapType.id,
            is_enabled: true,
            feature_key: { in: ['product_enabled', 'product_flexible', 'product_disabled', 'product_physical', 'product_digital', 'product_hybrid', 'product_service'] },
          },
        });
        for (const tf of legacyTierFeatures) {
          const cleanKey = tf.feature_key.trim();
          legacyFeatures[cleanKey] = legacyFeatures[cleanKey] || tf.is_enabled;
        }
      }

      // Merge features: union across tiers (most-permissive-wins)
      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of tierFeatures) {
        const cleanKey = tf.feature_key.trim();
        mergedFeatures[cleanKey] = mergedFeatures[cleanKey] || tf.is_enabled;
      }
      // Merge legacy features for backward compat
      for (const [k, v] of Object.entries(legacyFeatures)) {
        mergedFeatures[k] = mergedFeatures[k] || v;
      }

      return this.resolveFromFeatures(mergedFeatures);
    } catch (error) {
      logger.error('[ProductTypeService] Error resolving product type state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve ProductTypeState from a raw feature map.
   * Checks new canonical keys (product_types_*) first, then falls back to
   * legacy keys (product_*) for backward compatibility.
   */
  resolveFromFeatures(features: Record<string, boolean>): ProductTypeState {
    // Master gates (R17: disabled > enabled > flexible > features)
    const masterDisabled = !!features.product_types_disabled;
    const masterEnabled = !!features.product_types_enabled;
    const flexible = !!features.product_types_flexible;

    // Legacy fallback
    const legacyEnabled = !!features.product_enabled;
    const legacyFlexible = !!features.product_flexible;
    const legacyDisabled = !!features.product_disabled;

    // Type gates (new canonical keys first)
    const physical = !!features.product_types_physical || !!features.product_physical;
    const digital = !!features.product_types_digital || !!features.product_digital;
    const hybrid = !!features.product_types_hybrid || !!features.product_hybrid;
    const service = !!features.product_types_service || !!features.product_service;

    const hasAnyFeatureGate = physical || digital || hybrid || service;
    const isEnabled = masterDisabled
      ? false
      : masterEnabled
        ? true
        : flexible
          ? true
          : legacyDisabled
            ? false
            : legacyEnabled
              ? true
              : legacyFlexible
                ? true
                : hasAnyFeatureGate;

    const isFlexible = flexible || legacyFlexible;

    // Determine type from feature gates
    let type: ProductType = 'none';
    if (!isEnabled) {
      type = 'none';
    } else if (isFlexible || (physical && digital && hybrid && service)) {
      type = 'flexible';
    } else if (physical && digital && hybrid) {
      type = 'flexible';
    } else if (physical && digital) {
      type = 'flexible';
    } else if (physical) {
      type = 'physical';
    } else if (digital) {
      type = 'digital';
    } else if (hybrid) {
      type = 'hybrid';
    } else if (service) {
      type = 'service';
    }

    // Compute allowed types
    const allowedTypes: ProductType[] = [];
    if (isEnabled) {
      if (isFlexible) {
        allowedTypes.push('physical', 'digital', 'hybrid', 'service');
      } else {
        if (physical) allowedTypes.push('physical');
        if (digital) allowedTypes.push('digital');
        if (hybrid) allowedTypes.push('hybrid');
        if (service) allowedTypes.push('service');
      }
    }

    return {
      enabled: isEnabled,
      type,
      isFlexible,
      allowedTypes,
      features,
    };
  }

  /**
   * Check if a specific product type is allowed for a tenant.
   */
  async isProductTypeAllowed(tenantId: string, type: ProductType): Promise<boolean> {
    const state = await this.resolveProductTypeState(tenantId);
    return state.enabled && state.allowedTypes.includes(type);
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): ProductTypeState {
    return {
      enabled: false,
      type: 'none',
      isFlexible: false,
      allowedTypes: [],
      features: {},
    };
  }
}

export default ProductTypeService;
