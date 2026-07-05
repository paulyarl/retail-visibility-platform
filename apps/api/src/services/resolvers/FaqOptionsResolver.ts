/**
 * FAQ Options Resolver
 *
 * Resolves effective FAQ options state from tier features and merchant preferences.
 */

import type { EffectiveFaq, FaqOptionsMerchantSettings } from './types';

export type FaqManagementType =
  | 'faq_management_hub' | 'faq_management_templates' | 'faq_management_import'
  | 'faq_management_wizard_inline' | 'faq_management_bulk_actions'
  | 'faq_management_reorder' | 'faq_management_search';

export type FaqPreviewType =
  | 'faq_preview_bot' | 'faq_preview_gap_report' | 'faq_preview_auto_suggest';

export type FaqDisplayType =
  | 'faq_display_storefront_accordion' | 'faq_display_product_accordion'
  | 'faq_display_search_overlay' | 'faq_display_feedback'
  | 'faq_display_bot_handoff' | 'faq_display_markdown' | 'faq_display_deep_link';

export type FaqKnowledgeBaseType =
  | 'faq_kb_static_lookup' | 'faq_kb_rag_retrieval' | 'faq_kb_product_scoped'
  | 'faq_kb_auto_sync' | 'faq_kb_coverage_metrics';

export function resolveFaqOptions(
  features: Record<string, boolean>,
  merchantPrefs?: FaqOptionsMerchantSettings | null
): EffectiveFaq {
  const disabled = !!features.faq_disabled;
  const enabled = !disabled && !!features.faq_enabled && (merchantPrefs?.faq_enabled !== false);
  const flexible = !!features.faq_flexible;

  const storefrontEnabled = flexible || !!features.faq_storefront_enabled;
  const productEnabled = flexible || !!features.faq_product_enabled;
  const templatesEnabled = flexible || !!features.faq_templates_enabled;

  const managementGroupEnabled = !!features.faq_management_enabled;
  const previewGroupEnabled = !!features.faq_preview_enabled;
  const displayGroupEnabled = !!features.faq_display_enabled;
  const kbGroupEnabled = !!features.faq_kb_enabled;

  const allowedManagementTypes: FaqManagementType[] = [];
  if (flexible || managementGroupEnabled) {
    allowedManagementTypes.push(
      'faq_management_hub', 'faq_management_templates', 'faq_management_import',
      'faq_management_wizard_inline', 'faq_management_bulk_actions',
      'faq_management_reorder', 'faq_management_search'
    );
  } else {
    if (features.faq_management_hub) allowedManagementTypes.push('faq_management_hub');
    if (features.faq_management_templates) allowedManagementTypes.push('faq_management_templates');
    if (features.faq_management_import) allowedManagementTypes.push('faq_management_import');
    if (features.faq_management_wizard_inline) allowedManagementTypes.push('faq_management_wizard_inline');
    if (features.faq_management_bulk_actions) allowedManagementTypes.push('faq_management_bulk_actions');
    if (features.faq_management_reorder) allowedManagementTypes.push('faq_management_reorder');
    if (features.faq_management_search) allowedManagementTypes.push('faq_management_search');
  }

  const allowedPreviewTypes: FaqPreviewType[] = [];
  if (flexible || previewGroupEnabled) {
    allowedPreviewTypes.push('faq_preview_bot', 'faq_preview_gap_report', 'faq_preview_auto_suggest');
  } else {
    if (features.faq_preview_bot) allowedPreviewTypes.push('faq_preview_bot');
    if (features.faq_preview_gap_report) allowedPreviewTypes.push('faq_preview_gap_report');
    if (features.faq_preview_auto_suggest) allowedPreviewTypes.push('faq_preview_auto_suggest');
  }

  const allowedDisplayTypes: FaqDisplayType[] = [];
  if (flexible || displayGroupEnabled) {
    allowedDisplayTypes.push(
      'faq_display_storefront_accordion', 'faq_display_product_accordion',
      'faq_display_search_overlay', 'faq_display_feedback',
      'faq_display_bot_handoff', 'faq_display_markdown', 'faq_display_deep_link'
    );
  } else {
    if (features.faq_display_storefront_accordion) allowedDisplayTypes.push('faq_display_storefront_accordion');
    if (features.faq_display_product_accordion) allowedDisplayTypes.push('faq_display_product_accordion');
    if (features.faq_display_search_overlay) allowedDisplayTypes.push('faq_display_search_overlay');
    if (features.faq_display_feedback) allowedDisplayTypes.push('faq_display_feedback');
    if (features.faq_display_bot_handoff) allowedDisplayTypes.push('faq_display_bot_handoff');
    if (features.faq_display_markdown) allowedDisplayTypes.push('faq_display_markdown');
    if (features.faq_display_deep_link) allowedDisplayTypes.push('faq_display_deep_link');
  }

  const allowedKbTypes: FaqKnowledgeBaseType[] = [];
  if (flexible || kbGroupEnabled) {
    allowedKbTypes.push(
      'faq_kb_static_lookup', 'faq_kb_rag_retrieval', 'faq_kb_product_scoped',
      'faq_kb_auto_sync', 'faq_kb_coverage_metrics'
    );
  } else {
    if (features.faq_kb_static_lookup) allowedKbTypes.push('faq_kb_static_lookup');
    if (features.faq_kb_rag_retrieval) allowedKbTypes.push('faq_kb_rag_retrieval');
    if (features.faq_kb_product_scoped) allowedKbTypes.push('faq_kb_product_scoped');
    if (features.faq_kb_auto_sync) allowedKbTypes.push('faq_kb_auto_sync');
    if (features.faq_kb_coverage_metrics) allowedKbTypes.push('faq_kb_coverage_metrics');
  }

  const allTypes = [...allowedManagementTypes, ...allowedPreviewTypes, ...allowedDisplayTypes, ...allowedKbTypes];

  return {
    enabled,
    storefront_enabled: enabled && storefrontEnabled,
    product_enabled: enabled && productEnabled,
    templates_enabled: enabled && templatesEnabled,
    management_enabled: enabled && managementGroupEnabled,
    preview_enabled: enabled && previewGroupEnabled,
    display_enabled: enabled && displayGroupEnabled,
    kb_enabled: enabled && kbGroupEnabled,
    allowed_management_types: allowedManagementTypes,
    allowed_preview_types: allowedPreviewTypes,
    allowed_display_types: allowedDisplayTypes,
    allowed_kb_types: allowedKbTypes,
    is_flexible: flexible,
    faq_available: enabled && allTypes.length > 0,
    merchant_preferences: merchantPrefs ?? null,
  };
}
