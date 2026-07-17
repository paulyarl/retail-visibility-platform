/**
 * Storefront Maps Service
 *
 * Capability-aware service for resolving and managing storefront maps features.
 * Extracted from StorefrontOptionsService.ts.
 *
 * Feature prefix: storefront_maps_ (new namespace)
 * Fallback prefix: storefront_opt_interactive_maps / storefront_opt_map_display / storefront_opt_location_display (old namespace)
 *
 * Gate hierarchy:
 *   storefront_maps (main gate - hard)
 *   ├── Interactive Maps → storefront_maps_interactive
 *   ├── Map Display      → storefront_maps_display
 *   ├── Location Display  → storefront_maps_location
 *   └── storefront_maps_flexible (master gate - unlocks all)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export interface StorefrontMapsState {
  enabled: boolean;
  isFlexible: boolean;
  mapsEnabled: boolean;
  canShowMapDisplay: boolean;
  canShowLocationDisplay: boolean;
  canUseInteractiveMaps: boolean;
  features: Record<string, boolean>;
}

// ====================
// SERVICE
// ====================

class StorefrontMapsService {
  private static instance: StorefrontMapsService;

  private constructor() {}

  static getInstance(): StorefrontMapsService {
    if (!StorefrontMapsService.instance) {
      StorefrontMapsService.instance = new StorefrontMapsService();
    }
    return StorefrontMapsService.instance;
  }

  async resolveStorefrontMapsState(tenantId: string): Promise<StorefrontMapsState> {
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
        logger.warn('[StorefrontMapsService] Tenant not found', undefined, { tenantId });
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

      const sfMapsCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_maps' },
      });

      const sfOptCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_options' },
      });

      const [mapsFeatures, optFeatures] = await Promise.all([
        sfMapsCapType
          ? prisma.tier_features_list.findMany({
              where: {
                tier_id: { in: tierIds },
                capability_type_id: sfMapsCapType.id,
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
                feature_key: { in: [
                  'storefront_opt_interactive_maps', 'storefront_opt_map_display', 'storefront_opt_location_display',
                  'storefront_opt_enabled', 'storefront_opt_disabled', 'storefront_opt_flexible',
                ] },
              },
            })
          : Promise.resolve([]),
      ]);

      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of [...mapsFeatures, ...optFeatures]) {
        const cleanKey = tf.feature_key.trim();
        mergedFeatures[cleanKey] = mergedFeatures[cleanKey] || tf.is_enabled;
      }

      return this.resolveFromFeatures(mergedFeatures);
    } catch (error) {
      logger.error('[StorefrontMapsService] Error resolving storefront maps state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  resolveFromFeatures(features: Record<string, boolean>): StorefrontMapsState {
    const disabled = !!features.storefront_maps_disabled || !!features.storefront_opt_disabled;
    const enabled = !disabled && (!!features.storefront_maps_enabled || !!features.storefront_opt_enabled);
    const flexible = !!features.storefront_maps_flexible || !!features.storefront_opt_flexible;
    const mainOn = enabled;

    const mapsGroupEnabled = flexible
      || !!features.storefront_maps_on || !!features.storefront_maps
      || !!features.storefront_maps_interactive
      || !!features.storefront_maps_display
      || !!features.storefront_maps_location
      || !!features.storefront_opt_interactive_maps
      || !!features.storefront_opt_map_display
      || !!features.storefront_opt_location_display;

    const interactiveMapsTierAllowed = flexible
      || !!features.storefront_maps_interactive
      || !!features.storefront_opt_interactive_maps;

    const mapDisplayTierAllowed = flexible
      || !!features.storefront_maps_display
      || !!features.storefront_opt_map_display;

    const locationDisplayTierAllowed = flexible
      || !!features.storefront_maps_location
      || !!features.storefront_opt_location_display;

    return {
      enabled: mainOn,
      isFlexible: flexible,
      mapsEnabled: mainOn && mapsGroupEnabled,
      canShowMapDisplay: mainOn && mapDisplayTierAllowed,
      canShowLocationDisplay: mainOn && locationDisplayTierAllowed,
      canUseInteractiveMaps: mainOn && interactiveMapsTierAllowed,
      features,
    };
  }

  private getDisabledState(): StorefrontMapsState {
    return {
      enabled: false,
      isFlexible: false,
      mapsEnabled: false,
      canShowMapDisplay: false,
      canShowLocationDisplay: false,
      canUseInteractiveMaps: false,
      features: {},
    };
  }
}

export default StorefrontMapsService;
