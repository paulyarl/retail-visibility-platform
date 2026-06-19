/**
 * Seed script for chatbot_options capability features
 *
 * Run with: npx tsx prisma/seed-chatbot-capabilities.ts
 */
/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CHATBOT_FEATURE_KEYS: Record<string, string> = {
  chatbot_enabled: 'Enable Chatbot',
  chatbot_flexible: 'Flexible Chatbot',
  chatbot_static_enabled: 'Static Response Engine',
  chatbot_dynamic_enabled: 'Dynamic Response Engine (Shared Model)',
  chatbot_static_lookup: 'Static FAQ Lookup',
  chatbot_shared_dynamic: 'Shared Dynamic Model',
  chatbot_lora_finetuned: 'LoRA Fine-Tuned Model',
  chatbot_dedicated: 'Dedicated Model',
  chatbot_skills_enabled: 'Bot Skills',
  chatbot_skill_product_search: 'Product Search Skill',
  chatbot_skill_inventory: 'Inventory Check Skill',
  chatbot_skill_order_tracking: 'Order Tracking Skill',
  chatbot_skill_store_hours: 'Store Hours Skill',
  chatbot_skill_cross_merchant: 'Cross-Merchant Skill',
  chatbot_kb_enabled: 'Knowledge Base',
  chatbot_kb_static_faq: 'Static FAQ Knowledge Base',
  chatbot_kb_rag_retrieval: 'RAG Retrieval Knowledge Base',
  chatbot_kb_product_scoped: 'Product-Scoped Knowledge Base',
  chatbot_kb_gap_report: 'Gap Report Knowledge Base',
  chatbot_kb_auto_sync: 'Auto-Sync Knowledge Base',
  chatbot_widget_enabled: 'Widget Enabled',
  chatbot_widget_embed: 'Widget Embed',
  chatbot_widget_custom_theme: 'Widget Custom Theme',
  chatbot_widget_skill_cards: 'Widget Skill Cards',
  chatbot_widget_after_hours: 'Widget After Hours Mode',
};

type TF = { featureKey: string; featureName: string; isEnabled: boolean; isInherited: boolean };
const f = (k: string, i = false): TF => ({
  featureKey: k,
  featureName: CHATBOT_FEATURE_KEYS[k] || k,
  isEnabled: true,
  isInherited: i,
});

// Discovery + Storefront: static FAQ only + basic widget
const DISCOVERY: TF[] = [
  f('chatbot_enabled'),
  f('chatbot_static_enabled'),
  f('chatbot_static_lookup'),
  f('chatbot_kb_enabled'),
  f('chatbot_kb_static_faq'),
  f('chatbot_widget_enabled'),
  f('chatbot_widget_embed'),
];

// Commitment + Ecommerce: add shared dynamic model, skills, RAG
const COMMIT_ADD: TF[] = [
  f('chatbot_dynamic_enabled'),
  f('chatbot_shared_dynamic'),
  f('chatbot_skills_enabled'),
  f('chatbot_skill_product_search'),
  f('chatbot_skill_inventory'),
  f('chatbot_skill_store_hours'),
  f('chatbot_kb_rag_retrieval'),
  f('chatbot_kb_product_scoped'),
  f('chatbot_kb_gap_report'),
  f('chatbot_widget_skill_cards'),
  f('chatbot_widget_after_hours'),
];

// Omnichannel: add order tracking
const OMNICHANNEL_ADD: TF[] = [
  f('chatbot_skill_order_tracking'),
  f('chatbot_kb_auto_sync'),
];

// Professional: add LoRA fine-tuning
const PROFESSIONAL_ADD: TF[] = [
  f('chatbot_lora_finetuned'),
  f('chatbot_widget_custom_theme'),
];

// Enterprise: add dedicated model + cross-merchant
const ENTERPRISE_ADD: TF[] = [
  f('chatbot_dedicated'),
  f('chatbot_skill_cross_merchant'),
];

const FLEX_ALL: TF[] = Object.keys(CHATBOT_FEATURE_KEYS)
  .filter(k => k !== 'chatbot_flexible')
  .map(k => f(k));
FLEX_ALL.push(f('chatbot_flexible'));

