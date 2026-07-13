/**
 * Storefront Gallery Service
 *
 * Capability-aware service for resolving and managing image gallery features.
 * Extracted from StorefrontOptionsService.ts.
 *
 * Feature prefix: storefront_gallery_ (new namespace)
 * Fallback prefix: storefront_opt_gallery_ / storefront_opt_image_gallery_ (old namespace)
 *
 * Gate hierarchy:
 *   storefront_gallery (main gate - hard)
 *   ├── Image limits → image_gallery_5/10/15
 *   ├── Carousel mode (sub-group) → carousel display
 *   ├── Magazine mode (sub-group) → magazine/mosaic display
 *   └── storefront_gallery_flexible (master gate - unlocks all)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type StorefrontOptGalleryType = 'image_gallery_5' | 'image_gallery_10' | 'image_gallery_15';
export type StorefrontOptGalleryDisplayMode = 'carousel' | 'magazine';

export const GALLERY_TYPES: StorefrontOptGalleryType[] = ['image_gallery_5', 'image_gallery_10', 'image_gallery_15'];

export interface StorefrontGalleryState {
  enabled: boolean;
  isFlexible: boolean;
  galleryEnabled: boolean;
  allowedGalleryTypes: StorefrontOptGalleryType[];
  defaultGalleryLimit: number;
  galleryDisplayMode: StorefrontOptGalleryDisplayMode;
  galleryCarouselEnabled: boolean;
  galleryMagazineEnabled: boolean;
  canUseMagazineGallery: boolean;
  canUseGallery: boolean;
  features: Record<string, boolean>;
}

// ====================
// SERVICE
// ====================

class StorefrontGalleryService {
  private static instance: StorefrontGalleryService;

  private constructor() {}

  static getInstance(): StorefrontGalleryService {
    if (!StorefrontGalleryService.instance) {
      StorefrontGalleryService.instance = new StorefrontGalleryService();
    }
    return StorefrontGalleryService.instance;
  }

  /**
   * Resolve storefront gallery state for a tenant from their tier capabilities.
   * Checks new storefront_gallery_* keys first, then falls back to old storefront_opt_gallery_* keys.
   */
  async resolveStorefrontGalleryState(tenantId: string): Promise<StorefrontGalleryState> {
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
        logger.warn('[StorefrontGalleryService] Tenant not found', undefined, { tenantId });
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

      // Query new storefront_gallery capability type
      const sfGalleryCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_gallery' },
      });

      // Also query old storefront_options for fallback
      const sfOptCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_options' },
      });

      const [galleryFeatures, optFeatures] = await Promise.all([
        sfGalleryCapType
          ? prisma.tier_features_list.findMany({
              where: {
                tier_id: { in: tierIds },
                capability_type_id: sfGalleryCapType.id,
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
                feature_key: { startsWith: 'storefront_opt_gallery' },
              },
            })
          : Promise.resolve([]),
      ]);

      // Also get image_gallery keys from storefront_options
      const optImageGalleryFeatures = await (sfOptCapType
        ? prisma.tier_features_list.findMany({
            where: {
              tier_id: { in: tierIds },
              capability_type_id: sfOptCapType.id,
              is_enabled: true,
              feature_key: { startsWith: 'storefront_opt_image_gallery' },
            },
          })
        : Promise.resolve([]));

      // Merge new + old features
      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of [...galleryFeatures, ...optFeatures, ...optImageGalleryFeatures]) {
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
      logger.error('[StorefrontGalleryService] Error resolving storefront gallery state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve StorefrontGalleryState from a raw feature map.
   * Features include both new storefront_gallery_ and old storefront_opt_gallery_ / image_gallery_ keys.
   */
  resolveFromFeatures(features: Record<string, boolean>): StorefrontGalleryState {
    const disabled = !!features.storefront_gallery_disabled || !!features.storefront_opt_disabled;
    const enabled = !disabled && (!!features.storefront_gallery_enabled || !!features.storefront_opt_enabled);
    const flexible = !!features.storefront_gallery_flexible || !!features.storefront_opt_flexible;
    const mainOn = enabled;

    // Gallery group — new keys with fallback to old storefront_opt_gallery_* keys
    const galleryGroupEnabled = flexible
      || !!features.storefront_gallery_on || !!features.storefront_gallery || !!features.storefront_gallery_enabled
      || !!features.storefront_opt_gallery_on || !!features.storefront_opt_gallery || !!features.storefront_opt_gallery_enabled;

    // Image limits
    const allowedGalleryTypes: StorefrontOptGalleryType[] = [];
    if (galleryGroupEnabled) {
      if (flexible
        || features.storefront_gallery_on || features.storefront_gallery || features.storefront_gallery_enabled
        || features.storefront_opt_gallery_on || features.storefront_opt_gallery || features.storefront_opt_gallery_enabled
      ) {
        allowedGalleryTypes.push('image_gallery_5', 'image_gallery_10', 'image_gallery_15');
      } else {
        if (features.storefront_gallery_limit_5 || features.storefront_opt_image_gallery_5) allowedGalleryTypes.push('image_gallery_5');
        if (features.storefront_gallery_limit_10 || features.storefront_opt_image_gallery_10) allowedGalleryTypes.push('image_gallery_10');
        if (features.storefront_gallery_limit_15 || features.storefront_opt_image_gallery_15) allowedGalleryTypes.push('image_gallery_15');
      }
    }

    // Carousel sub-group
    const galleryCarouselEnabled = galleryGroupEnabled && (
      flexible
      || !!features.storefront_gallery_carousel
      || !!features.storefront_gallery_carousel_on
      || !!features.storefront_gallery_enabled
    );

    // Magazine sub-group
    const galleryMagazineEnabled = galleryGroupEnabled && (
      flexible
      || !!features.storefront_gallery_magazine
      || !!features.storefront_gallery_magazine_on
      || !!features.storefront_opt_gallery_magazine
    );

    return {
      enabled: mainOn,
      isFlexible: flexible,
      galleryEnabled: mainOn && (galleryGroupEnabled || allowedGalleryTypes.length > 0),
      allowedGalleryTypes,
      defaultGalleryLimit: 5,
      galleryDisplayMode: galleryMagazineEnabled ? 'magazine' : 'carousel',
      galleryCarouselEnabled: mainOn && galleryCarouselEnabled,
      galleryMagazineEnabled: mainOn && galleryMagazineEnabled,
      canUseMagazineGallery: mainOn && galleryMagazineEnabled,
      canUseGallery: mainOn && allowedGalleryTypes.length > 0,
      features,
    };
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): StorefrontGalleryState {
    return {
      enabled: false,
      isFlexible: false,
      galleryEnabled: false,
      allowedGalleryTypes: [],
      defaultGalleryLimit: 5,
      galleryDisplayMode: 'carousel',
      galleryCarouselEnabled: false,
      galleryMagazineEnabled: false,
      canUseMagazineGallery: false,
      canUseGallery: false,
      features: {},
    };
  }
}

export default StorefrontGalleryService;
