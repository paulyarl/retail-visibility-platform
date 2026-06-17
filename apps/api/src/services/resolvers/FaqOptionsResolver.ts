/**
 * FAQ Options Resolver
 *
 * Resolves effective FAQ options state from tier features.
 * (No merchant preferences yet for FAQ)
 */

import type { EffectiveFaq } from './types';

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

export function resolveFaqOptions(features: Record<string, boolean>): EffectiveFaq {
  const enabled = !!features.faq_enabled;
  const disabled = !!features.faq_disabled;
  const flexible = !!features.faq_flexible;

  const storefrontGroupEnabled = !!features.faq_storefront_enabled;
  const storefrontGroupDisabled = !!features.faq_storefront_disabled;
  const productGroupEnabled = !!features.faq_product_enabled;
  const productGroupDisabled = !!features.faq_product_disabled;
  const templatesGroupEnabled = !!features.faq_templates_enabled;
  const templatesGroupDisabled = !!features.faq_templates_disabled;

  const storefrontEnabled = flexible || (storefrontGroupEnabled && !storefrontGroupDisabled);
  const productEnabled = flexible || (productGroupEnabled && !productGroupDisabled);
  const templatesEnabled = flexible || (templatesGroupEnabled && !templatesGroupDisabled);

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
    allowedManagementTypes.push(
      'faq_management_hub', 'faq_management_templates', 'faq_management_import',
      'faq_management_wizard_inline', 'faq_management_bulk_actions',
      'faq_management_reorder', 'faq_management_search'
    );
  } else if (managementUntouched) {
    if (features.faq_management_hub) allowedManagementTypes.push('faq_management_hub');
    if (features.faq_management_templates) allowedManagementTypes.push('faq_management_templates');
    if (features.faq_management_import) allowedManagementTypes.push('faq_management_import');
    if (features.faq_management_wizard_inline) allowedManagementTypes.push('faq_management_wizard_inline');
    if (features.faq_management_bulk_actions) allowedManagementTypes.push('faq_management_bulk_actions');
    if (features.faq_management_reorder) allowedManagementTypes.push('faq_management_reorder');
    if (features.faq_management_search) allowedManagementTypes.push('faq_management_search');
  }

  const allowedPreviewTypes: FaqPreviewType[] = [];
  if (flexible || previewEnabled) {
    allowedPreviewTypes.push('faq_preview_bot', 'faq_preview_gap_report', 'faq_preview_auto_suggest');
  } else if (previewUntouched) {
    if (features.faq_preview_bot) allowedPreviewTypes.push('faq_preview_bot');
    if (features.faq_preview_gap_report) allowedPreviewTypes.push('faq_preview_gap_report');
    if (features.faq_preview_auto_suggest) allowedPreviewTypes.push('faq_preview_auto_suggest');
  }

  const allowedDisplayTypes: FaqDisplayType[] = [];
  if (flexible || displayEnabled) {
    allowedDisplayTypes.push(
      'faq_display_storefront_accordion', 'faq_display_product_accordion',
      'faq_display_search_overlay', 'faq_display_feedback',
      'faq_display_bot_handoff', 'faq_display_markdown', 'faq_display_deep_link'
    );
  } else if (displayUntouched) {
    if (features.faq_display_storefront_accordion) allowedDisplayTypes.push('faq_display_storefront_accordion');
    if (features.faq_display_product_accordion) allowedDisplayTypes.push('faq_display_product_accordion');
    if (features.faq_display_search_overlay) allowedDisplayTypes.push('faq_display_search_overlay');
    if (features.faq_display_feedback) allowedDisplayTypes.push('faq_display_feedback');
    if (features.faq_display_bot_handoff) allowedDisplayTypes.push('faq_display_bot_handoff');
    if (features.faq_display_markdown) allowedDisplayTypes.push('faq_display_markdown');
    if (features.faq_display_deep_link) allowedDisplayTypes.push('faq_display_deep_link');
  }

  const allowedKbTypes: FaqKnowledgeBaseType[] = [];
  if (flexible || kbEnabled) {
    allowedKbTypes.push(
      'faq_kb_static_lookup', 'faq_kb_rag_retrieval', 'faq_kb_product_scoped',
      'faq_kb_auto_sync', 'faq_kb_coverage_metrics'
    );
  } else if (kbUntouched) {
    if (features.faq_kb_static_lookup) allowedKbTypes.push('faq_kb_static_lookup');
    if (features.faq_kb_rag_retrieval) allowedKbTypes.push('faq_kb_rag_retrieval');
    if (features.faq_kb_product_scoped) allowedKbTypes.push('faq_kb_product_scoped');
    if (features.faq_kb_auto_sync) allowedKbTypes.push('faq_kb_auto_sync');
    if (features.faq_kb_coverage_metrics) allowedKbTypes.push('faq_kb_coverage_metrics');
  }

  const allTypes = [...allowedManagementTypes, ...allowedPreviewTypes, ...allowedDisplayTypes, ...allowedKbTypes];

  return {
    enabled: enabled && !disabled,
    storefront_enabled: enabled && !disabled && storefrontEnabled,
    product_enabled: enabled && !disabled && productEnabled,
    templates_enabled: enabled && !disabled && templatesEnabled,
    management_enabled: managementEnabled,
    preview_enabled: previewEnabled,
    display_enabled: displayEnabled,
    kb_enabled: kbEnabled,
    allowed_management_types: allowedManagementTypes,
    allowed_preview_types: allowedPreviewTypes,
    allowed_display_types: allowedDisplayTypes,
    allowed_kb_types: allowedKbTypes,
    is_flexible: flexible,
    faq_available: enabled && !disabled && allTypes.length > 0,
  };
}
