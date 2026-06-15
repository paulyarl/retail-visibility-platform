/**
 * Product Options Service
 *
 * Capability-aware service for resolving and managing product options.
 * Determines which product types (physical, digital, hybrid, service)
 * and features (variant, gallery, video) are available to a tenant
 * based on their tier capabilities.
 *
 * Pattern: Follows FeaturedOptionsService for consistency.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type ProductType = 'physical' | 'digital' | 'hybrid' | 'service';
export type ProductLayoutType = 'classic' | 'editorial' | 'immersive';

export interface ProductOptionsState {
  enabled: boolean;
  allowedTypes: ProductType[];
  showsVariants: boolean;
  showsGallery: boolean;
  showsVideo: boolean;
  isFlexible: boolean;
  // Product page layout group
  layoutEnabled: boolean;
  allowedLayouts: ProductLayoutType[];
  canUseLayoutClassic: boolean;
  canUseLayoutEditorial: boolean;
  canUseLayoutImmersive: boolean;
  // Product page section group
  showsRecentlyViewed: boolean;
  showsQRCodes: boolean;
  showsRecommended: boolean;
  showsMapDisplay: boolean;
  showsLocationDisplay: boolean;
  showsHoursDisplay: boolean;
  showsEnhancedSEO: boolean;
  showsReviews: boolean;
  showsFulfillment: boolean;
  showsCategories: boolean;
  showsLocationAvailability: boolean;
  features: Record<string, boolean>;
}

// ====================
// SERVICE
// ====================

class ProductOptionsService {
  private static instance: ProductOptionsService;

  private constructor() {}

  static getInstance(): ProductOptionsService {
    if (!ProductOptionsService.instance) {
      ProductOptionsService.instance = new ProductOptionsService();
    }
    return ProductOptionsService.instance;
  }

  /**
   * Resolve product options state for a tenant from their tier capabilities.
   * Reads the product_options capability group from the tenant's tier features.
   */
  async resolveProductOptionsState(tenantId: string): Promise<ProductOptionsState> {
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
        logger.warn('[ProductOptionsService] Tenant not found', undefined, { tenantId });
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
      const prodCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'product_options' },
      });

      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          ...(prodCapType
            ? { capability_type_id: prodCapType.id }
            : { feature_key: { startsWith: 'product_' } }),
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
      logger.error('[ProductOptionsService] Error resolving product options state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve ProductOptionsState from a raw feature map.
   * Mirrors the frontend resolveProductOptionsState logic.
   */
  resolveFromFeatures(features: Record<string, boolean>): ProductOptionsState {
    const enabled = !!features.product_enabled;
    const disabled = !!features.product_disabled;
    const flexible = !!features.product_flexible;
    const physical = !!features.product_physical;
    const digital = !!features.product_digital;
    const hybrid = !!features.product_hybrid;
    const service = !!features.product_service;
    const variant = !!features.product_variant;
    const gallery = !!features.product_gallery;
    const video = !!features.product_video;

    // Compute allowed types from feature gates
    const allowedTypes: ProductType[] = [];
    if (flexible || physical) allowedTypes.push('physical');
    if (flexible || digital) allowedTypes.push('digital');
    if (flexible || hybrid) allowedTypes.push('hybrid');
    if (flexible || service) allowedTypes.push('service');

    // Product page layout feature gates
    const layoutClassic = !!features.product_layout_classic;
    const layoutEditorial = !!features.product_layout_editorial;
    const layoutImmersive = !!features.product_layout_immersive;

    const allowedLayouts: ProductLayoutType[] = [];
    if (flexible || layoutClassic) allowedLayouts.push('classic');
    if (flexible || layoutEditorial) allowedLayouts.push('editorial');
    if (flexible || layoutImmersive) allowedLayouts.push('immersive');

    // Product page section feature gates
    const showsRecentlyViewed = flexible || !!features.product_opt_recently_viewed;
    const showsQRCodes = flexible || !!features.product_opt_qr_codes;
    const showsRecommended = flexible || !!features.product_opt_recommended;
    const showsMapDisplay = flexible || !!features.product_opt_map_display;
    const showsLocationDisplay = flexible || !!features.product_opt_location_display;
    const showsHoursDisplay = flexible || !!features.product_opt_hours_display;
    const showsEnhancedSEO = flexible || !!features.product_opt_enhanced_seo;
    const showsReviews = flexible || !!features.product_opt_reviews;
    const showsFulfillment = flexible || !!features.product_opt_fulfillment;
    const showsCategories = flexible || !!features.product_opt_categories;
    const showsLocationAvailability = flexible || !!features.product_opt_location_availability;

    return {
      enabled: enabled && !disabled,
      allowedTypes,
      showsVariants: flexible || variant,
      showsGallery: flexible || gallery,
      showsVideo: flexible || video,
      isFlexible: flexible,
      layoutEnabled: allowedLayouts.length > 0,
      allowedLayouts,
      canUseLayoutClassic: flexible || layoutClassic,
      canUseLayoutEditorial: flexible || layoutEditorial,
      canUseLayoutImmersive: flexible || layoutImmersive,
      showsRecentlyViewed,
      showsQRCodes,
      showsRecommended,
      showsMapDisplay,
      showsLocationDisplay,
      showsHoursDisplay,
      showsEnhancedSEO,
      showsReviews,
      showsFulfillment,
      showsCategories,
      showsLocationAvailability,
      features,
    };
  }

  /**
   * Check if a specific product type is allowed for a tenant.
   */
  async isProductTypeAllowed(tenantId: string, type: ProductType): Promise<boolean> {
    const state = await this.resolveProductOptionsState(tenantId);
    return state.enabled && state.allowedTypes.includes(type);
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): ProductOptionsState {
    return {
      enabled: false,
      allowedTypes: [],
      showsVariants: false,
      showsGallery: false,
      showsVideo: false,
      isFlexible: false,
      layoutEnabled: false,
      allowedLayouts: [],
      canUseLayoutClassic: false,
      canUseLayoutEditorial: false,
      canUseLayoutImmersive: false,
      showsRecentlyViewed: false,
      showsQRCodes: false,
      showsRecommended: false,
      showsMapDisplay: false,
      showsLocationDisplay: false,
      showsHoursDisplay: false,
      showsEnhancedSEO: false,
      showsReviews: false,
      showsFulfillment: false,
      showsCategories: false,
      showsLocationAvailability: false,
      features: {},
    };
  }
}

export default ProductOptionsService;
