/**
 * Storefront QR Service
 *
 * Capability-aware service for resolving and managing QR code features.
 * Extracted from StorefrontOptionsService.ts.
 *
 * Feature prefix: storefront_qr_ (new namespace)
 * Fallback prefix: storefront_opt_qr_ (old namespace, for backward compat)
 *
 * Gate hierarchy:
 *   storefront_qr (main gate - hard)
 *   ├── Classic QR (sub-group) → qr_codes_512/1024/2048, qr_product/store/logo/directory
 *   ├── Styled QR (sub-group) → dot styles, corner styles, custom colors, gradients
 *   └── storefront_qr_flexible (master gate - unlocks all)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type StorefrontOptQRResolutionType = 'qr_codes_512' | 'qr_codes_1024' | 'qr_codes_2048';
export type StorefrontOptQRContentType = 'qr_product' | 'qr_store' | 'qr_logo' | 'qr_directory';
export type StorefrontOptQRDotStyleType = 'rounded' | 'dots' | 'classy' | 'classy-rounded' | 'extra-rounded';
export type StorefrontOptQRCornerStyleType = 'dot' | 'extra-rounded' | 'rounded';

export const QR_RESOLUTION_TYPES: StorefrontOptQRResolutionType[] = ['qr_codes_512', 'qr_codes_1024', 'qr_codes_2048'];
export const QR_CONTENT_TYPES: StorefrontOptQRContentType[] = ['qr_product', 'qr_store', 'qr_logo', 'qr_directory'];
export const QR_DOT_STYLES: StorefrontOptQRDotStyleType[] = ['rounded', 'dots', 'classy', 'classy-rounded', 'extra-rounded'];
export const QR_CORNER_STYLES: StorefrontOptQRCornerStyleType[] = ['dot', 'extra-rounded', 'rounded'];

export interface StorefrontQrState {
  enabled: boolean;
  isFlexible: boolean;
  // QR Code Display group
  qrEnabled: boolean;
  allowedQRResolutions: StorefrontOptQRResolutionType[];
  allowedQRContentTypes: StorefrontOptQRContentType[];
  // Classic QR sub-group
  qrClassicEnabled: boolean;
  // Styled QR sub-group
  qrStyledEnabled: boolean;
  allowedQRDotStyles: StorefrontOptQRDotStyleType[];
  allowedQRCornerStyles: StorefrontOptQRCornerStyleType[];
  qrCustomColors: boolean;
  qrGradients: boolean;
  // Convenience flags
  canUseQRCodes: boolean;
  // Raw features
  features: Record<string, boolean>;
}

// ====================
// SERVICE
// ====================

class StorefrontQrService {
  private static instance: StorefrontQrService;

  private constructor() {}

  static getInstance(): StorefrontQrService {
    if (!StorefrontQrService.instance) {
      StorefrontQrService.instance = new StorefrontQrService();
    }
    return StorefrontQrService.instance;
  }

  /**
   * Resolve storefront QR state for a tenant from their tier capabilities.
   * Checks new storefront_qr_* keys first, then falls back to old storefront_opt_qr_* keys.
   */
  async resolveStorefrontQrState(tenantId: string): Promise<StorefrontQrState> {
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
        logger.warn('[StorefrontQrService] Tenant not found', undefined, { tenantId });
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

      // Query new storefront_qr capability type
      const sfQrCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_qr' },
      });

      // Also query old storefront_options for fallback
      const sfOptCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'storefront_options' },
      });

      const [qrFeatures, optFeatures] = await Promise.all([
        sfQrCapType
          ? prisma.tier_features_list.findMany({
              where: {
                tier_id: { in: tierIds },
                capability_type_id: sfQrCapType.id,
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
                feature_key: { startsWith: 'storefront_opt_qr' },
              },
            })
          : Promise.resolve([]),
      ]);

      // Merge new + old features
      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of [...qrFeatures, ...optFeatures]) {
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
      logger.error('[StorefrontQrService] Error resolving storefront QR state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve StorefrontQrState from a raw feature map.
   * Features include both new storefront_qr_* and old storefront_opt_qr_* keys.
   */
  resolveFromFeatures(features: Record<string, boolean>): StorefrontQrState {
    const disabled = !!features.storefront_qr_disabled || !!features.storefront_opt_disabled;
    const enabled = !disabled && (!!features.storefront_qr_enabled || !!features.storefront_opt_enabled);
    const flexible = !!features.storefront_qr_flexible || !!features.storefront_opt_flexible;
    const mainOn = enabled;

    // QR group — new keys with fallback to old storefront_opt_qr_* keys
    const qrGroupEnabled = flexible
      || !!features.storefront_qr_on || !!features.storefront_qr || !!features.storefront_qr_enabled
      || !!features.storefront_opt_qr_on || !!features.storefront_opt_qr || !!features.storefront_opt_qr_enabled;

    // QR resolutions
    const allowedQRResolutions: StorefrontOptQRResolutionType[] = [];
    if (qrGroupEnabled) {
      if (flexible
        || features.storefront_qr_on || features.storefront_qr || features.storefront_qr_enabled
        || features.storefront_qr_resolution
        || features.storefront_opt_qr_on || features.storefront_opt_qr || features.storefront_opt_qr_enabled
        || features.storefront_opt_qr_resolution
      ) {
        allowedQRResolutions.push('qr_codes_512', 'qr_codes_1024', 'qr_codes_2048');
      } else {
        if (features.storefront_qr_resolution_512 || features.storefront_opt_qr_codes_512) allowedQRResolutions.push('qr_codes_512');
        if (features.storefront_qr_resolution_1024 || features.storefront_opt_qr_codes_1024) allowedQRResolutions.push('qr_codes_1024');
        if (features.storefront_qr_resolution_2048 || features.storefront_opt_qr_codes_2048) allowedQRResolutions.push('qr_codes_2048');
      }
    }

    // QR content types
    const allowedQRContentTypes: StorefrontOptQRContentType[] = [];
    if (qrGroupEnabled) {
      if (flexible
        || features.storefront_qr_on || features.storefront_qr || features.storefront_qr_enabled
        || features.storefront_qr_content
        || features.storefront_opt_qr_on || features.storefront_opt_qr || features.storefront_opt_qr_enabled
        || features.storefront_opt_qr_content
      ) {
        allowedQRContentTypes.push('qr_product', 'qr_store', 'qr_logo', 'qr_directory');
      } else {
        if (features.storefront_qr_product || features.storefront_opt_qr_product) allowedQRContentTypes.push('qr_product');
        if (features.storefront_qr_store || features.storefront_opt_qr_store) allowedQRContentTypes.push('qr_store');
        if (features.storefront_qr_logo || features.storefront_opt_qr_logo) allowedQRContentTypes.push('qr_logo');
        if (features.storefront_qr_directory || features.storefront_opt_qr_directory) allowedQRContentTypes.push('qr_directory');
      }
    }

    // Classic QR sub-group
    const qrClassicEnabled = mainOn && (flexible
      || !!features.storefront_qr_classic || !!features.storefront_qr_classic_on
      || !!features.storefront_qr_enabled
      || !!features.storefront_opt_qr_on || !!features.storefront_opt_qr
      || !!features.storefront_opt_qr_enabled);

    // Styled QR sub-group
    const qrStyledOn = flexible
      || !!features.storefront_qr_styled
      || !!features.storefront_qr_styled_on
      || (!!features.storefront_qr_styled_enabled && !features.storefront_qr_styled_disabled)
      || !!features.storefront_opt_qr_styled
      || !!features.storefront_opt_qr_styled_on
      || (!!features.storefront_opt_qr_styled_enabled && !features.storefront_opt_qr_styled_disabled);
    const qrStyledOff = !!features.storefront_qr_styled_off || !!features.storefront_qr_styled_disabled
      || !!features.storefront_opt_qr_styled_off || !!features.storefront_opt_qr_styled_disabled;
    const qrStyledEnabled = mainOn && qrStyledOn && !qrStyledOff;

    // Dot styles
    const allowedQRDotStyles: StorefrontOptQRDotStyleType[] = [];
    if (qrStyledEnabled && (flexible
      || features.storefront_qr_dot_styles || features.storefront_qr_dot_styles_on
      || features.storefront_opt_qr_dot_styles || features.storefront_opt_qr_dot_styles_on
    )) {
      allowedQRDotStyles.push('rounded', 'dots', 'classy', 'classy-rounded', 'extra-rounded');
    } else if (qrStyledEnabled) {
      if (features.storefront_qr_dot_rounded || features.storefront_opt_qr_dot_rounded) allowedQRDotStyles.push('rounded');
      if (features.storefront_qr_dot_dots || features.storefront_opt_qr_dot_dots) allowedQRDotStyles.push('dots');
      if (features.storefront_qr_dot_classy || features.storefront_opt_qr_dot_classy) allowedQRDotStyles.push('classy');
      if (features.storefront_qr_dot_classy_rounded || features.storefront_opt_qr_dot_classy_rounded) allowedQRDotStyles.push('classy-rounded');
      if (features.storefront_qr_dot_extra_rounded || features.storefront_opt_qr_dot_extra_rounded) allowedQRDotStyles.push('extra-rounded');
    }

    // Corner styles
    const allowedQRCornerStyles: StorefrontOptQRCornerStyleType[] = [];
    if (qrStyledEnabled && (flexible
      || features.storefront_qr_corner_styles || features.storefront_qr_corner_styles_on
      || features.storefront_opt_qr_corner_styles || features.storefront_opt_qr_corner_styles_on
    )) {
      allowedQRCornerStyles.push('dot', 'extra-rounded', 'rounded');
    } else if (qrStyledEnabled) {
      if (features.storefront_qr_corner_dot || features.storefront_opt_qr_corner_dot) allowedQRCornerStyles.push('dot');
      if (features.storefront_qr_corner_extra_rounded || features.storefront_opt_qr_corner_extra_rounded) allowedQRCornerStyles.push('extra-rounded');
      if (features.storefront_qr_corner_rounded || features.storefront_opt_qr_corner_rounded) allowedQRCornerStyles.push('rounded');
    }

    const qrCustomColors = qrStyledEnabled && (flexible
      || !!features.storefront_qr_custom_colors
      || !!features.storefront_opt_qr_custom_colors);
    const qrGradients = qrStyledEnabled && (flexible
      || !!features.storefront_qr_gradients
      || !!features.storefront_opt_qr_gradients);

    return {
      enabled: mainOn,
      isFlexible: flexible,
      qrEnabled: mainOn && (qrGroupEnabled || allowedQRResolutions.length > 0 || allowedQRContentTypes.length > 0),
      allowedQRResolutions,
      allowedQRContentTypes,
      qrClassicEnabled,
      qrStyledEnabled,
      allowedQRDotStyles,
      allowedQRCornerStyles,
      qrCustomColors,
      qrGradients,
      canUseQRCodes: mainOn && (allowedQRResolutions.length > 0 || allowedQRContentTypes.length > 0),
      features,
    };
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): StorefrontQrState {
    return {
      enabled: false,
      isFlexible: false,
      qrEnabled: false,
      allowedQRResolutions: [],
      allowedQRContentTypes: [],
      qrClassicEnabled: false,
      qrStyledEnabled: false,
      allowedQRDotStyles: [],
      allowedQRCornerStyles: [],
      qrCustomColors: false,
      qrGradients: false,
      canUseQRCodes: false,
      features: {},
    };
  }
}

export default StorefrontQrService;
