/**
 * Fix Feature Key Spaces in tier_features_list
 *
 * Root cause: Some feature_key values in tier_features_list have leading/trailing
 * spaces (e.g., "  crm_enabled" instead of "crm_enabled"). This causes prefix-based
 * queries (startsWith: 'crm_') to miss them, breaking capability resolution.
 *
 * This script:
 * 1. Finds all feature_key values with leading/trailing spaces
 * 2. Trims them and updates the records
 * 3. Reports what was fixed
 *
 * Run: node scripts/fix_feature_key_spaces.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Scanning tier_features_list for feature_key values with spaces...');

  // Find all records where feature_key has leading/trailing spaces
  const allFeatures = await prisma.tier_features_list.findMany({
    select: { id: true, feature_key: true, tier_id: true },
  });

  const dirty = allFeatures.filter(f => f.feature_key !== f.feature_key.trim());

  if (dirty.length === 0) {
    console.log('✅ No feature_key values with leading/trailing spaces found.');
    return;
  }

  console.log(`⚠ Found ${dirty.length} feature_key value(s) with spaces:`);
  for (const f of dirty) {
    console.log(`   id=${f.id} tier_id=${f.tier_id} key="${f.feature_key}" → "${f.feature_key.trim()}"`);
  }

  // Fix them
  let fixed = 0;
  for (const f of dirty) {
    const trimmed = f.feature_key.trim();
    try {
      // Check if a record with the trimmed key already exists for this tier
      const existing = await prisma.tier_features_list.findFirst({
        where: {
          tier_id: f.tier_id,
          feature_key: trimmed,
          id: { not: f.id },
        },
      });

      if (existing) {
        // Merge: delete the duplicate with spaces, keep the clean one
        console.log(`   Merging duplicate: deleting id=${f.id}, keeping id=${existing.id} for key="${trimmed}"`);
        await prisma.tier_features_list.delete({ where: { id: f.id } });
      } else {
        // Update the key directly
        await prisma.tier_features_list.update({
          where: { id: f.id },
          data: { feature_key: trimmed },
        });
        console.log(`   ✓ Fixed id=${f.id}: "${f.feature_key}" → "${trimmed}"`);
      }
      fixed++;
    } catch (err) {
      console.error(`   ✗ Failed to fix id=${f.id}: ${err.message}`);
    }
  }

  console.log(`\n✅ Fixed ${fixed} of ${dirty.length} feature_key value(s).`);

  // Also check features_list table
  console.log('\n🔍 Scanning features_list for key values with spaces...');
  const allFeatureDefs = await prisma.features_list.findMany({
    select: { id: true, key: true },
  });

  const dirtyDefs = allFeatureDefs.filter(f => f.key !== f.key.trim());
  if (dirtyDefs.length === 0) {
    console.log('✅ No features_list key values with spaces found.');
  } else {
    console.log(`⚠ Found ${dirtyDefs.length} features_list key value(s) with spaces:`);
    for (const f of dirtyDefs) {
      console.log(`   id=${f.id} key="${f.key}" → "${f.key.trim()}"`);
      try {
        await prisma.features_list.update({
          where: { id: f.id },
          data: { key: f.key.trim() },
        });
        console.log(`   ✓ Fixed id=${f.id}`);
      } catch (err) {
        console.error(`   ✗ Failed: ${err.message}`);
      }
    }
  }
}

main()
  .catch(e => { console.error('❌ Script failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
