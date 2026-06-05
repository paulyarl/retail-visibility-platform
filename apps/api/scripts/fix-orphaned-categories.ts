/**
 * Fix orphaned category references
 * Sets tenantCategoryId to NULL for items that reference non-existent categories
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrphanedCategories() {
  try {
    console.log('🔍 Finding items with orphaned category references...');
    
    // Get all items with tenantCategoryId
    const itemsWithCategories = await prisma.inventoryItem.findMany({
      where: {
        tenantCategoryId: {
          not: null,
        },
      },
      select: {
        id: true,
        tenantCategoryId: true,
        name: true,
      },
    });

    console.log(`Found ${itemsWithCategories.length} items with category references`);

    let orphanedCount = 0;

    for (const item of itemsWithCategories) {
      if (!item.tenantCategoryId) continue;

      // Check if category exists
      const categoryExists = await prisma.tenantCategory.findUnique({
        where: { id: item.tenantCategoryId },
      });

      if (!categoryExists) {
        console.log(`❌ Orphaned: ${item.name} → ${item.tenantCategoryId}`);
        
        // Set to NULL
        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { tenantCategoryId: null },
        });

        orphanedCount++;
      }
    }

    console.log(`\n✅ Fixed ${orphanedCount} orphaned category references`);
    console.log(`✅ ${itemsWithCategories.length - orphanedCount} valid category references remain`);

  } catch (error) {
    console.error('❌ Error fixing orphaned categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanedCategories()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
