#!/usr/bin/env node
/**
 * Delete Test Tenants Script
 * 
 * Removes standalone test tenants and their inventory.
 * 
 * Usage:
 *   node delete-test-tenants.js                    # Delete all standalone tenants
 *   node delete-test-tenants.js --id=xxx           # Delete specific tenant by ID
 *   node delete-test-tenants.js --keep-inventory   # Delete tenants but keep inventory
 *   node delete-test-tenants.js --chain-only       # Delete only chain tenants
 *   node delete-test-tenants.js --standalone-only  # Delete only standalone tenants
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const specificId = args.find(arg => arg.startsWith('--id='))?.split('=')[1];
const keepInventory = args.includes('--keep-inventory');
const chainOnly = args.includes('--chain-only');
const standaloneOnly = args.includes('--standalone-only');

async function deleteTenants() {
  console.log('🗑️  Cleaning up test tenants...\n');

  try {
    let tenants;

    if (specificId) {
      // Delete specific tenant
      console.log(`🎯 Targeting tenant: ${specificId}\n`);
      const tenant = await prisma.tenant.findUnique({
        where: { id: specificId },
        include: {
          items: true,
          organization: true,
        },
      });

      if (!tenant) {
        console.log('❌ Tenant not found');
        return;
      }

      tenants = [tenant];
    } else {
      // Get tenants based on filters
      const where = {};
      
      if (chainOnly) {
        where.organizationId = { not: null };
      } else if (standaloneOnly) {
        where.organizationId = null;
      }

      tenants = await prisma.tenant.findMany({
        where,
        include: {
          items: true,
          organization: true,
        },
      });

      if (tenants.length === 0) {
        console.log('✅ No tenants found. Database is clean!\n');
        return;
      }

      console.log(`📊 Found ${tenants.length} tenant(s)\n`);
    }

    let totalDeleted = 0;
    let totalItemsDeleted = 0;

    for (const tenant of tenants) {
      const itemCount = tenant.items.length;
      const isChain = !!tenant.organization;
      
      console.log(`\n🏪 Processing: ${tenant.name}`);
      console.log(`   Type: ${isChain ? `Chain (${tenant.organization.name})` : 'Standalone'}`);
      console.log(`   Items: ${itemCount}`);

      if (!keepInventory && itemCount > 0) {
        // Delete all items
        await prisma.inventoryItem.deleteMany({
          where: { tenantId: tenant.id },
        });
        console.log(`   ✅ Deleted ${itemCount} items`);
        totalItemsDeleted += itemCount;
      } else if (keepInventory && itemCount > 0) {
        console.log(`   ⏭️  Keeping ${itemCount} items`);
      }

      // Delete the tenant
      await prisma.tenant.delete({
        where: { id: tenant.id },
      });
      console.log(`   ✅ Deleted tenant: ${tenant.name}`);
      totalDeleted++;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Cleanup complete!\n');
    console.log(`📊 Summary:`);
    console.log(`   Tenants deleted: ${totalDeleted}`);
    if (!keepInventory) {
      console.log(`   Items deleted: ${totalItemsDeleted}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Confirmation prompt
console.log('⚠️  WARNING: This will delete data from your database!\n');

if (keepInventory) {
  console.log('📦 MODE: Delete tenants only (keep inventory)\n');
} else if (chainOnly) {
  console.log('🔗 MODE: Delete chain tenants only\n');
} else if (standaloneOnly) {
  console.log('🏪 MODE: Delete standalone tenants only\n');
} else if (specificId) {
  console.log(`🎯 MODE: Delete specific tenant: ${specificId}\n`);
} else {
  console.log('🗑️  MODE: Delete all tenants and their inventory\n');
}

console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
  deleteTenants()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}, 3000);
