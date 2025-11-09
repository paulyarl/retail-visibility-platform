/**
 * Check what features are in the Professional tier
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking Professional tier features...\n');

  const professionalTier = await prisma.subscriptionTier.findFirst({
    where: {
      tierKey: 'professional'
    },
    include: {
      features: true
    }
  });

  if (!professionalTier) {
    console.log('❌ Professional tier not found');
    return;
  }

  console.log(`Tier: ${professionalTier.name} (${professionalTier.tierKey})`);
  console.log(`Features count: ${professionalTier.features.length}\n`);

  // Look for barcode-related features
  const barcodeFeatures = professionalTier.features.filter(f => 
    f.featureKey.includes('barcode') || f.featureKey.includes('scan')
  );

  console.log('Barcode/Scan related features:');
  barcodeFeatures.forEach(f => {
    console.log(`  - ${f.featureKey}: ${f.featureName}`);
  });

  // Check chain_professional too
  console.log('\n🔍 Checking Chain Professional tier...\n');

  const chainProfessional = await prisma.subscriptionTier.findFirst({
    where: {
      tierKey: 'chain_professional'
    },
    include: {
      features: true
    }
  });

  if (chainProfessional) {
    console.log(`Tier: ${chainProfessional.name} (${chainProfessional.tierKey})`);
    console.log(`Features count: ${chainProfessional.features.length}\n`);

    const chainBarcodeFeatures = chainProfessional.features.filter(f => 
      f.featureKey.includes('barcode') || f.featureKey.includes('scan')
    );

    console.log('Barcode/Scan related features:');
    chainBarcodeFeatures.forEach(f => {
      console.log(`  - ${f.featureKey}: ${f.featureName}`);
    });
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
