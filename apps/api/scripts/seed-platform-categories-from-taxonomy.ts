/**
 * Seed google_taxonomy_list from Google Product Taxonomy
 * 
 * This script:
 * 1. Loads real Google Product Categories from taxonomy-data.json
 * 2. Inserts them into google_taxonomy_list with proper numeric category_id values
 * 
 * This table will be the source of truth for product categories used by:
 * - Item category assignment
 * - Category propagation
 * - Platform category references
 * 
 * Note: platform_categories remains as-is (store/business types for GBP)
 * 
 * Usage: npx tsx scripts/seed-google-taxonomy-list.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface TaxonomyCategory {
  id: string;
  name: string;
  path: string[];
  fullPath: string;
}

interface TaxonomyData {
  version: string;
  downloadedAt: string;
  totalCategories: number;
  categories: TaxonomyCategory[];
}

async function seedGoogleTaxonomyList() {
  console.log('🔄 Seeding google_taxonomy_list from Google Product Taxonomy...\n');

  // Load taxonomy data
  const taxonomyPath = path.join(__dirname, '../src/lib/google/taxonomy-data.json');
  console.log(`📂 Loading taxonomy from: ${taxonomyPath}`);
  
  if (!fs.existsSync(taxonomyPath)) {
    console.error('❌ Taxonomy file not found!');
    process.exit(1);
  }

  const taxonomyRaw = fs.readFileSync(taxonomyPath, 'utf-8');
  const taxonomyData: TaxonomyData = JSON.parse(taxonomyRaw);
  
  console.log(`📊 Taxonomy version: ${taxonomyData.version}`);
  console.log(`📊 Total categories: ${taxonomyData.totalCategories}\n`);

  // Step 1: Count and show existing data
  const existingCount = await prisma.google_taxonomy_list.count();
  console.log(`📋 Existing google_taxonomy_list: ${existingCount}`);
  
  if (existingCount > 0) {
    const sample = await prisma.google_taxonomy_list.findMany({ take: 3 });
    console.log('📋 Sample existing entries:');
    sample.forEach(cat => {
      console.log(`   - ${cat.category_path} (category_id: ${cat.category_id})`);
    });
    console.log('\n🗑️  Purging existing entries...');
    await prisma.google_taxonomy_list.deleteMany({});
    console.log('✅ Purged successfully\n');
  }

  // Step 2: Build parent_id mapping
  console.log('🔗 Building parent relationships...');
  const pathToId = new Map<string, string>();
  taxonomyData.categories.forEach(cat => {
    pathToId.set(cat.fullPath, cat.id);
  });

  // Step 3: Prepare categories for insertion
  console.log('📦 Preparing categories for insertion...');
  
  const categoriesToInsert = taxonomyData.categories.map(cat => {
    // Derive parent_id from path (remove last element to get parent path)
    let parentId: string | null = null;
    if (cat.path.length > 1) {
      const parentPath = cat.path.slice(0, -1).join(' > ');
      parentId = pathToId.get(parentPath) || null;
    }

    return {
      id: `gtl_${uuidv4()}`,
      category_id: cat.id, // Real numeric Google taxonomy ID
      category_path: cat.fullPath,
      parent_id: parentId,
      level: cat.path.length,
      is_active: true,
      version: taxonomyData.version,
    };
  });

  console.log(`📊 Prepared ${categoriesToInsert.length} categories\n`);

  // Step 4: Insert in batches
  console.log('💾 Inserting categories in batches...');
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < categoriesToInsert.length; i += BATCH_SIZE) {
    const batch = categoriesToInsert.slice(i, i + BATCH_SIZE);
    
    const values = batch.map(cat => 
      `('${cat.id}', '${cat.category_id}', '${cat.category_path.replace(/'/g, "''")}', ${cat.parent_id ? `'${cat.parent_id}'` : 'NULL'}, ${cat.level}, ${cat.is_active}, '${cat.version}', NOW(), NOW())`
    ).join(',\n');

    await prisma.$executeRawUnsafe(`
      INSERT INTO google_taxonomy_list 
        (id, category_id, category_path, parent_id, level, is_active, version, created_at, updated_at)
      VALUES 
        ${values}
    `);
    
    inserted += batch.length;
    console.log(`   ✅ Inserted ${inserted}/${categoriesToInsert.length}`);
  }

  // Step 5: Verify
  const finalCount = await prisma.google_taxonomy_list.count();
  console.log(`\n✅ Seeding complete!`);
  console.log(`📊 Final count: ${finalCount} categories`);
  
  // Show sample of new data - top level
  const topLevel = await prisma.google_taxonomy_list.findMany({ 
    where: { level: 1 },
    take: 10,
    orderBy: { category_path: 'asc' }
  });
  console.log('\n📋 Top-level categories:');
  topLevel.forEach(cat => {
    console.log(`   - ${cat.category_path} (ID: ${cat.category_id})`);
  });

  // Show some deeper categories
  const deepCategories = await prisma.google_taxonomy_list.findMany({
    where: { level: { gte: 4 } },
    take: 5,
    orderBy: { category_path: 'asc' }
  });
  console.log('\n📋 Sample deep categories (level 4+):');
  deepCategories.forEach(cat => {
    console.log(`   - ${cat.category_path} (ID: ${cat.category_id})`);
  });

  await prisma.$disconnect();
  console.log('\n🎉 Done!');
}

// Run the seed
seedGoogleTaxonomyList().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
