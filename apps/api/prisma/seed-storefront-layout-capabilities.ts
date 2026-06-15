/**
 * Seed script for storefront layout capability features
 *
 * Run with: npx tsx prisma/seed-storefront-layout-capabilities.ts
 */
/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const LAYOUT_FEATURE_KEYS: Record<string, string> = {
  storefront_opt_layout_enabled: 'Storefront Layout Group Enabled',
  storefront_opt_layout_disabled: 'Storefront Layout Group Disabled',
  storefront_opt_layout_classic: 'Classic Layout',
  storefront_opt_layout_editorial: 'Modern Editorial Layout',
  storefront_opt_layout_immersive: 'Immersive Commerce Layout',
};

type TF = { featureKey: string; featureName: string; isEnabled: boolean; isInherited: boolean };
const f = (k: string, i = false): TF => ({
  featureKey: k,
  featureName: LAYOUT_FEATURE_KEYS[k] || k,
  isEnabled: true,
  isInherited: i,
});

// Base feature sets
const CLASSIC_ONLY: TF[] = [f('storefront_opt_layout_classic')];
const CLASSIC_EDITORIAL: TF[] = [
  f('storefront_opt_layout_classic'),
  f('storefront_opt_layout_editorial'),
];
const ALL_LAYOUTS: TF[] = [
  f('storefront_opt_layout_classic'),
  f('storefront_opt_layout_editorial'),
  f('storefront_opt_layout_immersive'),
];
const FLEX_ALL: TF[] = [
  f('storefront_opt_layout_enabled'),
  f('storefront_opt_layout_classic'),
  f('storefront_opt_layout_editorial'),
  f('storefront_opt_layout_immersive'),
];

const TIER_LAYOUT_FEATURES: Record<string, TF[]> = {
  // Individual tiers
  starter: CLASSIC_ONLY,
  discovery: CLASSIC_ONLY,
  storefront: CLASSIC_ONLY,
  commitment: CLASSIC_EDITORIAL,
  ecommerce: ALL_LAYOUTS,
  omnichannel: ALL_LAYOUTS,
  professional: FLEX_ALL,
  enterprise: FLEX_ALL,
  // Organization / Chain tiers
  organization: FLEX_ALL,
  chain_starter: CLASSIC_ONLY,
  chain_professional: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  chain_enterprise: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  // Trial tiers mirror their base
  trial_starter: CLASSIC_ONLY,
  trial_discovery: CLASSIC_ONLY,
  trial_storefront: CLASSIC_ONLY,
  trial_commitment: CLASSIC_EDITORIAL,
  trial_ecommerce: ALL_LAYOUTS,
  trial_omnichannel: ALL_LAYOUTS,
  trial_professional: FLEX_ALL,
  trial_enterprise: FLEX_ALL,
  trial_chain_starter: CLASSIC_ONLY,
  trial_chain_professional: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  trial_chain_enterprise: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  // No layout features for these
  google_only: [],
  trial_google_only: [],
  expired_trial: [],
};

async function main() {
  console.log('🌱 Seeding storefront layout capability features...');

  const sfCapType = await prisma.capability_type_list.findUnique({
    where: { key: 'storefront_options' },
  });

  if (!sfCapType) {
    console.error('❌ Capability type "storefront_options" not found. Aborting.');
    process.exit(1);
  }
  console.log(`✓ Capability type: ${sfCapType.name} (${sfCapType.key})`);

  for (const [key, name] of Object.entries(LAYOUT_FEATURE_KEYS)) {
    await prisma.features_list.upsert({
      where: { key },
      update: { name, is_active: true, category: 'storefront_options' },
      create: { id: `feat_sfo_${key}`, key, name, category: 'storefront_options', is_active: true },
    });
  }
  console.log(`✓ Ensured ${Object.keys(LAYOUT_FEATURE_KEYS).length} features_list entries exist`);

  for (const key of Object.keys(LAYOUT_FEATURE_KEYS)) {
    const feature = await prisma.features_list.findUnique({ where: { key } });
    if (!feature) continue;
    await prisma.capability_features_list.upsert({
      where: { capability_type_id_feature_id: { capability_type_id: sfCapType.id, feature_id: feature.id } },
      update: { is_active: true },
      create: { id: `capfeat_sfo_${key}`, capability_type_id: sfCapType.id, feature_id: feature.id, is_active: true },
    });
  }
  console.log('✓ Linked layout features to storefront_options capability type');

  let totalCreated = 0;
  for (const [tierKey, features] of Object.entries(TIER_LAYOUT_FEATURES)) {
    const tier = await prisma.subscription_tiers_list.findUnique({ where: { tier_key: tierKey } });
    if (!tier) { console.log(`⚠ Tier '${tierKey}' not found, skipping`); continue; }
    if (features.length === 0) { console.log(`⊘ Tier '${tierKey}' — no layout features`); continue; }

    for (const feat of features) {
      const feature = await prisma.features_list.findUnique({ where: { key: feat.featureKey } });
      if (!feature) continue;
      await prisma.tier_features_list.upsert({
        where: { tier_id_feature_key: { tier_id: tier.id, feature_key: feat.featureKey } },
        update: { feature_name: feat.featureName, is_enabled: feat.isEnabled, is_inherited: feat.isInherited, capability_type_id: sfCapType.id, updated_at: new Date() },
        create: { id: `tf_sfo_${tier.id}_${feat.featureKey}`, tier_id: tier.id, feature_key: feat.featureKey, feature_name: feat.featureName, is_enabled: feat.isEnabled, is_inherited: feat.isInherited, capability_type_id: sfCapType.id },
      });
      totalCreated++;
    }
    console.log(`✓ Added ${features.length} layout features to tier: ${tierKey}`);
  }

  console.log(`✅ Storefront layout capability seeding complete! ${totalCreated} tier features configured.`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
