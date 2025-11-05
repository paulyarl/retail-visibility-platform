/**
 * Direct database script to sync availability status for all items
 * Run with: npx tsx sync-availability-direct.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncAvailability() {
  try {
    console.log('🔄 Starting availability sync...\n');

    // Get all items
    const items = await prisma.inventoryItem.findMany({
      select: { id: true, tenantId: true, sku: true, stock: true, availability: true },
    });

    console.log(`📊 Found ${items.length} total items\n`);

    // Find items that are out of sync
    const outOfSync = items.filter(item => {
      const expectedAvailability = item.stock > 0 ? 'in_stock' : 'out_of_stock';
      return item.availability !== expectedAvailability;
    });

    console.log(`⚠️  Found ${outOfSync.length} items out of sync:\n`);
    
    if (outOfSync.length > 0) {
      // Show first 10 out-of-sync items
      outOfSync.slice(0, 10).forEach(item => {
        console.log(`   - SKU: ${item.sku}`);
        console.log(`     Stock: ${item.stock}, Current: ${item.availability}, Expected: ${item.stock > 0 ? 'in_stock' : 'out_of_stock'}`);
      });
      
      if (outOfSync.length > 10) {
        console.log(`   ... and ${outOfSync.length - 10} more\n`);
      } else {
        console.log('');
      }

      // Update out-of-sync items
      console.log('🔧 Updating items...\n');
      
      const updates = await Promise.all(
        outOfSync.map(item =>
          prisma.inventoryItem.update({
            where: { id: item.id },
            data: { availability: item.stock > 0 ? 'in_stock' : 'out_of_stock' },
          })
        )
      );

      console.log(`✅ Successfully synced ${updates.length} items!\n`);
    } else {
      console.log('✅ All items are already in sync!\n');
    }

    // Summary by tenant
    const tenantSummary = outOfSync.reduce((acc, item) => {
      acc[item.tenantId] = (acc[item.tenantId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(tenantSummary).length > 0) {
      console.log('📈 Summary by tenant:');
      Object.entries(tenantSummary).forEach(([tenantId, count]) => {
        console.log(`   ${tenantId}: ${count} items synced`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncAvailability();
