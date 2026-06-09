/**
 * Seed script for faq_options capability features
 *
 * Registers the faq_options capability type, all 30 feature keys,
 * capability-feature links, and tier feature assignments.
 *
 * Run with: npx tsx prisma/seed-faq-capabilities.ts
 */
/// <reference types="node" />

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ====================
// FEATURE KEY REGISTRY
// ====================

const FAQ_FEATURE_KEYS: Record<string, string> = {
  // Master Gate
  faq_enabled: 'Enable FAQ',
  faq_disabled: 'Disable FAQ',
  // Flexible
  faq_flexible: 'Flexible FAQ',
  // Scope Group Gates
  faq_storefront_enabled: 'Storefront FAQ Enabled',
  faq_storefront_disabled: 'Storefront FAQ Disabled',
  faq_product_enabled: 'Product FAQ Enabled',
  faq_product_disabled: 'Product FAQ Disabled',
  faq_templates_enabled: 'Templates FAQ Enabled',
  faq_templates_disabled: 'Templates FAQ Disabled',
  // Feature Group Gates
  faq_management_enabled: 'FAQ Management Enabled',
  faq_management_disabled: 'FAQ Management Disabled',
  faq_preview_enabled: 'FAQ Preview Enabled',
  faq_preview_disabled: 'FAQ Preview Disabled',
  faq_display_enabled: 'FAQ Display Enabled',
  faq_display_disabled: 'FAQ Display Disabled',
  faq_kb_enabled: 'FAQ Knowledge Base Enabled',
  faq_kb_disabled: 'FAQ Knowledge Base Disabled',
  // Management Features
  faq_management_hub: 'FAQ Hub',
  faq_management_import: 'CSV Import Wizard',
  faq_management_bulk_actions: 'Bulk Actions',
  faq_management_reorder: 'Drag-and-Drop Reorder',
  faq_management_search: 'Debounced Search',
  // Preview Features
  faq_preview_bot: 'Bot Preview',
  faq_preview_gap_report: 'Gap Report',
  // Display Features
  faq_display_storefront_accordion: 'Storefront Accordion',
  faq_display_product_accordion: 'Product Accordion',
  faq_display_feedback: 'Feedback & Suggest Edit',
  faq_display_bot_handoff: 'Bot Handoff CTA',
  // KB Features
  faq_chatbot_knowledge_base: 'Chatbot Knowledge Base',
  faq_kb_coverage_metrics: 'Coverage Metrics Dashboard',
};

// ====================
// TIER ASSIGNMENTS
// ====================

type TierFeature = { featureKey: string; featureName: string; isEnabled: boolean; isInherited: boolean };

