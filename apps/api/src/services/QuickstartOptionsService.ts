/**
 * Quickstart Options Service
 *
 * Capability-aware service for resolving and managing quickstart options.
 * Determines which quickstart features (product wizard, category generator, AI models)
 * are available to a tenant based on their tier capabilities.
 *
 * Gate hierarchy:
 *   quickstart (main gate - hard)
 *   ├── quickstart product (feature gate) → wizard, image_gen
 *   ├── quickstart AI (feature gate) → ai_openai, ai_gemini, wizard_ai, image_hd
 *   ├── quickstart category (feature gate) → category_generator
 *   └── quickstart flexible (master gate - unlocks all)
 *
 * Cross-group dependencies:
 *   - wizard_ai (AI group) requires product feature gate (it generates products)
 *   - image_hd (AI group) requires image_gen from product group (HD only if images attached)
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type QuickstartProductType = 'wizard' | 'image_gen';
export type QuickstartCategoryType = 'category_generator';
export type QuickstartAIType = 'ai_openai' | 'ai_gemini' | 'wizard_ai' | 'image_hd';

export const PRODUCT_QUICKSTART_TYPES: QuickstartProductType[] = ['wizard', 'image_gen'];
export const CATEGORY_QUICKSTART_TYPES: QuickstartCategoryType[] = ['category_generator'];
export const AI_QUICKSTART_TYPES: QuickstartAIType[] = ['ai_openai', 'ai_gemini', 'wizard_ai', 'image_hd'];

export interface QuickstartOptionsState {
  enabled: boolean;
  isFlexible: boolean;
  // Product group
  productEnabled: boolean;
  allowedProductTypes: QuickstartProductType[];
  // Category group
  categoryEnabled: boolean;
  allowedCategoryTypes: QuickstartCategoryType[];
  // AI group
  aiEnabled: boolean;
  allowedAITypes: QuickstartAIType[];
  // Convenience flags
  canUseWizard: boolean;
  canUseAIWizard: boolean;
  canUseCategoryGenerator: boolean;
  canUseOpenAI: boolean;
  canUseGemini: boolean;
  canGenerateImages: boolean;
  canUseHDImages: boolean;
  // Raw features
  features: Record<string, boolean>;
}

export interface QuickstartTypeMeta {
  key: string;
  label: string;
  description: string;
  group: 'product' | 'category' | 'ai';
}

const QUICKSTART_TYPE_META: Record<string, QuickstartTypeMeta> = {
  wizard: { key: 'wizard', label: 'Product Quick Start', description: 'Static template-based product generation', group: 'product' },
  image_gen: { key: 'image_gen', label: 'Image Generation', description: 'Attach images to products during generation (cached or AI)', group: 'product' },
  category_generator: { key: 'category_generator', label: 'Category Quick Start', description: 'Template-based category creation', group: 'category' },
  ai_openai: { key: 'ai_openai', label: 'OpenAI', description: 'GPT-4 text and DALL-E 3 image models', group: 'ai' },
  ai_gemini: { key: 'ai_gemini', label: 'Google Gemini', description: 'Gemini text and Imagen 3 image models', group: 'ai' },
  wizard_ai: { key: 'wizard_ai', label: 'AI Product Quick Start', description: 'AI-powered product generation', group: 'ai' },
  image_hd: { key: 'image_hd', label: 'HD Image Quality', description: 'High-definition AI-generated photos (requires image gen)', group: 'ai' },
};

// ====================
// SERVICE
// ====================

class QuickstartOptionsService {
  private static instance: QuickstartOptionsService;

  private constructor() {}

  static getInstance(): QuickstartOptionsService {
    if (!QuickstartOptionsService.instance) {
      QuickstartOptionsService.instance = new QuickstartOptionsService();
    }
    return QuickstartOptionsService.instance;
  }

  /**
   * Resolve quickstart options state for a tenant from their tier capabilities.
   * Reads the quickstart_options capability group from the tenant's tier features.
   */
  async resolveQuickstartOptionsState(tenantId: string): Promise<QuickstartOptionsState> {
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
        logger.warn('[QuickstartOptionsService] Tenant not found', undefined, { tenantId });
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
      const qsCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'quickstart_options' },
      });

      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          ...(qsCapType
            ? { capability_type_id: qsCapType.id }
            : { feature_key: { startsWith: 'quickstart_' } }),
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
      logger.error('[QuickstartOptionsService] Error resolving quickstart options state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve QuickstartOptionsState from a raw feature map.
   */
  resolveFromFeatures(features: Record<string, boolean>): QuickstartOptionsState {
    const enabled = !!features.quickstart_enabled;
    const disabled = !!features.quickstart_disabled;
    const flexible = !!features.quickstart_flexible;

    // --- Product feature gate ---
    // Gates: wizard (static product wizard), image_gen (attach image to product)
    const productGroupEnabled = !!features.quickstart_product_enabled;
    const productGroupDisabled = !!features.quickstart_product_disabled;
    const productEnabled = productGroupEnabled && !productGroupDisabled;
    const productUntouched = !productGroupEnabled && !productGroupDisabled;

    const allowedProductTypes: QuickstartProductType[] = [];
    if (flexible || productEnabled) {
      allowedProductTypes.push('wizard', 'image_gen');
    } else if (productUntouched) {
      if (features.quickstart_wizard) allowedProductTypes.push('wizard');
      if (features.quickstart_image_gen) allowedProductTypes.push('image_gen');
    }

    // --- Category feature gate ---
    // Gates: category_generator
    const categoryGroupEnabled = !!features.quickstart_category_enabled;
    const categoryGroupDisabled = !!features.quickstart_category_disabled;
    const categoryEnabled = categoryGroupEnabled && !categoryGroupDisabled;
    const categoryUntouched = !categoryGroupEnabled && !categoryGroupDisabled;

    const allowedCategoryTypes: QuickstartCategoryType[] = [];
    if (flexible || categoryEnabled) {
      allowedCategoryTypes.push('category_generator');
    } else if (categoryUntouched) {
      if (features.quickstart_category_generator) allowedCategoryTypes.push('category_generator');
    }

    // --- AI feature gate ---
    // Gates: ai_openai, ai_gemini, wizard_ai (AI wizard), image_hd (HD quality)
    const aiGroupEnabled = !!features.quickstart_ai_enabled;
    const aiGroupDisabled = !!features.quickstart_ai_disabled;
    const aiGroupOn = aiGroupEnabled && !aiGroupDisabled;
    const aiUntouched = !aiGroupEnabled && !aiGroupDisabled;

    const allowedAITypes: QuickstartAIType[] = [];
    if (flexible || aiGroupOn) {
      allowedAITypes.push('ai_openai', 'ai_gemini', 'wizard_ai', 'image_hd');
    } else if (aiUntouched) {
      if (features.quickstart_ai_openai) allowedAITypes.push('ai_openai');
      if (features.quickstart_ai_gemini) allowedAITypes.push('ai_gemini');
      if (features.quickstart_wizard_ai) allowedAITypes.push('wizard_ai');
      if (features.quickstart_image_hd) allowedAITypes.push('image_hd');
    }

    // aiEnabled = group flag OR any individual AI type allowed
    const aiEnabled = (aiGroupOn || allowedAITypes.length > 0) && !aiGroupDisabled;

    // --- Cross-group dependencies ---
    // wizard_ai (AI group) requires product feature gate — it generates products
    const hasAIModel = allowedAITypes.includes('ai_openai') || allowedAITypes.includes('ai_gemini');
    const effectivelyCanUseAIWizard = allowedAITypes.includes('wizard_ai') && productEnabled && hasAIModel;
    // image_hd (AI group) requires image_gen from product group — HD only if images are attached
    const effectivelyCanUseHDImages = allowedAITypes.includes('image_hd') && allowedProductTypes.includes('image_gen');

    return {
      enabled: enabled && !disabled,
      isFlexible: flexible,
      productEnabled,
      allowedProductTypes,
      categoryEnabled,
      allowedCategoryTypes,
      aiEnabled,
      allowedAITypes,
      // Convenience flags
      canUseWizard: enabled && !disabled && allowedProductTypes.includes('wizard'),
      canGenerateImages: enabled && !disabled && allowedProductTypes.includes('image_gen'),
      canUseAIWizard: enabled && !disabled && effectivelyCanUseAIWizard,
      canUseCategoryGenerator: enabled && !disabled && allowedCategoryTypes.includes('category_generator'),
      canUseOpenAI: enabled && !disabled && allowedAITypes.includes('ai_openai'),
      canUseGemini: enabled && !disabled && allowedAITypes.includes('ai_gemini'),
      canUseHDImages: enabled && !disabled && effectivelyCanUseHDImages,
      features,
    };
  }

  /**
   * Check if a specific quickstart type is allowed for a tenant.
   */
  async isQuickstartTypeAllowed(tenantId: string, type: QuickstartProductType | QuickstartCategoryType | QuickstartAIType): Promise<boolean> {
    const state = await this.resolveQuickstartOptionsState(tenantId);
    if (!state.enabled) return false;

    if (PRODUCT_QUICKSTART_TYPES.includes(type as QuickstartProductType)) {
      return state.allowedProductTypes.includes(type as QuickstartProductType);
    }
    if (CATEGORY_QUICKSTART_TYPES.includes(type as QuickstartCategoryType)) {
      return state.allowedCategoryTypes.includes(type as QuickstartCategoryType);
    }
    if (AI_QUICKSTART_TYPES.includes(type as QuickstartAIType)) {
      return state.allowedAITypes.includes(type as QuickstartAIType);
    }
    return false;
  }

  /**
   * Get metadata for a quickstart type.
   */
  getQuickstartTypeMeta(type: string): QuickstartTypeMeta | undefined {
    return QUICKSTART_TYPE_META[type];
  }

  /**
   * Get all quickstart type metadata, optionally filtered by group.
   */
  getAllQuickstartTypeMeta(group?: 'product' | 'category' | 'ai'): QuickstartTypeMeta[] {
    const types = group === 'product' ? PRODUCT_QUICKSTART_TYPES
      : group === 'category' ? CATEGORY_QUICKSTART_TYPES
      : group === 'ai' ? AI_QUICKSTART_TYPES
      : [...PRODUCT_QUICKSTART_TYPES, ...CATEGORY_QUICKSTART_TYPES, ...AI_QUICKSTART_TYPES];
    return types.map(t => QUICKSTART_TYPE_META[t]).filter(Boolean);
  }

  /**
   * Return a disabled state (used when tenant not found or error).
   */
  private getDisabledState(): QuickstartOptionsState {
    return {
      enabled: false,
      isFlexible: false,
      productEnabled: false,
      allowedProductTypes: [],
      categoryEnabled: false,
      allowedCategoryTypes: [],
      aiEnabled: false,
      allowedAITypes: [],
      canUseWizard: false,
      canUseAIWizard: false,
      canUseCategoryGenerator: false,
      canUseOpenAI: false,
      canUseGemini: false,
      canGenerateImages: false,
      canUseHDImages: false,
      features: {},
    };
  }
}

export default QuickstartOptionsService;
