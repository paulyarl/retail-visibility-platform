/**
 * Integration Options Service
 *
 * Capability-aware service for resolving and managing integration options.
 * Determines which integrations (Clover, Square, GBP, Google Shopping, GMC)
 * are available to a tenant based on their tier capabilities.
 *
 * Pattern: Follows FeaturedOptionsService for consistency.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type IntegrationType =
  | 'clover' | 'square' | 'gbp'
  | 'google_shopping' | 'google_merchant_center' | 'gmc_sync'
  | 'propagation_gbp';

export type IntegrationGroup = 'pos' | 'google';

export const POS_INTEGRATION_TYPES: IntegrationType[] = ['clover', 'square'];
export const GOOGLE_INTEGRATION_TYPES: IntegrationType[] = ['google_shopping', 'google_merchant_center', 'gbp', 'gmc_sync'];
export const ALL_INTEGRATION_TYPES: IntegrationType[] = [
  ...POS_INTEGRATION_TYPES,
  ...GOOGLE_INTEGRATION_TYPES,
  'propagation_gbp',
];

export interface IntegrationOptionsState {
  enabled: boolean;
  posEnabled: boolean;
  googleEnabled: boolean;
  allowedPosTypes: IntegrationType[];
  allowedGoogleTypes: IntegrationType[];
  allowedTypes: IntegrationType[];
  isFlexible: boolean;
  integrationsAvailable: boolean;
  features: Record<string, boolean>;
}

export interface IntegrationTypeMeta {
  key: IntegrationType;
  label: string;
  description: string;
  group: IntegrationGroup | 'organization';
  minTier: string;
}

const INTEGRATION_TYPE_META: Record<IntegrationType, IntegrationTypeMeta> = {
  clover: { key: 'clover', label: 'Clover POS', description: 'Real-time inventory sync with Clover POS', group: 'pos', minTier: 'starter' },
  square: { key: 'square', label: 'Square POS', description: 'Real-time inventory sync with Square POS', group: 'pos', minTier: 'ecommerce' },
  gbp: { key: 'gbp', label: 'Google Business Profile', description: 'Sync inventory to Google Business Profile', group: 'google', minTier: 'ecommerce' },
  google_shopping: { key: 'google_shopping', label: 'Google Shopping', description: 'List products on Google Shopping', group: 'google', minTier: 'discovery' },
  google_merchant_center: { key: 'google_merchant_center', label: 'Google Merchant Center', description: 'Sync inventory to Google Merchant Center', group: 'google', minTier: 'discovery' },
  gmc_sync: { key: 'gmc_sync', label: 'Advanced GMC Sync', description: 'Advanced GMC sync with variant support', group: 'google', minTier: 'commitment' },
  propagation_gbp: { key: 'propagation_gbp', label: 'GBP Propagation', description: 'Propagate GBP data across organization locations', group: 'organization', minTier: 'organization' },
};

// Feature key suffix → IntegrationType mapping
const FEATURE_KEY_TO_TYPE: Record<string, IntegrationType> = {
  integration_clover: 'clover',
  integration_square: 'square',
  integration_gbp: 'gbp',
  integration_google_shopping: 'google_shopping',
  integration_google_merchant_center: 'google_merchant_center',
  integration_gmc_sync: 'gmc_sync',
  integration_propagation_gbp: 'propagation_gbp',
};

// ====================
// SERVICE
// ====================

class IntegrationOptionsService {
  private static instance: IntegrationOptionsService;

  private constructor() {}

  static getInstance(): IntegrationOptionsService {
    if (!IntegrationOptionsService.instance) {
      IntegrationOptionsService.instance = new IntegrationOptionsService();
    }
    return IntegrationOptionsService.instance;
  }

  /**
   * Resolve integration options state for a tenant from their tier capabilities.
   * Reads the integration_options capability group from the tenant's tier features.
   */
  async resolveIntegrationOptionsState(tenantId: string): Promise<IntegrationOptionsState> {
    try {
      // Fetch tenant and tier info
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
        logger.warn('[IntegrationOptionsService] Tenant not found', undefined, { tenantId });
        return this.getDisabledState();
      }

      // Collect tier keys (org + tenant, most-permissive-wins)
      const orgTierKey = tenant.organizations_list?.subscription_tier || null;
      const tenantTierKey = tenant.subscription_tier || null;
      // Proxy trial tiers to base tiers for feature resolution
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
      const intCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'integration_options' },
      });

      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          ...(intCapType
            ? { capability_type_id: intCapType.id }
            : { feature_key: { startsWith: 'integration_' } }),
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
      logger.error('[IntegrationOptionsService] Error resolving integration options state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve IntegrationOptionsState from a raw feature map.
   */
  resolveFromFeatures(features: Record<string, boolean>): IntegrationOptionsState {
    const enabled = !!features.integration_enabled;
    const disabled = !!features.integration_disabled;
    const flexible = !!features.integration_flexible;
    const posGroupEnabled = !!features.integration_pos_on || !!features.integration_pos_enabled;
    const posGroupDisabled = !!features.integration_pos_off || !!features.integration_pos_disabled;
    const googleGroupEnabled = !!features.integration_google_on || !!features.integration_google_enabled;
    const googleGroupDisabled = !!features.integration_google_off || !!features.integration_google_disabled;

    // Three states per group: enabled → all types, untouched → individual features, disabled → none
    const posEnabled = posGroupEnabled && !posGroupDisabled;
    const posUntouched = !posGroupEnabled && !posGroupDisabled;
    const googleEnabled = googleGroupEnabled && !googleGroupDisabled;
    const googleUntouched = !googleGroupEnabled && !googleGroupDisabled;

    // POS integration types
    const allowedPosTypes: IntegrationType[] = [];
    if (flexible || posEnabled) {
      allowedPosTypes.push('clover', 'square');
    } else if (posUntouched) {
      if (features.integration_clover) allowedPosTypes.push('clover');
      if (features.integration_square) allowedPosTypes.push('square');
    }

    // Google integration types
    const allowedGoogleTypes: IntegrationType[] = [];
    if (flexible || googleEnabled) {
      allowedGoogleTypes.push('google_shopping', 'google_merchant_center', 'gbp', 'gmc_sync');
    } else if (googleUntouched) {
      if (features.integration_google_shopping) allowedGoogleTypes.push('google_shopping');
      if (features.integration_google_merchant_center) allowedGoogleTypes.push('google_merchant_center');
      if (features.integration_gbp) allowedGoogleTypes.push('gbp');
      if (features.integration_gmc_sync) allowedGoogleTypes.push('gmc_sync');
    }

    const allTypes = [...allowedPosTypes, ...allowedGoogleTypes];

    // Organization-only: propagation_gbp (not part of pos/google groups)
    if (features.integration_propagation_gbp) {
      allTypes.push('propagation_gbp');
    }

    return {
      enabled: enabled && !disabled,
      posEnabled,
      googleEnabled,
      allowedPosTypes,
      allowedGoogleTypes,
      allowedTypes: allTypes,
      isFlexible: flexible,
      integrationsAvailable: enabled && !disabled && allTypes.length > 0,
      features,
    };
  }

  /**
   * Check if a specific integration type is allowed for a tenant.
   */
  async isIntegrationTypeAllowed(tenantId: string, type: IntegrationType): Promise<boolean> {
    const state = await this.resolveIntegrationOptionsState(tenantId);
    return state.enabled && state.allowedTypes.includes(type);
  }

  /**
   * Get metadata for an integration type.
   */
  getIntegrationTypeMeta(type: IntegrationType): IntegrationTypeMeta {
    return INTEGRATION_TYPE_META[type];
  }

  /**
   * Get all integration type metadata, optionally filtered by group.
   */
  getAllIntegrationTypeMeta(group?: IntegrationGroup | 'organization'): IntegrationTypeMeta[] {
    if (group === 'pos') return POS_INTEGRATION_TYPES.map(t => INTEGRATION_TYPE_META[t]);
    if (group === 'google') return GOOGLE_INTEGRATION_TYPES.map(t => INTEGRATION_TYPE_META[t]);
    if (group === 'organization') return [INTEGRATION_TYPE_META.propagation_gbp];
    return ALL_INTEGRATION_TYPES.map(t => INTEGRATION_TYPE_META[t]);
  }

  /**
   * Check if an integration type is POS.
   */
  isPosIntegration(type: IntegrationType): boolean {
    return POS_INTEGRATION_TYPES.includes(type);
  }

  /**
   * Check if an integration type is Google.
   */
  isGoogleIntegration(type: IntegrationType): boolean {
    return GOOGLE_INTEGRATION_TYPES.includes(type);
  }

  /**
   * Map a feature key to an integration type.
   */
  getIntegrationTypeFromFeatureKey(featureKey: string): IntegrationType | null {
    return FEATURE_KEY_TO_TYPE[featureKey] || null;
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): IntegrationOptionsState {
    return {
      enabled: false,
      posEnabled: false,
      googleEnabled: false,
      allowedPosTypes: [],
      allowedGoogleTypes: [],
      allowedTypes: [],
      isFlexible: false,
      integrationsAvailable: false,
      features: {},
    };
  }
}

export default IntegrationOptionsService;
