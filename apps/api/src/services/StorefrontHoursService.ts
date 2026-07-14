/**
 * Storefront Hours Service
 *
 * Capability-aware service for resolving and managing business hours features.
 * Extracted from StorefrontOptionsService.ts.
 *
 * Feature prefix: storefront_hours_ (new namespace)
 * Fallback prefix: storefront_opt_hours_ / storefront_opt_* (old namespace)
 *
 * Gate hierarchy:
 *   storefront_hours (main gate - hard)
 *   ├── Hours display → storefront_hours_display
 *   ├── Animated hours → storefront_hours_animated
 *   ├── Hours status → storefront_hours_status
 *   └── storefront_hours_flexible (master gate - unlocks all)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type StorefrontOptHoursType = 'hours_animated' | 'hours_status';

export const HOURS_TYPES: StorefrontOptHoursType[] = ['hours_animated', 'hours_status'];

export interface StorefrontHoursState {
  enabled: boolean;
  isFlexible: boolean;
  hoursEnabled: boolean;
  allowedHoursTypes: StorefrontOptHoursType[];
  hoursDisplayEnabled: boolean;
  canShowHoursDisplay: boolean;
  canUseAnimatedHours: boolean;
  canShowHoursStatus: boolean;
  features: Record<string, boolean>;
}

// ====================
// SERVICE
// ====================

class StorefrontHoursService {
  private static instance: StorefrontHoursService;

  private constructor() {}

  static getInstance(): StorefrontHoursService {
    if (!StorefrontHoursService.instance) {
      StorefrontHoursService.instance = new StorefrontHoursService();
    }
    return StorefrontHoursService.instance;
  }

  /**
   * Resolve storefront hours state for a tenant from their tier capabilities.
   * Checks new storefront_hours_* keys first, then falls back to old storefront_opt_hours_* keys.
   */
  async resolveStorefrontHoursState(tenantId: string): Promise<StorefrontHoursState> {
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
        logger.warn('[StorefrontHoursService] Tenant not found', undefined, { tenantId });
        return this.getDisabledState();
      }

      const orgTierKey = tenant.organizations_list?.subscription_tier || null;
      const tenantTierKey = tenant.subscription_tier || null;
      const resolvedOrgTierKey = orgTierKey ? getEffectiveTier(orgTierKey) : null;
      const resolvedTenantTierKey = tenantTierKey ? getEffectiveTier(tenantTierKey) : null;
      const tierKeys = [resolvedOrgTierKey, resolvedTenantTierKey].filter((k): k is string => !!k);

      if (tierKeys.length === 0) {
        return this.getDisabledState();
      }

      const tiers = await prisma.subscription_tiers_list.findMany({
        where: { tier_key: { in: tierKeys } },
      });

      const tierIds = tiers.map(t => t.id);

      // Query new storefront_hours capability type
      const sfHoursCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_hours' },
      });

      // Also query old storefront_options for fallback
      const sfOptCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_options' },
      });

      const [hoursFeatures, optFeatures] = await Promise.all([
        sfHoursCapType
          ? prisma.tier_features_list.findMany({
              where: {
                tier_id: { in: tierIds },
                capability_type_id: sfHoursCapType.id,
                is_enabled: true,
              },
            })
          : Promise.resolve([]),
        sfOptCapType
          ? prisma.tier_features_list.findMany({
              where: {
                tier_id: { in: tierIds },
                capability_type_id: sfOptCapType.id,
                is_enabled: true,
                feature_key: { startsWith: 'storefront_opt_hours' },
              },
            })
          : Promise.resolve([]),
      ]);

      // Merge new + old features
      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of [...hoursFeatures, ...optFeatures]) {
        const cleanKey = tf.feature_key.trim();
        mergedFeatures[cleanKey] = mergedFeatures[cleanKey] || tf.is_enabled;
      }

      // Also include domain gates from storefront_options (enabled/disabled/flexible)
      if (sfOptCapType) {
        const optDomainGates = await prisma.tier_features_list.findMany({
          where: {
            tier_id: { in: tierIds },
            capability_type_id: sfOptCapType.id,
            is_enabled: true,
            feature_key: { in: ['storefront_opt_enabled', 'storefront_opt_disabled', 'storefront_opt_flexible'] },
          },
        });
        for (const tf of optDomainGates) {
          const cleanKey = tf.feature_key.trim();
          mergedFeatures[cleanKey] = mergedFeatures[cleanKey] || tf.is_enabled;
        }
      }

      return this.resolveFromFeatures(mergedFeatures);
    } catch (error) {
      logger.error('[StorefrontHoursService] Error resolving storefront hours state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve StorefrontHoursState from a raw feature map.
   * Features include both new storefront_hours_ and old storefront_opt_hours_* keys.
   */
  resolveFromFeatures(features: Record<string, boolean>): StorefrontHoursState {
    const disabled = !!features.storefront_hours_disabled || !!features.storefront_opt_disabled;
    const enabled = !disabled && (!!features.storefront_hours_enabled || !!features.storefront_opt_enabled);
    const flexible = !!features.storefront_hours_flexible || !!features.storefront_opt_flexible;
    const mainOn = enabled;

    // Hours group — new keys with fallback to old storefront_opt_hours_* keys
    const hoursGroupEnabled = flexible
      || !!features.storefront_hours_on || !!features.storefront_hours
      || !!features.storefront_opt_hours_on
      || !!features.storefront_opt_hours_enabled;

    // Hours display toggle
    const hoursDisplayTierAllowed = flexible
      || !!features.storefront_hours_display
      || !!features.storefront_opt_hours_display;

    // Individual hours features
    const allowedHoursTypes: StorefrontOptHoursType[] = [];
    if (hoursGroupEnabled) {
      if (flexible) {
        allowedHoursTypes.push('hours_animated', 'hours_status');
      } else {
        if (features.storefront_hours_animated || features.storefront_opt_hours_animated) allowedHoursTypes.push('hours_animated');
        if (features.storefront_hours_status || features.storefront_opt_hours_status) allowedHoursTypes.push('hours_status');
      }
    }

    return {
      enabled: mainOn,
      isFlexible: flexible,
      hoursEnabled: mainOn && (hoursGroupEnabled || allowedHoursTypes.length > 0),
      allowedHoursTypes,
      hoursDisplayEnabled: mainOn && hoursDisplayTierAllowed,
      canShowHoursDisplay: mainOn && hoursDisplayTierAllowed,
      canUseAnimatedHours: mainOn && allowedHoursTypes.includes('hours_animated'),
      canShowHoursStatus: mainOn && allowedHoursTypes.includes('hours_status'),
      features,
    };
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): StorefrontHoursState {
    return {
      enabled: false,
      isFlexible: false,
      hoursEnabled: false,
      allowedHoursTypes: [],
      hoursDisplayEnabled: false,
      canShowHoursDisplay: false,
      canUseAnimatedHours: false,
      canShowHoursStatus: false,
      features: {},
    };
  }
}

export default StorefrontHoursService;
