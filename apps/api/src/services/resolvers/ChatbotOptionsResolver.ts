/**
 * Chatbot Options Resolver
 *
 * Resolves effective chatbot options state from tier features.
 */

import type { EffectiveChatbot } from './types';

export type ChatbotResponseEngineType =
  | 'chatbot_static_lookup'
  | 'chatbot_shared_dynamic'
  | 'chatbot_lora_finetuned'
  | 'chatbot_dedicated';

export type ChatbotSkillType =
  | 'chatbot_skill_product_search'
  | 'chatbot_skill_inventory'
  | 'chatbot_skill_order_tracking'
  | 'chatbot_skill_store_hours'
  | 'chatbot_skill_cross_merchant'
  | 'chatbot_skill_crm_assistant';

export type ChatbotKnowledgeBaseType =
  | 'chatbot_kb_static_faq'
  | 'chatbot_kb_rag_retrieval'
  | 'chatbot_kb_product_scoped'
  | 'chatbot_kb_gap_report'
  | 'chatbot_kb_auto_sync';

export type ChatbotWidgetType =
  | 'chatbot_widget_embed'
  | 'chatbot_widget_custom_theme'
  | 'chatbot_widget_skill_cards'
  | 'chatbot_widget_after_hours';

export function resolveChatbotOptions(
  features: Record<string, boolean>,
  capabilityEnabled?: boolean
): EffectiveChatbot {
  const cleanFeatures: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(features)) {
    cleanFeatures[key.trim()] = val;
  }
  const feat = cleanFeatures;

  const enabled = capabilityEnabled ?? !!feat.chatbot_enabled;
  const flexible = !!feat.chatbot_flexible;

  const staticEnabled = flexible || !!feat.chatbot_static_enabled;
  const dynamicEnabled = flexible || !!feat.chatbot_dynamic_enabled;
  const skillsEnabled = flexible || !!feat.chatbot_skills_enabled;
  const kbEnabled = flexible || !!feat.chatbot_kb_enabled;
  const widgetEnabled = flexible || !!feat.chatbot_widget_enabled;

  const allowedResponseEngines: ChatbotResponseEngineType[] = [];
  if (flexible) {
    allowedResponseEngines.push('chatbot_static_lookup', 'chatbot_shared_dynamic', 'chatbot_lora_finetuned', 'chatbot_dedicated');
  } else {
    if (feat.chatbot_static_lookup) allowedResponseEngines.push('chatbot_static_lookup');
    if (feat.chatbot_shared_dynamic) allowedResponseEngines.push('chatbot_shared_dynamic');
    if (feat.chatbot_lora_finetuned) allowedResponseEngines.push('chatbot_lora_finetuned');
    if (feat.chatbot_dedicated) allowedResponseEngines.push('chatbot_dedicated');
  }

  const allowedSkills: ChatbotSkillType[] = [];
  if (flexible) {
    allowedSkills.push('chatbot_skill_product_search', 'chatbot_skill_inventory', 'chatbot_skill_order_tracking', 'chatbot_skill_store_hours', 'chatbot_skill_cross_merchant', 'chatbot_skill_crm_assistant');
  } else {
    if (feat.chatbot_skill_product_search) allowedSkills.push('chatbot_skill_product_search');
    if (feat.chatbot_skill_inventory) allowedSkills.push('chatbot_skill_inventory');
    if (feat.chatbot_skill_order_tracking) allowedSkills.push('chatbot_skill_order_tracking');
    if (feat.chatbot_skill_store_hours) allowedSkills.push('chatbot_skill_store_hours');
    if (feat.chatbot_skill_cross_merchant) allowedSkills.push('chatbot_skill_cross_merchant');
    if (feat.chatbot_skill_crm_assistant) allowedSkills.push('chatbot_skill_crm_assistant');
  }

  const allowedKbTypes: ChatbotKnowledgeBaseType[] = [];
  if (flexible) {
    allowedKbTypes.push('chatbot_kb_static_faq', 'chatbot_kb_rag_retrieval', 'chatbot_kb_product_scoped', 'chatbot_kb_gap_report', 'chatbot_kb_auto_sync');
  } else {
    if (feat.chatbot_kb_static_faq) allowedKbTypes.push('chatbot_kb_static_faq');
    if (feat.chatbot_kb_rag_retrieval) allowedKbTypes.push('chatbot_kb_rag_retrieval');
    if (feat.chatbot_kb_product_scoped) allowedKbTypes.push('chatbot_kb_product_scoped');
    if (feat.chatbot_kb_gap_report) allowedKbTypes.push('chatbot_kb_gap_report');
    if (feat.chatbot_kb_auto_sync) allowedKbTypes.push('chatbot_kb_auto_sync');
  }

  const allowedWidgetTypes: ChatbotWidgetType[] = [];
  if (flexible) {
    allowedWidgetTypes.push('chatbot_widget_embed', 'chatbot_widget_custom_theme', 'chatbot_widget_skill_cards', 'chatbot_widget_after_hours');
  } else {
    if (feat.chatbot_widget_embed) allowedWidgetTypes.push('chatbot_widget_embed');
    if (feat.chatbot_widget_custom_theme) allowedWidgetTypes.push('chatbot_widget_custom_theme');
    if (feat.chatbot_widget_skill_cards) allowedWidgetTypes.push('chatbot_widget_skill_cards');
    if (feat.chatbot_widget_after_hours) allowedWidgetTypes.push('chatbot_widget_after_hours');
  }

  const allTypes = [...allowedResponseEngines, ...allowedSkills, ...allowedKbTypes, ...allowedWidgetTypes];

  return {
    enabled,
    static_enabled: enabled && staticEnabled,
    dynamic_enabled: enabled && dynamicEnabled,
    skills_enabled: enabled && skillsEnabled,
    kb_enabled: enabled && kbEnabled,
    widget_enabled: enabled && widgetEnabled,
    allowed_response_engines: allowedResponseEngines,
    allowed_skill_types: allowedSkills,
    allowed_kb_types: allowedKbTypes,
    allowed_widget_types: allowedWidgetTypes,
    is_flexible: flexible,
    chatbot_available: enabled && allTypes.length > 0,
  };
}
