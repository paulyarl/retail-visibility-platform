/**
 * Seed script for product_types capability features
 *
 * Creates the product_types capability type, feature keys, capability-feature links,
 * and tier feature assignments for product type gating (physical, digital, hybrid, service).
 *
 * Run with: npx tsx prisma/seed-product-types-capabilities.ts
 */
/// <reference types="node" />
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

type TF = { featureKey: string; featureName: string; isEnabled: boolean; isInherited: boolean };
const f = (k: string, name: string, i = false): TF => ({
  featureKey: k,
  featureName: name,
  isEnabled: true,
  isInherited: i,
});

// ─── Feature definitions ───
const PRODUCT_TYPE_FEATURES: Record<string, string> = {
  product_types_enabled:   'Product Types Enabled',
  product_types_disabled:  'Product Types Disabled',
  product_types_flexible:  'Product Types Flexible',
  product_types_physical:  'Physical Products',
  product_types_digital:   'Digital Products',
  product_types_hybrid:    'Hybrid Products',
  product_types_service:   'Service Products',
};

// ─── Tier assignments ───
const PHYSICAL_DIGITAL: TF[] = [
  f('product_types_enabled', 'Product Types Enabled'),
  f('product_types_physical', 'Physical Products'),
  f('product_types_digital', 'Digital Products'),
];

const PLUS_HYBRID: TF[] = [
  ...PHYSICAL_DIGITAL,
  f('product_types_hybrid', 'Hybrid Products'),
];

const PLUS_SERVICE: TF[] = [
  ...PLUS_HYBRID,
  f('product_types_service', 'Service Products'),
];

const FLEX_ALL: TF[] = [
  ...PLUS_SERVICE,
  f('product_types_flexible', 'Product Types Flexible'),
];

const TIER_PRODUCT_TYPE_FEATURES: Record<string, TF[]> = {
  // Individual tiers
  starter: PHYSICAL_DIGITAL,
  discovery: PHYSICAL_DIGITAL,
  storefront: PHYSICAL_DIGITAL,
  commitment: PLUS_HYBRID,
  ecommerce: PLUS_SERVICE,
  omnichannel: PLUS_SERVICE,
  professional: FLEX_ALL,
  enterprise: FLEX_ALL,
  // Organization / Chain tiers
  organization: FLEX_ALL,
  chain_starter: PHYSICAL_DIGITAL,
  chain_professional: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  chain_enterprise: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  // Trial tiers mirror their base
  trial_starter: PHYSICAL_DIGITAL,
  trial_discovery: PHYSICAL_DIGITAL,
  trial_storefront: PHYSICAL_DIGITAL,
  trial_commitment: PLUS_HYBRID,
  trial_ecommerce: PLUS_SERVICE,
  trial_omnichannel: PLUS_SERVICE,
  trial_professional: FLEX_ALL,
  trial_enterprise: FLEX_ALL,
  trial_chain_starter: PHYSICAL_DIGITAL,
  trial_chain_professional: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  trial_chain_enterprise: FLEX_ALL.map(x => ({ ...x, isInherited: true })),
  // No product type features for these
  google_only: [],
  trial_google_only: [],
  expired_trial: [],
};

async function main() {
  console.log('🌱 Seeding product_types capability features...');

  // 1. Ensure product_types capability type exists
  const productTypesCapType = await prisma.capability_type_list.upsert({
    where: { key: 'product_types' },
    update: { name: 'Product Types', is_active: true, category: 'product_types' },
    create: {
      id: 'captype_product_types',
      key: 'product_types',
      name: 'Product Types',
      description: 'Product type selection including physical, digital, hybrid, and service types.',
      category: 'product_types',
      is_active: true,
      sort_order: 4,
    },
  });
  console.log(`✓ Capability type: ${productTypesCapType.name} (${productTypesCapType.key})`);

  // 2. Insert feature keys into features_list
  for (const [key, name] of Object.entries(PRODUCT_TYPE_FEATURES)) {
    await prisma.features_list.upsert({
      where: { key },
      update: { name, is_active: true, category: 'product_types' },
      create: { id: `feat_pt_${key}`, key, name, category: 'product_types', is_active: true },
    });
  }
  console.log(`✓ Ensured ${Object.keys(PRODUCT_TYPE_FEATURES).length} features_list entries exist`);

  // 3. Link features to product_types capability type
  for (const key of Object.keys(PRODUCT_TYPE_FEATURES)) {
    const feature = await prisma.features_list.findUnique({ where: { key } });
    if (!feature) continue;
    await prisma.capability_features_list.upsert({
      where: { capability_type_id_feature_id: { capability_type_id: productTypesCapType.id, feature_id: feature.id } },
      update: { is_active: true },
      create: { id: `capfeat_pt_${key}`, capability_type_id: productTypesCapType.id, feature_id: feature.id, is_active: true },
    });
  }
  console.log('✓ Linked features to product_types capability type');

  // 4. Seed tier features
  let totalCreated = 0;
  for (const [tierKey, features] of Object.entries(TIER_PRODUCT_TYPE_FEATURES)) {
    const tier = await prisma.subscription_tiers_list.findUnique({ where: { tier_key: tierKey } });
    if (!tier) { console.log(`⚠ Tier '${tierKey}' not found, skipping`); continue; }
    if (features.length === 0) { console.log(`⊘ Tier '${tierKey}' — no product type features`); continue; }

    for (const feat of features) {
      const feature = await prisma.features_list.findUnique({ where: { key: feat.featureKey } });
      if (!feature) continue;
      await prisma.tier_features_list.upsert({
        where: { tier_id_feature_key: { tier_id: tier.id, feature_key: feat.featureKey } },
        update: {
          feature_name: feat.featureName,
          is_enabled: feat.isEnabled,
          is_inherited: feat.isInherited,
          capability_type_id: productTypesCapType.id,
          updated_at: new Date(),
        },
        create: {
          id: `tf_pt_${tier.id}_${feat.featureKey}`,
          tier_id: tier.id,
          feature_key: feat.featureKey,
          feature_name: feat.featureName,
          is_enabled: feat.isEnabled,
          is_inherited: feat.isInherited,
          capability_type_id: productTypesCapType.id,
        },
      });
      totalCreated++;
    }
    console.log(`✓ Added ${features.length} product type features to tier: ${tierKey}`);
  }

  console.log(`✅ Product types capability seeding complete! ${totalCreated} tier features configured.`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
