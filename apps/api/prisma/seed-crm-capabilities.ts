/**
 * Seed script for crm_options capability features
 *
 * Run with: npx tsx prisma/seed-crm-capabilities.ts
 */
/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const CRM_FEATURE_KEYS: Record<string, string> = {
  crm_enabled: 'Enable CRM',
  crm_disabled: 'Disable CRM',
  crm_flexible: 'Flexible CRM',
  crm_inquiry_product_enabled: 'Product Page Inquiries Enabled',
  crm_inquiry_storefront_enabled: 'Storefront Inquiries Enabled',
  crm_inquiry_directory_enabled: 'Directory Inquiries Enabled',
  crm_inquiry_anonymous: 'Anonymous Inquiries',
  crm_inquiry_customer: 'Customer Inquiries',
  crm_inquiry_assignment: 'Inquiry Assignment',
  crm_inquiry_auto_response: 'Inquiry Auto-Response',
  crm_contact_management: 'Contact Management',
  crm_contact_import: 'Contact Import',
  crm_contact_sync: 'Contact Sync',
  crm_ticket_priority: 'Ticket Priority',
  crm_ticket_assignment: 'Ticket Assignment',
  crm_ticket_templates: 'Ticket Templates',
  crm_ticket_escalation: 'Ticket Escalation',
  crm_message_rich_text: 'Rich Text Messages',
  crm_message_attachments: 'Message Attachments',
  crm_message_templates: 'Message Templates',
  crm_customer_tickets: 'Customer Support Tickets',
  crm_dashboard_analytics: 'CRM Dashboard Analytics',
  crm_requests_hub: 'Requests Hub (Tenant-Facing)',
};

type TF = { featureKey: string; featureName: string; isEnabled: boolean; isInherited: boolean };
const f = (k: string, i = false): TF => ({
  featureKey: k,
  featureName: CRM_FEATURE_KEYS[k] || k,
  isEnabled: true,
  isInherited: i,
});

// Base feature sets
const DISCOVERY: TF[] = [
  f('crm_enabled'), f('crm_inquiry_product_enabled'), f('crm_inquiry_anonymous'),
  f('crm_inquiry_customer'), f('crm_contact_management'),
];
const STORE_ADD: TF[] = [
  f('crm_inquiry_storefront_enabled'), f('crm_inquiry_directory_enabled'),
  f('crm_inquiry_assignment'), f('crm_ticket_priority'), f('crm_ticket_assignment'),
];
const COMMIT_ADD: TF[] = [f('crm_message_rich_text')];
const ECOMMERCE_ADD: TF[] = [
  f('crm_inquiry_auto_response'), f('crm_contact_import'),
  f('crm_ticket_templates'), f('crm_message_attachments'), f('crm_message_templates'),
  f('crm_customer_tickets'), f('crm_dashboard_analytics'), f('crm_requests_hub'),
];
const FLEX_ALL: TF[] = [
  f('crm_enabled'), f('crm_flexible'), f('crm_inquiry_product_enabled'),
  f('crm_inquiry_storefront_enabled'), f('crm_inquiry_directory_enabled'),
  f('crm_inquiry_anonymous'), f('crm_inquiry_customer'), f('crm_inquiry_assignment'),
  f('crm_inquiry_auto_response'), f('crm_contact_management'), f('crm_contact_import'),
  f('crm_contact_sync'), f('crm_ticket_priority'), f('crm_ticket_assignment'),
  f('crm_ticket_templates'), f('crm_ticket_escalation'), f('crm_message_rich_text'),
  f('crm_message_attachments'), f('crm_message_templates'), f('crm_customer_tickets'),
  f('crm_dashboard_analytics'), f('crm_requests_hub'),
];