const TIER_CHATBOT_FEATURES: Record<string, TF[]> = {
  discovery: DISCOVERY,
  storefront: DISCOVERY,
  commitment: [...DISCOVERY, ...COMMIT_ADD],
  ecommerce: [...DISCOVERY, ...COMMIT_ADD],
  omnichannel: [...DISCOVERY, ...COMMIT_ADD, ...OMNICHANNEL_ADD],
  professional: [...DISCOVERY, ...COMMIT_ADD, ...OMNICHANNEL_ADD, ...PROFESSIONAL_ADD],
  enterprise: [...DISCOVERY, ...COMMIT_ADD, ...OMNICHANNEL_ADD, ...PROFESSIONAL_ADD, ...ENTERPRISE_ADD],
  organization: FLEX_ALL,
  chain_starter: FLEX_ALL,
  chain_professional: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  chain_enterprise: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  // Trial tiers mirror their base
  trial_discovery: DISCOVERY,
  trial_storefront: DISCOVERY,
  trial_commitment: [...DISCOVERY, ...COMMIT_ADD],
  trial_ecommerce: [...DISCOVERY, ...COMMIT_ADD],
  trial_omnichannel: [...DISCOVERY, ...COMMIT_ADD, ...OMNICHANNEL_ADD],
  trial_professional: [...DISCOVERY, ...COMMIT_ADD, ...OMNICHANNEL_ADD, ...PROFESSIONAL_ADD],
  trial_enterprise: [...DISCOVERY, ...COMMIT_ADD, ...OMNICHANNEL_ADD, ...PROFESSIONAL_ADD, ...ENTERPRISE_ADD],
  trial_chain_starter: FLEX_ALL,
  trial_chain_professional: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  trial_chain_enterprise: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  // No chatbot for these
  google_only: [],
  starter: [],
  trial_google_only: [],
  trial_starter: [],
  expired_trial: [],
};

async function main() {
  console.log('🌱 Seeding chatbot_options capability features...');

  const chatbotCapType = await prisma.capability_type_list.upsert({
    where: { key: 'chatbot_options' },
    update: { name: 'Chatbot Options', is_active: true, category: 'chatbot' },
    create: { id: 'captype_chatbot_options', key: 'chatbot_options', name: 'Chatbot Options', is_active: true, category: 'chatbot' },
  });
  console.log(`✓ Capability type: ${chatbotCapType.name} (${chatbotCapType.key})`);

  for (const [key, name] of Object.entries(CHATBOT_FEATURE_KEYS)) {
    await prisma.features_list.upsert({
      where: { key },
      update: { name, is_active: true, category: 'chatbot_options' },
      create: { id: `feat_chatbot_${key}`, key, name, category: 'chatbot_options', is_active: true },
    });
  }
  console.log(`✓ Ensured ${Object.keys(CHATBOT_FEATURE_KEYS).length} features_list entries exist`);

  for (const key of Object.keys(CHATBOT_FEATURE_KEYS)) {
    const feature = await prisma.features_list.findUnique({ where: { key } });
    if (!feature) continue;
    await prisma.capability_features_list.upsert({
      where: { capability_type_id_feature_id: { capability_type_id: chatbotCapType.id, feature_id: feature.id } },
      update: { is_active: true },
      create: { id: `capfeat_chatbot_${key}`, capability_type_id: chatbotCapType.id, feature_id: feature.id, is_active: true },
    });
  }
  console.log('✓ Linked features to chatbot_options capability type');

  let totalCreated = 0;
  for (const [tierKey, features] of Object.entries(TIER_CHATBOT_FEATURES)) {
    const tier = await prisma.subscription_tiers_list.findUnique({ where: { tier_key: tierKey } });
    if (!tier) { console.log(`⚠ Tier '${tierKey}' not found, skipping`); continue; }
    if (features.length === 0) { console.log(`⊘ Tier '${tierKey}' — no chatbot features`); continue; }

    for (const feat of features) {
      const feature = await prisma.features_list.findUnique({ where: { key: feat.featureKey } });
      if (!feature) continue;
      await prisma.tier_features_list.upsert({
        where: { tier_id_feature_key: { tier_id: tier.id, feature_key: feat.featureKey } },
        update: { feature_name: feat.featureName, is_enabled: feat.isEnabled, is_inherited: feat.isInherited, capability_type_id: chatbotCapType.id, updated_at: new Date() },
        create: { id: `tf_chatbot_${tier.id}_${feat.featureKey}`, tier_id: tier.id, feature_key: feat.featureKey, feature_name: feat.featureName, is_enabled: feat.isEnabled, is_inherited: feat.isInherited, capability_type_id: chatbotCapType.id },
      });
      totalCreated++;
    }
    console.log(`✓ Added ${features.length} chatbot features to tier: ${tierKey}`);
  }

  console.log(`✅ Chatbot capability seeding complete! ${totalCreated} tier features configured.`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
