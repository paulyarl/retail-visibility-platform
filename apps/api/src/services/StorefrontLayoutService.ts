/**
 * Storefront Layouts Service
 *
 * Capability-aware service for resolving and managing storefront layout features.
 * Extracted from StorefrontOptionsService.ts.
 *
 * Feature prefix: storefront_layouts_ (new namespace)
 * Fallback prefix: storefront_opt_layout_* / storefront_opt_* (old namespace)
 *
 * Gate hierarchy:
 *   storefront_layouts (main gate - hard)
 *   ├── Classic layout  → storefront_layouts_classic
 *   ├── Editorial layout → storefront_layouts_editorial
 *   ├── Immersive layout → storefront_layouts_immersive
 *   └── storefront_layouts_flexible (master gate - unlocks all)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type StorefrontLayoutType = 'classic' | 'editorial' | 'immersive';

export const LAYOUT_TYPES: StorefrontLayoutType[] = ['classic', 'editorial', 'immersive'];

export interface StorefrontLayoutState {
  enabled: boolean;
  isFlexible: boolean;
  layoutEnabled: boolean;
  allowedLayouts: StorefrontLayoutType[];
  effectiveLayout: StorefrontLayoutType;
  canUseLayoutClassic: boolean;
  canUseLayoutEditorial: boolean;
  canUseLayoutImmersive: boolean;
  features: Record<string, boolean>;
}

// ====================
// SERVICE
// ====================

class StorefrontLayoutService {
  private static instance: StorefrontLayoutService;

  private constructor() {}

  static getInstance(): StorefrontLayoutService {
    if (!StorefrontLayoutService.instance) {
      StorefrontLayoutService.instance = new StorefrontLayoutService();
    }
    return StorefrontLayoutService.instance;
  }

  async resolveStorefrontLayoutState(tenantId: string): Promise<StorefrontLayoutState> {
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
        logger.warn('[StorefrontLayoutService] Tenant not found', undefined, { tenantId });
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

      const sfLayoutsCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_layouts' },
      });

      const sfOptCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_options' },
      });

      const [layoutsFeatures, optFeatures] = await Promise.all([
        sfLayoutsCapType
          ? prisma.tier_features_list.findMany({
              where: {
                tier_id: { in: tierIds },
                capability_type_id: sfLayoutsCapType.id,
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
                feature_key: { startsWith: 'storefront_opt_layout' },
              },
            })
          : Promise.resolve([]),
      ]);

      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of [...layoutsFeatures, ...optFeatures]) {
        const cleanKey = tf.feature_key.trim();
        mergedFeatures[cleanKey] = mergedFeatures[cleanKey] || tf.is_enabled;
      }

      // Also include domain gates from storefront_options
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
      logger.error('[StorefrontLayoutService] Error resolving storefront layout state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  resolveFromFeatures(features: Record<string, boolean>): StorefrontLayoutState {
    const disabled = !!features.storefront_layouts_disabled || !!features.storefront_opt_disabled;
    const enabled = !disabled && (!!features.storefront_layouts_enabled || !!features.storefront_opt_enabled);
    const flexible = !!features.storefront_layouts_flexible || !!features.storefront_opt_flexible;
    const mainOn = enabled;

    const layoutGroupEnabled = flexible
      || !!features.storefront_layouts_on || !!features.storefront_layouts
      || !!features.storefront_opt_layout_on
      || !!features.storefront_opt_layout_enabled;

    const allowedLayouts: StorefrontLayoutType[] = [];
    if (layoutGroupEnabled) {
      if (flexible) {
        allowedLayouts.push('classic', 'editorial', 'immersive');
      } else {
        if (features.storefront_layouts_classic || features.storefront_opt_layout_classic) allowedLayouts.push('classic');
        if (features.storefront_layouts_editorial || features.storefront_opt_layout_editorial) allowedLayouts.push('editorial');
        if (features.storefront_layouts_immersive || features.storefront_opt_layout_immersive) allowedLayouts.push('immersive');
      }
    }

    return {
      enabled: mainOn,
      isFlexible: flexible,
      layoutEnabled: mainOn && allowedLayouts.length > 0,
      allowedLayouts,
      effectiveLayout: allowedLayouts[0] || 'classic',
      canUseLayoutClassic: mainOn && allowedLayouts.includes('classic'),
      canUseLayoutEditorial: mainOn && allowedLayouts.includes('editorial'),
      canUseLayoutImmersive: mainOn && allowedLayouts.includes('immersive'),
      features,
    };
  }

  private getDisabledState(): StorefrontLayoutState {
    return {
      enabled: false,
      isFlexible: false,
      layoutEnabled: false,
      allowedLayouts: [],
      effectiveLayout: 'classic',
      canUseLayoutClassic: false,
      canUseLayoutEditorial: false,
      canUseLayoutImmersive: false,
      features: {},
    };
  }
}

export default StorefrontLayoutService;