const TIER_CRM_FEATURES: Record<string, TF[]> = {
  discovery: DISCOVERY,
  storefront: [...DISCOVERY, ...STORE_ADD],
  commitment: [...DISCOVERY, ...STORE_ADD, ...COMMIT_ADD],
  ecommerce: [...DISCOVERY, ...STORE_ADD, ...COMMIT_ADD, ...ECOMMERCE_ADD],
  omnichannel: [...DISCOVERY, ...STORE_ADD, ...COMMIT_ADD, ...ECOMMERCE_ADD],
  professional: FLEX_ALL,
  enterprise: FLEX_ALL,
  organization: FLEX_ALL,
  chain_starter: FLEX_ALL,
  chain_professional: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  chain_enterprise: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  // Trial tiers mirror their base
  trial_discovery: DISCOVERY,
  trial_storefront: [...DISCOVERY, ...STORE_ADD],
  trial_commitment: [...DISCOVERY, ...STORE_ADD, ...COMMIT_ADD],
  trial_ecommerce: [...DISCOVERY, ...STORE_ADD, ...COMMIT_ADD, ...ECOMMERCE_ADD],
  trial_omnichannel: [...DISCOVERY, ...STORE_ADD, ...COMMIT_ADD, ...ECOMMERCE_ADD],
  trial_professional: FLEX_ALL,
  trial_enterprise: FLEX_ALL,
  trial_chain_starter: FLEX_ALL,
  trial_chain_professional: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  trial_chain_enterprise: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  // No CRM for these
  google_only: [],
  starter: [],
  trial_google_only: [],
  trial_starter: [],
  expired_trial: [],
};

async function main() {
  console.log('🌱 Seeding crm_options capability features...');

  const crmCapType = await prisma.capability_type_list.upsert({
    where: { key: 'crm_options' },
    update: { name: 'CRM Options', is_active: true, category: 'crm' },
    create: { id: 'captype_crm_options', key: 'crm_options', name: 'CRM Options', is_active: true, category: 'crm' },
  });
  console.log(`✓ Capability type: ${crmCapType.name} (${crmCapType.key})`);

  for (const [key, name] of Object.entries(CRM_FEATURE_KEYS)) {
    await prisma.features_list.upsert({
      where: { key },
      update: { name, is_active: true, category: 'crm_options' },
      create: { id: `feat_crm_${key}`, key, name, category: 'crm_options', is_active: true },
    });
  }
  console.log(`✓ Ensured ${Object.keys(CRM_FEATURE_KEYS).length} features_list entries exist`);

  for (const key of Object.keys(CRM_FEATURE_KEYS)) {
    const feature = await prisma.features_list.findUnique({ where: { key } });
    if (!feature) continue;
    await prisma.capability_features_list.upsert({
      where: { capability_type_id_feature_id: { capability_type_id: crmCapType.id, feature_id: feature.id } },
      update: { is_active: true },
      create: { id: `capfeat_crm_${key}`, capability_type_id: crmCapType.id, feature_id: feature.id, is_active: true },
    });
  }
  console.log('✓ Linked features to crm_options capability type');

  let totalCreated = 0;
  for (const [tierKey, features] of Object.entries(TIER_CRM_FEATURES)) {
    const tier = await prisma.subscription_tiers_list.findUnique({ where: { tier_key: tierKey } });
    if (!tier) { console.log(`⚠ Tier '${tierKey}' not found, skipping`); continue; }
    if (features.length === 0) { console.log(`⊘ Tier '${tierKey}' — no CRM features`); continue; }

    for (const feat of features) {
      const feature = await prisma.features_list.findUnique({ where: { key: feat.featureKey } });
      if (!feature) continue;
      await prisma.tier_features_list.upsert({
        where: { tier_id_feature_key: { tier_id: tier.id, feature_key: feat.featureKey } },
        update: { feature_name: feat.featureName, is_enabled: feat.isEnabled, is_inherited: feat.isInherited, capability_type_id: crmCapType.id, updated_at: new Date() },
        create: { id: `tf_crm_${tier.id}_${feat.featureKey}`, tier_id: tier.id, feature_key: feat.featureKey, feature_name: feat.featureName, is_enabled: feat.isEnabled, is_inherited: feat.isInherited, capability_type_id: crmCapType.id },
      });
      totalCreated++;
    }
    console.log(`✓ Added ${features.length} CRM features to tier: ${tierKey}`);
  }

  console.log(`✅ CRM capability seeding complete! ${totalCreated} tier features configured.`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