const TIER_FAQ_FEATURES: Record<string, TierFeature[]> = {
  // --- Individual Tiers ---

  discovery: [
    // Master gate
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    // Scope: storefront only
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    // Management: hub + search only
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    // Display: storefront accordion + feedback only
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
  ],

  storefront: [
    // Master gate
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    // Scope: storefront only
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    // Management: hub + import + search
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    // Display: storefront accordion + feedback
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
  ],

  commitment: [
    // Master gate
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    // Scope: storefront + product
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    // Management: hub + import + bulk + search
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    // Display: storefront + product accordion + feedback
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
  ],

  ecommerce: [
    // Master gate
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    // Scope: storefront + product
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    // Management: all features
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    // Preview: bot only
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: false },
    // Display: all features
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: false },
  ],

  omnichannel: [
    // Master gate
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    // Scope: all three
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_templates_enabled', featureName: 'Templates FAQ Enabled', isEnabled: true, isInherited: false },
    // Management: all features
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    // Preview: bot only
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: false },
    // Display: all features
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: false },
  ],

  professional: [
    // Master gate
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    // Scope: all three
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_templates_enabled', featureName: 'Templates FAQ Enabled', isEnabled: true, isInherited: false },
    // Management: all features
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    // Preview: bot only
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: false },
    // Display: all features
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: false },
  ],

  // --- Organization Tiers ---

  chain_starter: [
    // Master gate
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    // Scope: all three
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_templates_enabled', featureName: 'Templates FAQ Enabled', isEnabled: true, isInherited: false },
    // Management: all features
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    // Preview: bot only
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: false },
    // Display: all features
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: false },
    // KB: chatbot knowledge base only
    { featureKey: 'faq_kb_enabled', featureName: 'FAQ Knowledge Base Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_chatbot_knowledge_base', featureName: 'Chatbot Knowledge Base', isEnabled: true, isInherited: false },
  ],

  chain_professional: [
    // Master gate (inherited from chain_starter)
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: true },
    // Scope: all three (inherited)
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_templates_enabled', featureName: 'Templates FAQ Enabled', isEnabled: true, isInherited: true },
    // Management: all features (inherited)
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: true },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: true },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: true },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: true },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: true },
    // Preview: bot + gap report
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: true },
    { featureKey: 'faq_preview_gap_report', featureName: 'Gap Report', isEnabled: true, isInherited: false },
    // Display: all features (inherited)
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: true },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: true },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: true },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: true },
    // KB: chatbot + coverage metrics
    { featureKey: 'faq_kb_enabled', featureName: 'FAQ Knowledge Base Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_chatbot_knowledge_base', featureName: 'Chatbot Knowledge Base', isEnabled: true, isInherited: true },
    { featureKey: 'faq_kb_coverage_metrics', featureName: 'Coverage Metrics Dashboard', isEnabled: true, isInherited: false },
  ],

  enterprise: [
    // Master gate
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    // Scope: all three
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_templates_enabled', featureName: 'Templates FAQ Enabled', isEnabled: true, isInherited: false },
    // Management: all features
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    // Preview: bot + gap report
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_gap_report', featureName: 'Gap Report', isEnabled: true, isInherited: false },
    // Display: all features
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: false },
    // KB: chatbot + coverage metrics
    { featureKey: 'faq_kb_enabled', featureName: 'FAQ Knowledge Base Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_chatbot_knowledge_base', featureName: 'Chatbot Knowledge Base', isEnabled: true, isInherited: false },
    { featureKey: 'faq_kb_coverage_metrics', featureName: 'Coverage Metrics Dashboard', isEnabled: true, isInherited: false },
  ],

  organization: [
    // Master gate
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: true },
    // Flexible: unlock everything
    { featureKey: 'faq_flexible', featureName: 'Flexible FAQ', isEnabled: true, isInherited: false },
    // Scope: all three (flexible covers these, but register for clarity)
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_templates_enabled', featureName: 'Templates FAQ Enabled', isEnabled: true, isInherited: true },
    // Feature group gates (flexible covers, but register for clarity)
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: true },
    { featureKey: 'faq_kb_enabled', featureName: 'FAQ Knowledge Base Enabled', isEnabled: true, isInherited: true },
    // All individual features (inherited from enterprise-level)
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: true },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: true },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: true },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: true },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: true },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: true },
    { featureKey: 'faq_preview_gap_report', featureName: 'Gap Report', isEnabled: true, isInherited: true },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: true },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: true },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: true },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: true },
    { featureKey: 'faq_chatbot_knowledge_base', featureName: 'Chatbot Knowledge Base', isEnabled: true, isInherited: true },
    { featureKey: 'faq_kb_coverage_metrics', featureName: 'Coverage Metrics Dashboard', isEnabled: true, isInherited: true },
  ],

  // --- Trial Tiers (mirror their corresponding paid tier) ---

  trial_discovery: [
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
  ],

  trial_storefront: [
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
  ],

  trial_commitment: [
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
  ],

  trial_ecommerce: [
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: false },
  ],

  trial_omnichannel: [
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_templates_enabled', featureName: 'Templates FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: false },
  ],

  trial_professional: [
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_templates_enabled', featureName: 'Templates FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: false },
  ],

  trial_chain_starter: [
    { featureKey: 'faq_enabled', featureName: 'Enable FAQ', isEnabled: true, isInherited: false },
    { featureKey: 'faq_storefront_enabled', featureName: 'Storefront FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_product_enabled', featureName: 'Product FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_templates_enabled', featureName: 'Templates FAQ Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_enabled', featureName: 'FAQ Management Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_hub', featureName: 'FAQ Hub', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_import', featureName: 'CSV Import Wizard', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_bulk_actions', featureName: 'Bulk Actions', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_reorder', featureName: 'Drag-and-Drop Reorder', isEnabled: true, isInherited: false },
    { featureKey: 'faq_management_search', featureName: 'Debounced Search', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_enabled', featureName: 'FAQ Preview Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_preview_bot', featureName: 'Bot Preview', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_enabled', featureName: 'FAQ Display Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_storefront_accordion', featureName: 'Storefront Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_product_accordion', featureName: 'Product Accordion', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_feedback', featureName: 'Feedback & Suggest Edit', isEnabled: true, isInherited: false },
    { featureKey: 'faq_display_bot_handoff', featureName: 'Bot Handoff CTA', isEnabled: true, isInherited: false },
    { featureKey: 'faq_kb_enabled', featureName: 'FAQ Knowledge Base Enabled', isEnabled: true, isInherited: false },
    { featureKey: 'faq_chatbot_knowledge_base', featureName: 'Chatbot Knowledge Base', isEnabled: true, isInherited: false },
  ],

  // --- No FAQ for these tiers ---
  trial_google_only: [],
  expired_trial: [],
};

async function main() {
  console.log('🌱 Seeding faq_options capability features...');

  // 1. Ensure faq_options capability type exists
  const faqCapType = await prisma.capability_type_list.upsert({
    where: { key: 'faq_options' },
    update: { name: 'FAQ Options', is_active: true },
    create: {
      id: 'captype_faq_options',
      key: 'faq_options',
      name: 'FAQ Options',
      is_active: true,
    },
  });

  console.log(`✓ Capability type: ${faqCapType.name} (${faqCapType.key})`);

  // 2. Ensure features_list entries exist for all FAQ feature keys
  for (const [key, name] of Object.entries(FAQ_FEATURE_KEYS)) {
    await prisma.features_list.upsert({
      where: { key },
      update: { name, is_active: true, category: 'faq_options' },
      create: {
        id: `feat_faq_${key}`,
        key,
        name,
        category: 'faq_options',
        is_active: true,
      },
    });
  }
  console.log(`✓ Ensured ${Object.keys(FAQ_FEATURE_KEYS).length} features_list entries exist`);

  // 3. Ensure capability_features_list entries link features to the capability type
  for (const key of Object.keys(FAQ_FEATURE_KEYS)) {
    const feature = await prisma.features_list.findUnique({ where: { key } });
    if (!feature) continue;

    await prisma.capability_features_list.upsert({
      where: {
        capability_type_id_feature_id: {
          capability_type_id: faqCapType.id,
          feature_id: feature.id,
        },
      },
      update: { is_active: true },
      create: {
        id: `capfeat_faq_${key}`,
        capability_type_id: faqCapType.id,
        feature_id: feature.id,
        is_active: true,
      },
    });
  }
  console.log('✓ Linked features to faq_options capability type');

  // 4. Add tier_features_list entries for each tier
  let totalCreated = 0;
  for (const [tierKey, features] of Object.entries(TIER_FAQ_FEATURES)) {
    const tier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierKey },
    });

    if (!tier) {
      console.log(`⚠ Tier '${tierKey}' not found, skipping`);
      continue;
    }

    if (features.length === 0) {
      console.log(`⊘ Tier '${tierKey}' — no FAQ features (explicitly disabled)`);
      continue;
    }

    for (const feat of features) {
      const feature = await prisma.features_list.findUnique({ where: { key: feat.featureKey } });
      if (!feature) continue;

      await prisma.tier_features_list.upsert({
        where: {
          tier_id_feature_key: { tier_id: tier.id, feature_key: feat.featureKey },
        },
        update: {
          feature_name: feat.featureName,
          is_enabled: feat.isEnabled,
          is_inherited: feat.isInherited,
          capability_type_id: faqCapType.id,
          updated_at: new Date(),
        },
        create: {
          id: `tf_faq_${tier.id}_${feat.featureKey}`,
          tier_id: tier.id,
          feature_key: feat.featureKey,
          feature_name: feat.featureName,
          is_enabled: feat.isEnabled,
          is_inherited: feat.isInherited,
          capability_type_id: faqCapType.id,
        },
      });

      totalCreated++;
    }

    console.log(`✓ Added ${features.length} FAQ features to tier: ${tierKey}`);
  }

  console.log(`✅ FAQ capability seeding complete! ${totalCreated} tier features configured.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
