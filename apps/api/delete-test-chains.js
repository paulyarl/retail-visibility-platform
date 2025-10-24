/**
 * Delete Test Chains Script
 * 
 * Removes all test chain organizations and their associated data.
 * This will:
 * - Delete all organizations
 * - Unlink tenants from organizations (tenants remain as standalone)
 * - Optionally delete tenants and their inventory
 * 
 * Usage:
 *   node delete-test-chains.js              # Delete organizations only (keep tenants)
 *   node delete-test-chains.js --all        # Delete organizations AND all chain tenants
 *   node delete-test-chains.js --org-id=xxx # Delete specific organization by ID
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const deleteAll = args.includes('--all');
const specificOrgId = args.find(arg => arg.startsWith('--org-id='))?.split('=')[1];

async function deleteTestChains() {
  console.log('🗑️  Cleaning up test chains...\n');

  try {
    let organizations;

    if (specificOrgId) {
      // Delete specific organization
      console.log(`🎯 Targeting organization: ${specificOrgId}\n`);
      const org = await prisma.organization.findUnique({
        where: { id: specificOrgId },
        include: {
          tenants: {
            include: {
              items: true,
            },
          },
        },
      });

      if (!org) {
        console.log('❌ Organization not found');
        return;
      }

      organizations = [org];
    } else {
      // Get all organizations
      organizations = await prisma.organization.findMany({
        include: {
          tenants: {
            include: {
              items: true,
            },
          },
        },
      });

      if (organizations.length === 0) {
        console.log('✅ No organizations found. Database is clean!\n');
        return;
      }

      console.log(`📊 Found ${organizations.length} organization(s)\n`);
    }

    for (const org of organizations) {
      console.log(`\n🏢 Processing: ${org.name} (${org.id})`);
      console.log(`   Locations: ${org.tenants.length}`);

      if (deleteAll && org.tenants.length > 0) {
        // Delete tenants and their inventory
        console.log('   🗑️  Deleting tenants and inventory...');
        
        for (const tenant of org.tenants) {
          const itemCount = tenant.items.length;
          
          // Delete all items for this tenant
          if (itemCount > 0) {
            await prisma.inventoryItem.deleteMany({
              where: { tenantId: tenant.id },
            });
            console.log(`      ✅ Deleted ${itemCount} items from ${tenant.name}`);
          }

          // Delete the tenant
          await prisma.tenant.delete({
            where: { id: tenant.id },
          });
          console.log(`      ✅ Deleted tenant: ${tenant.name}`);
        }
      } else if (org.tenants.length > 0) {
        // Just unlink tenants (set organizationId to null)
        console.log('   🔗 Unlinking tenants (keeping as standalone)...');
        
        await prisma.tenant.updateMany({
          where: { organizationId: org.id },
          data: { organizationId: null },
        });
        
        console.log(`      ✅ Unlinked ${org.tenants.length} tenant(s)`);
      }

      // Delete the organization
      await prisma.organization.delete({
        where: { id: org.id },
      });
      console.log(`   ✅ Deleted organization: ${org.name}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Cleanup complete!\n');

    if (!deleteAll) {
      console.log('💡 Note: Tenants were unlinked but kept as standalone locations.');
      console.log('   To delete tenants too, run: node delete-test-chains.js --all\n');
    }

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Confirmation prompt
console.log('⚠️  WARNING: This will delete data from your database!\n');

if (deleteAll) {
  console.log('🔥 MODE: Delete organizations AND all chain tenants (with inventory)\n');
} else if (specificOrgId) {
  console.log(`🎯 MODE: Delete specific organization: ${specificOrgId}\n`);
} else {
  console.log('🔗 MODE: Delete organizations only (tenants will become standalone)\n');
}

console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
  deleteTestChains()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}, 3000);
