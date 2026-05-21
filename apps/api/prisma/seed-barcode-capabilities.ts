/**
 * Seed script for barcode_scan_options capability features
 * 
 * Adds barcode capability features to tiers and links them
 * to the barcode_scan_options capability type.
 * 
 * Run with: npx tsx prisma/seed-barcode-capabilities.ts
 */
/// <reference types="node" />

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Tier barcode feature assignments
 * 
 * Professional: barcode_enabled, barcode_scan, barcode_manual, barcode_usb
 * Enterprise: All of Professional + barcode_camera
 * Organization: All features + barcode_flexible
 * Discovery: barcode_enabled, barcode_manual (limited)
 * 
 * barcode_disabled is NOT assigned to any tier — it's used by the resolver
 * to detect explicit disable state and is only set at the tenant level.
 */
const TIER_BARCODE_FEATURES: Record<string, { featureKey: string; featureName: string; isEnabled: boolean; isInherited: boolean }[]> = {
  discovery: [
    { featureKey: 'barcode_enabled', featureName: 'Barcode Scanning', isEnabled: true, isInherited: false },
    { featureKey: 'barcode_manual', featureName: 'Manual Barcode Entry', isEnabled: true, isInherited: false },
  ],
  professional: [
    { featureKey: 'barcode_enabled', featureName: 'Barcode Scanning', isEnabled: true, isInherited: false },
    { featureKey: 'barcode_scan', featureName: 'Smart Barcode Scanner', isEnabled: true, isInherited: false },
    { featureKey: 'barcode_manual', featureName: 'Manual Barcode Entry', isEnabled: true, isInherited: false },
    { featureKey: 'barcode_usb', featureName: 'USB Barcode Scanner', isEnabled: true, isInherited: false },
  ],
  enterprise: [
    { featureKey: 'barcode_enabled', featureName: 'Barcode Scanning', isEnabled: true, isInherited: true },
    { featureKey: 'barcode_scan', featureName: 'Smart Barcode Scanner', isEnabled: true, isInherited: true },
    { featureKey: 'barcode_manual', featureName: 'Manual Barcode Entry', isEnabled: true, isInherited: true },
    { featureKey: 'barcode_usb', featureName: 'USB Barcode Scanner', isEnabled: true, isInherited: true },
    { featureKey: 'barcode_camera', featureName: 'Camera Barcode Scanner', isEnabled: true, isInherited: false },
  ],
  organization: [
    { featureKey: 'barcode_enabled', featureName: 'Barcode Scanning', isEnabled: true, isInherited: true },
    { featureKey: 'barcode_scan', featureName: 'Smart Barcode Scanner', isEnabled: true, isInherited: true },
    { featureKey: 'barcode_manual', featureName: 'Manual Barcode Entry', isEnabled: true, isInherited: true },
    { featureKey: 'barcode_usb', featureName: 'USB Barcode Scanner', isEnabled: true, isInherited: true },
    { featureKey: 'barcode_camera', featureName: 'Camera Barcode Scanner', isEnabled: true, isInherited: true },
    { featureKey: 'barcode_flexible', featureName: 'Flexible Barcode Options', isEnabled: true, isInherited: false },
  ],
};

async function main() {
  console.log('🌱 Seeding barcode_scan_options capability features...');

  // 1. Find the barcode_scan_options capability type
  const barcodeCapType = await prisma.capability_type_list.findUnique({
    where: { key: 'barcode_scan_options' },
  });

  if (!barcodeCapType) {
    console.error('❌ barcode_scan_options capability type not found. Run capability type seed first.');
    process.exit(1);
  }

  console.log(`✓ Found capability type: ${barcodeCapType.name} (${barcodeCapType.key})`);

  // 2. Ensure features_list entries exist for all barcode feature keys
  const allFeatureKeys = new Set<string>();
  for (const features of Object.values(TIER_BARCODE_FEATURES)) {
    for (const f of features) {
      allFeatureKeys.add(f.featureKey);
    }
  }

  // Also add barcode_disabled to features_list (not assigned to any tier, but needed for resolver)
  allFeatureKeys.add('barcode_disabled');

  const featureKeyNames: Record<string, string> = {
    barcode_enabled: 'Barcode Scanning',
    barcode_scan: 'Smart Barcode Scanner',
    barcode_manual: 'Manual Barcode Entry',
    barcode_usb: 'USB Barcode Scanner',
    barcode_camera: 'Camera Barcode Scanner',
    barcode_flexible: 'Flexible Barcode Options',
    barcode_disabled: 'Barcode Disabled',
  };

  for (const key of allFeatureKeys) {
    await prisma.features_list.upsert({
      where: { key },
      update: { name: featureKeyNames[key] || key, is_active: true },
      create: {
        id: `feat_barcode_${key}`,
        key,
        name: featureKeyNames[key] || key,
        is_active: true,
      },
    });
  }
  console.log(`✓ Ensured ${allFeatureKeys.size} features_list entries exist`);

  // 3. Ensure capability_features_list entries link features to the capability type
  for (const key of allFeatureKeys) {
    const feature = await prisma.features_list.findUnique({ where: { key } });
    if (!feature) continue;

    await prisma.capability_features_list.upsert({
      where: {
        capability_type_id_feature_id: {
          capability_type_id: barcodeCapType.id,
          feature_id: feature.id,
        },
      },
      update: { is_active: true },
      create: {
        id: `capfeat_barcode_${key}`,
        capability_type_id: barcodeCapType.id,
        feature_id: feature.id,
        is_active: true,
        is_default: key !== 'barcode_disabled', // All features default to active except disabled
      },
    });
  }
  console.log('✓ Linked features to barcode_scan_options capability type');

  // 4. Add tier_features_list entries for each tier
  let totalCreated = 0;
  for (const [tierKey, features] of Object.entries(TIER_BARCODE_FEATURES)) {
    const tier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierKey },
    });

    if (!tier) {
      console.log(`⚠ Tier '${tierKey}' not found, skipping`);
      continue;
    }

    for (const feat of features) {
      const feature = await prisma.features_list.findUnique({ where: { key: feat.featureKey } });
      if (!feature) continue;

      const result = await prisma.tier_features_list.upsert({
        where: {
          tier_id_feature_key: { tier_id: tier.id, feature_key: feat.featureKey },
        },
        update: {
          feature_name: feat.featureName,
          is_enabled: feat.isEnabled,
          is_inherited: feat.isInherited,
          capability_type_id: barcodeCapType.id,
          updated_at: new Date(),
        },
        create: {
          id: `tf_barcode_${tier.id}_${feat.featureKey}`,
          tier_id: tier.id,
          feature_key: feat.featureKey,
          feature_name: feat.featureName,
          is_enabled: feat.isEnabled,
          is_inherited: feat.isInherited,
          capability_type_id: barcodeCapType.id,
        },
      });

      totalCreated++;
    }

    console.log(`✓ Added ${features.length} barcode features to tier: ${tierKey}`);
  }

  console.log(`✅ Barcode capability seeding complete! ${totalCreated} tier features configured.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
