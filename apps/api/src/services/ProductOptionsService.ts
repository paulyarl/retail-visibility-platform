/**
 * Product Options Service
 *
 * Capability-aware service for resolving and managing product options.
 * Determines which display/behavior features (variant, gallery, video,
 * layouts, sections) are available to a tenant based on their tier capabilities.
 *
 * Type gating (physical/digital/hybrid/service) is handled by ProductTypeService.
 *
 * Pattern: Follows StorefrontOptionsService for group-gated consistency.
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
  // Creation group
  creationEnabled: boolean;
  showsVariants: boolean;
  showsGallery: boolean;
  showsVideo: boolean;
  isFlexible: boolean;
  // Layout group
  layoutEnabled: boolean;
  allowedLayouts: ProductLayoutType[];
  canUseLayoutClassic: boolean;
  canUseLayoutEditorial: boolean;
  canUseLayoutImmersive: boolean;
  // Sections group
  sectionsEnabled: boolean;
  showsRecentlyViewed: boolean;
  showsQRCodes: boolean;
  showsQRLogo: boolean;
  showsRecommended: boolean;
  showsMapDisplay: boolean;
  showsLocationDisplay: boolean;
  showsHoursDisplay: boolean;
  showsEnhancedSEO: boolean;
  showsReviews: boolean;
  showsFulfillment: boolean;
  showsCategories: boolean;
  showsLocationAvailability: boolean;
  showsSupplierCatalog: boolean;
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
    // ── Master gates (R17: disabled > enabled > flexible > features) ──
    const masterDisabled = !!features.product_options_disabled;
    const masterEnabled = !!features.product_options_enabled;
    const flexible = !!features.product_options_flexible;

    const hasAnyFeature = hasAnyOptFeature(features);
    const enabled = masterDisabled
      ? false
      : masterEnabled
        ? true
        : flexible
          ? true
          : hasAnyFeature;

    const isFlexible = flexible;

    // ── Creation group (R16) ──
    const creationGroupEnabled = !!features.product_options_creation_enabled;
    const creationGroupDisabled = !!features.product_options_creation_disabled;
    const showsVariants = isFlexible || creationGroupEnabled || !!features.product_options_creation_variants;
    const showsGallery = isFlexible || creationGroupEnabled || !!features.product_options_creation_gallery;
    const showsVideo = isFlexible || creationGroupEnabled || !!features.product_options_creation_video;
    const showsSupplierCatalog = isFlexible || creationGroupEnabled || !!features.product_options_creation_supplier_catalog;
    const creationEnabled = !creationGroupDisabled && (isFlexible || creationGroupEnabled || showsVariants || showsGallery || showsVideo || showsSupplierCatalog);

    // ── Layout group (R16) ──
    const layoutGroupEnabled = !!features.product_options_layout_enabled;
    const layoutGroupDisabled = !!features.product_options_layout_disabled;
    const layoutEnabled = !layoutGroupDisabled && (isFlexible || layoutGroupEnabled);

    const allowedLayouts: ProductLayoutType[] = [];
    if (isFlexible || (layoutEnabled && !layoutGroupDisabled)) {
      if (isFlexible || layoutGroupEnabled) {
        allowedLayouts.push('classic', 'editorial', 'immersive');
      } else {
        if (features.product_options_layout_classic) allowedLayouts.push('classic');
        if (features.product_options_layout_editorial) allowedLayouts.push('editorial');
        if (features.product_options_layout_immersive) allowedLayouts.push('immersive');
      }
    }

    // ── Sections group (R16) ──
    const sectionsGroupEnabled = !!features.product_options_sections_enabled;
    const sectionsGroupDisabled = !!features.product_options_sections_disabled;
    const sectionsEnabled = !sectionsGroupDisabled && (isFlexible || sectionsGroupEnabled || hasAnySectionFeature(features));

    const showsRecentlyViewed = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_recently_viewed;
    const showsQRCodes = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_qr_codes;
    const showsQRLogo = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_qr_logo;
    const showsRecommended = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_recommended;
    const showsMapDisplay = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_map_display;
    const showsLocationDisplay = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_location_display;
    const showsHoursDisplay = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_hours_display;
    const showsEnhancedSEO = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_enhanced_seo;
    const showsReviews = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_reviews;
    const showsFulfillment = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_fulfillment;
    const showsCategories = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_categories;
    const showsLocationAvailability = isFlexible || sectionsGroupEnabled || !!features.product_options_sections_location_availability;

    return {
      enabled,
      creationEnabled,
      showsVariants,
      showsGallery,
      showsVideo,
      isFlexible,
      layoutEnabled,
      allowedLayouts,
      canUseLayoutClassic: allowedLayouts.includes('classic'),
      canUseLayoutEditorial: allowedLayouts.includes('editorial'),
      canUseLayoutImmersive: allowedLayouts.includes('immersive'),
      sectionsEnabled,
      showsRecentlyViewed,
      showsQRCodes,
      showsQRLogo,
      showsRecommended,
      showsMapDisplay,
      showsLocationDisplay,
      showsHoursDisplay,
      showsEnhancedSEO,
      showsReviews,
      showsFulfillment,
      showsCategories,
      showsLocationAvailability,
      showsSupplierCatalog,
      features,
    };
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): ProductOptionsState {
    return {
      enabled: false,
      creationEnabled: false,
      showsVariants: false,
      showsGallery: false,
      showsVideo: false,
      isFlexible: false,
      layoutEnabled: false,
      allowedLayouts: [],
      canUseLayoutClassic: false,
      canUseLayoutEditorial: false,
      canUseLayoutImmersive: false,
      sectionsEnabled: false,
      showsRecentlyViewed: false,
      showsQRCodes: false,
      showsQRLogo: false,
      showsRecommended: false,
      showsMapDisplay: false,
      showsLocationDisplay: false,
      showsHoursDisplay: false,
      showsEnhancedSEO: false,
      showsReviews: false,
      showsFulfillment: false,
      showsCategories: false,
      showsLocationAvailability: false,
      showsSupplierCatalog: false,
      features: {},
    };
  }
}

function hasAnyOptFeature(features: Record<string, boolean>): boolean {
  return !!(
    features.product_options_creation_variants ||
    features.product_options_creation_gallery ||
    features.product_options_creation_video ||
    features.product_options_layout_classic ||
    features.product_options_layout_editorial ||
    features.product_options_layout_immersive ||
    features.product_options_sections_recently_viewed ||
    features.product_options_sections_qr_codes ||
    features.product_options_sections_recommended
  );
}

function hasAnySectionFeature(features: Record<string, boolean>): boolean {
  return !!(
    features.product_options_sections_recently_viewed ||
    features.product_options_sections_qr_codes ||
    features.product_options_sections_qr_logo ||
    features.product_options_sections_recommended ||
    features.product_options_sections_map_display ||
    features.product_options_sections_location_display ||
    features.product_options_sections_hours_display ||
    features.product_options_sections_enhanced_seo ||
    features.product_options_sections_reviews ||
    features.product_options_sections_fulfillment ||
    features.product_options_sections_categories ||
    features.product_options_sections_location_availability
  );
}

export default ProductOptionsService;
