/**
 * FAQ Options Service
 *
 * Capability-aware service for resolving and managing FAQ options.
 * Determines which FAQ features are available to a tenant based on their tier capabilities.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type FaqManagementType =
  | 'faq_management_hub'
  | 'faq_management_templates'
  | 'faq_management_import'
  | 'faq_management_wizard_inline'
  | 'faq_management_bulk_actions'
  | 'faq_management_reorder'
  | 'faq_management_search';

export type FaqPreviewType =
  | 'faq_preview_bot'
  | 'faq_preview_gap_report'
  | 'faq_preview_auto_suggest';

export type FaqDisplayType =
  | 'faq_display_storefront_accordion'
  | 'faq_display_product_accordion'
  | 'faq_display_search_overlay'
  | 'faq_display_feedback'
  | 'faq_display_bot_handoff'
  | 'faq_display_markdown'
  | 'faq_display_deep_link';

export type FaqKnowledgeBaseType =
  | 'faq_kb_static_lookup'
  | 'faq_kb_rag_retrieval'
  | 'faq_kb_product_scoped'
  | 'faq_kb_auto_sync'
  | 'faq_kb_coverage_metrics';

export const ALL_FAQ_MANAGEMENT_TYPES: FaqManagementType[] = [
  'faq_management_hub',
  'faq_management_templates',
  'faq_management_import',
  'faq_management_wizard_inline',
  'faq_management_bulk_actions',
  'faq_management_reorder',
  'faq_management_search',
];

export const ALL_FAQ_PREVIEW_TYPES: FaqPreviewType[] = [
  'faq_preview_bot',
  'faq_preview_gap_report',
  'faq_preview_auto_suggest',
];

export const ALL_FAQ_DISPLAY_TYPES: FaqDisplayType[] = [
  'faq_display_storefront_accordion',
  'faq_display_product_accordion',
  'faq_display_search_overlay',
  'faq_display_feedback',
  'faq_display_bot_handoff',
  'faq_display_markdown',
  'faq_display_deep_link',
];

export const ALL_FAQ_KB_TYPES: FaqKnowledgeBaseType[] = [
  'faq_kb_static_lookup',
  'faq_kb_rag_retrieval',
  'faq_kb_product_scoped',
  'faq_kb_auto_sync',
  'faq_kb_coverage_metrics',
];

export interface FaqOptionsState {
  enabled: boolean;
  storefrontEnabled: boolean;
  productEnabled: boolean;
  templatesEnabled: boolean;
  managementEnabled: boolean;
  previewEnabled: boolean;
  displayEnabled: boolean;
  kbEnabled: boolean;
  allowedManagementTypes: FaqManagementType[];
  allowedPreviewTypes: FaqPreviewType[];
  allowedDisplayTypes: FaqDisplayType[];
  allowedKbTypes: FaqKnowledgeBaseType[];
  isFlexible: boolean;
  faqAvailable: boolean;
  features: Record<string, boolean>;
}

export interface FaqTypeMeta {
  key: string;
  label: string;
  description: string;
  group: 'management' | 'preview' | 'display' | 'kb';
}

const FAQ_TYPE_META: Record<string, FaqTypeMeta> = {
  faq_management_hub: { key: 'faq_management_hub', label: 'FAQ Hub', description: 'Full FAQ management hub with all tabs', group: 'management' },
  faq_management_templates: { key: 'faq_management_templates', label: 'Templates', description: 'Template-driven authoring from category templates', group: 'management' },
  faq_management_import: { key: 'faq_management_import', label: 'Import', description: 'CSV upload, column mapping, preview, import', group: 'management' },
  faq_management_wizard_inline: { key: 'faq_management_wizard_inline', label: 'Wizard Inline', description: 'Inline FAQ step in product and storefront wizards', group: 'management' },
  faq_management_bulk_actions: { key: 'faq_management_bulk_actions', label: 'Bulk Actions', description: 'Bulk activate, deactivate, delete, change category', group: 'management' },
  faq_management_reorder: { key: 'faq_management_reorder', label: 'Reorder', description: 'Drag-and-drop display order control', group: 'management' },
  faq_management_search: { key: 'faq_management_search', label: 'Search', description: 'Real-time debounced search across question, answer, tags', group: 'management' },
  faq_preview_bot: { key: 'faq_preview_bot', label: 'Bot Preview', description: 'Test questions, see matched FAQ + confidence', group: 'preview' },
  faq_preview_gap_report: { key: 'faq_preview_gap_report', label: 'Gap Report', description: 'Unanswered queries ranked by frequency', group: 'preview' },
  faq_preview_auto_suggest: { key: 'faq_preview_auto_suggest', label: 'Auto-Suggest', description: 'AI-generated suggested answers from gap report', group: 'preview' },
  faq_display_storefront_accordion: { key: 'faq_display_storefront_accordion', label: 'Storefront Accordion', description: 'Customer-facing accordion on storefront page', group: 'display' },
  faq_display_product_accordion: { key: 'faq_display_product_accordion', label: 'Product Accordion', description: 'Customer-facing accordion on product detail page', group: 'display' },
  faq_display_search_overlay: { key: 'faq_display_search_overlay', label: 'Search Overlay', description: 'Real-time search overlay on FAQ sections', group: 'display' },
  faq_display_feedback: { key: 'faq_display_feedback', label: 'Feedback', description: 'Thumbs up/down + Suggest Edit on each answer', group: 'display' },
  faq_display_bot_handoff: { key: 'faq_display_bot_handoff', label: 'Bot Handoff', description: 'Ask our bot CTA in FAQ sections', group: 'display' },
  faq_display_markdown: { key: 'faq_display_markdown', label: 'Markdown', description: 'Markdown support in answers (bold, links, lists)', group: 'display' },
  faq_display_deep_link: { key: 'faq_display_deep_link', label: 'Deep Links', description: 'URL hash deep-linking to specific FAQ entries', group: 'display' },
  faq_kb_static_lookup: { key: 'faq_kb_static_lookup', label: 'Static Lookup', description: 'Static FAQ exact-match / keyword lookup', group: 'kb' },
  faq_kb_rag_retrieval: { key: 'faq_kb_rag_retrieval', label: 'RAG Retrieval', description: 'Semantic RAG retrieval with embeddings', group: 'kb' },
  faq_kb_product_scoped: { key: 'faq_kb_product_scoped', label: 'Product-Scoped', description: 'Product-scoped FAQ retrieval in bot context', group: 'kb' },
  faq_kb_auto_sync: { key: 'faq_kb_auto_sync', label: 'Auto-Sync', description: 'Auto-rebuild embedding index on FAQ save', group: 'kb' },
  faq_kb_coverage_metrics: { key: 'faq_kb_coverage_metrics', label: 'Coverage Metrics', description: 'Coverage score, category coverage, product coverage', group: 'kb' },
};

// ====================
// SERVICE
// ====================

class FaqOptionsService {
  private static instance: FaqOptionsService;

  private constructor() {}

  static getInstance(): FaqOptionsService {
    if (!FaqOptionsService.instance) {
      FaqOptionsService.instance = new FaqOptionsService();
    }
    return FaqOptionsService.instance;
  }

  /**
   * Resolve FAQ options state for a tenant from their tier capabilities.
   */
  async resolveFaqOptionsState(tenantId: string): Promise<FaqOptionsState> {
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
        logger.warn('[FaqOptionsService] Tenant not found', undefined, { tenantId });
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

      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          feature_key: { startsWith: 'faq_' },
          is_enabled: true,
        },
        include: {
          capability_type_list: { select: { key: true } },
        },
      });

      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of tierFeatures) {
        mergedFeatures[tf.feature_key] = mergedFeatures[tf.feature_key] || tf.is_enabled;
      }

      return this.resolveFromFeatures(mergedFeatures);
    } catch (error) {
      logger.error('[FaqOptionsService] Error resolving FAQ options state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve FaqOptionsState from a raw feature map.
   */
  resolveFromFeatures(features: Record<string, boolean>): FaqOptionsState {
    const enabled = !!features.faq_enabled;
    const disabled = !!features.faq_disabled;
    const flexible = !!features.faq_flexible;

    // Scope group gates (storefront, product, templates)
    const storefrontGroupEnabled = !!features.faq_storefront_enabled;
    const storefrontGroupDisabled = !!features.faq_storefront_disabled;
    const productGroupEnabled = !!features.faq_product_enabled;
    const productGroupDisabled = !!features.faq_product_disabled;
    const templatesGroupEnabled = !!features.faq_templates_enabled;
    const templatesGroupDisabled = !!features.faq_templates_disabled;

    const storefrontEnabled = flexible || (storefrontGroupEnabled && !storefrontGroupDisabled);
    const productEnabled = flexible || (productGroupEnabled && !productGroupDisabled);
    const templatesEnabled = flexible || (templatesGroupEnabled && !templatesGroupDisabled);

    // Feature group gates (management, preview, display, kb)
    const managementGroupEnabled = !!features.faq_management_enabled;
    const managementGroupDisabled = !!features.faq_management_disabled;
    const previewGroupEnabled = !!features.faq_preview_enabled;
    const previewGroupDisabled = !!features.faq_preview_disabled;
    const displayGroupEnabled = !!features.faq_display_enabled;
    const displayGroupDisabled = !!features.faq_display_disabled;
    const kbGroupEnabled = !!features.faq_kb_enabled;
    const kbGroupDisabled = !!features.faq_kb_disabled;

    const managementEnabled = managementGroupEnabled && !managementGroupDisabled;
    const managementUntouched = !managementGroupEnabled && !managementGroupDisabled;
    const previewEnabled = previewGroupEnabled && !previewGroupDisabled;
    const previewUntouched = !previewGroupEnabled && !previewGroupDisabled;
    const displayEnabled = displayGroupEnabled && !displayGroupDisabled;
    const displayUntouched = !displayGroupEnabled && !displayGroupDisabled;
    const kbEnabled = kbGroupEnabled && !kbGroupDisabled;
    const kbUntouched = !kbGroupEnabled && !kbGroupDisabled;

    const allowedManagementTypes: FaqManagementType[] = [];
    if (flexible || managementEnabled) {
      allowedManagementTypes.push(...ALL_FAQ_MANAGEMENT_TYPES);
    } else if (managementUntouched) {
      for (const type of ALL_FAQ_MANAGEMENT_TYPES) {
        if (features[type]) allowedManagementTypes.push(type);
      }
    }

    const allowedPreviewTypes: FaqPreviewType[] = [];
    if (flexible || previewEnabled) {
      allowedPreviewTypes.push(...ALL_FAQ_PREVIEW_TYPES);
    } else if (previewUntouched) {
      for (const type of ALL_FAQ_PREVIEW_TYPES) {
        if (features[type]) allowedPreviewTypes.push(type);
      }
    }

    const allowedDisplayTypes: FaqDisplayType[] = [];
    if (flexible || displayEnabled) {
      allowedDisplayTypes.push(...ALL_FAQ_DISPLAY_TYPES);
    } else if (displayUntouched) {
      for (const type of ALL_FAQ_DISPLAY_TYPES) {
        if (features[type]) allowedDisplayTypes.push(type);
      }
    }

    const allowedKbTypes: FaqKnowledgeBaseType[] = [];
    if (flexible || kbEnabled) {
      allowedKbTypes.push(...ALL_FAQ_KB_TYPES);
    } else if (kbUntouched) {
      for (const type of ALL_FAQ_KB_TYPES) {
        if (features[type]) allowedKbTypes.push(type);
      }
    }

    const allTypes = [
      ...allowedManagementTypes,
      ...allowedPreviewTypes,
      ...allowedDisplayTypes,
      ...allowedKbTypes,
    ];

    return {
      enabled: enabled && !disabled,
      storefrontEnabled: enabled && !disabled && storefrontEnabled,
      productEnabled: enabled && !disabled && productEnabled,
      templatesEnabled: enabled && !disabled && templatesEnabled,
      managementEnabled,
      previewEnabled,
      displayEnabled,
      kbEnabled,
      allowedManagementTypes,
      allowedPreviewTypes,
      allowedDisplayTypes,
      allowedKbTypes,
      isFlexible: flexible,
      faqAvailable: enabled && !disabled && allTypes.length > 0,
      features,
    };
  }

  /**
   * Check if a specific FAQ type is allowed for a tenant.
   */
  async isFaqTypeAllowed(tenantId: string, type: string): Promise<boolean> {
    const state = await this.resolveFaqOptionsState(tenantId);
    return state.enabled && state.features[type] === true;
  }

  getFaqTypeMeta(key: string): FaqTypeMeta | undefined {
    return FAQ_TYPE_META[key];
  }

  private getDisabledState(): FaqOptionsState {
    return {
      enabled: false,
      storefrontEnabled: false,
      productEnabled: false,
      templatesEnabled: false,
      managementEnabled: false,
      previewEnabled: false,
      displayEnabled: false,
      kbEnabled: false,
      allowedManagementTypes: [],
      allowedPreviewTypes: [],
      allowedDisplayTypes: [],
      allowedKbTypes: [],
      isFlexible: false,
      faqAvailable: false,
      features: {},
    };
  }
}

export default FaqOptionsService;
