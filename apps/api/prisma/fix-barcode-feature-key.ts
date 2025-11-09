/**
 * Fix feature key mismatch: product_scanning -> barcode_scan
 * Run with: npx tsx prisma/fix-barcode-feature-key.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing barcode feature key mismatch...');

  // Update all tier features that have product_scanning to barcode_scan
  const result = await prisma.tierFeature.updateMany({
    where: {
      featureKey: 'product_scanning'
    },
    data: {
      featureKey: 'barcode_scan',
      featureName: 'Smart Barcode Scanner'
    }
  });

  console.log(`✅ Updated ${result.count} tier features from 'product_scanning' to 'barcode_scan'`);

  // List affected tiers
  const affectedTiers = await prisma.subscriptionTier.findMany({
    where: {
      features: {
        some: {
          featureKey: 'barcode_scan'
        }
      }
    },
    select: {
      tierKey: true,
      name: true
    }
  });

  console.log('\n📋 Affected tiers:');
  affectedTiers.forEach(tier => {
    console.log(`  - ${tier.name} (${tier.tierKey})`);
  });

  console.log('\n✨ Feature key fix complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
