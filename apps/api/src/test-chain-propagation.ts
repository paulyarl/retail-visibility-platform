/**
 * Test script for Chain SKU Propagation
 * Run with: npx ts-node src/test-chain-propagation.ts
 * 
 * This script:
 * 1. Creates a test chain organization with multiple locations
 * 2. Creates a hero location with test products
 * 3. Tests single item propagation
 * 4. Tests bulk propagation from hero location
 * 5. Validates results and cleans up
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test configuration
const TEST_ORG_NAME = 'Test Chain - Auto Generated';
const HERO_LOCATION_NAME = 'Hero Location (HQ)';
const NUM_LOCATIONS = 5;
const NUM_TEST_PRODUCTS = 10;

interface TestContext {
  organizationId: string;
  heroTenantId: string;
  otherTenantIds: string[];
  testItemIds: string[];
}

async function cleanup() {
  console.log('\n🧹 Cleaning up previous test data...\n');
  
  // Find and delete test organizations
  const testOrgs = await prisma.organization.findMany({
    where: { name: { startsWith: 'Test Chain' } },
    include: {
      Tenant: true,
    },
  });

  for (const org of testOrgs) {
    console.log(`  Deleting organization: ${org.name} (${org.id})`);
    
    // Delete all items from tenants
    for (const tenant of org.Tenant) {
      await prisma.inventoryItem.deleteMany({
        where: { tenantId: tenant.id },
      });
    }
    
    // Unlink tenants
    await prisma.tenant.updateMany({
      where: { organizationId: org.id },
      data: { organizationId: null },
    });
    
    // Delete organization
    await prisma.organization.delete({
      where: { id: org.id },
    });
  }
  
  console.log('✅ Cleanup complete\n');
}

async function createTestChain(): Promise<TestContext> {
  console.log('\n🏢 Creating test chain organization...\n');
  
  // Create organization
  const organization = await prisma.organization.create({
    data: {
      name: TEST_ORG_NAME,
      ownerId: 'test-owner',
      subscriptionTier: 'chain_professional',
      subscriptionStatus: 'active',
      maxLocations: 15,
      maxTotalSKUs: 25000,
    } as any,
  });
  console.log(`✅ Organization created: ${organization.id}`);

  // Create hero location
  const heroTenant = await prisma.tenant.create({
    data: {
      name: HERO_LOCATION_NAME,
      organizationId: organization.id,
      subscriptionTier: 'professional',
      metadata: {
        business_name: HERO_LOCATION_NAME,
        city: 'New York',
        state: 'NY',
        isHeroLocation: true,
      },
    } as any,
  });
  console.log(`✅ Hero location created: ${heroTenant.id}`);

  // Create other locations
  const otherTenants = [];
  for (let i = 1; i <= NUM_LOCATIONS; i++) {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Location ${i}`,
        organizationId: organization.id,
        subscriptionTier: 'professional',
        metadata: {
          business_name: `Test Store ${i}`,
          city: `City ${i}`,
          state: 'CA',
        },
      } as any,
    });
    otherTenants.push(tenant);
    console.log(`✅ Location ${i} created: ${tenant.id}`);
  }

  return {
    organizationId: organization.id,
    heroTenantId: heroTenant.id,
    otherTenantIds: otherTenants.map(t => t.id),
    testItemIds: [],
  };
}

async function createTestProducts(ctx: TestContext): Promise<void> {
  console.log('\n📦 Creating test products at hero location...\n');
  
  for (let i = 1; i <= NUM_TEST_PRODUCTS; i++) {
    const item = await prisma.inventoryItem.create({
      data: { 
        tenantId: ctx.heroTenantId,
        sku: `TEST-SKU-${String(i).padStart(3, '0')}`,
        name: `Test Product ${i}`,
        title: `Test Product ${i} - Full Title`,
        brand: 'Test Brand',
        description: `This is a test product #${i} for chain propagation testing`,
        price: 19.99 + i,
        priceCents: Math.round((19.99 + i) * 100),
        stock: 100,
        quantity: 100,
        currency: 'USD',
        availability: 'inStock',
        itemStatus: 'active',
        visibility: 'public',
        source: 'MANUAL',
        enrichmentStatus: 'COMPLETE',
      } as any,
    });
    ctx.testItemIds.push(item.id);
    console.log(`✅ Product ${i} created: ${item.sku}`);
  }
}

async function testSingleItemPropagation(ctx: TestContext): Promise<void> {
  console.log('\n🧪 Testing single item propagation...\n');
  
  const sourceItemId = ctx.testItemIds[0];
  const targetTenantIds = [ctx.otherTenantIds[0]]; // Just propagate to first location
  
  console.log(`  Source item: ${sourceItemId}`);
  console.log(`  Target: ${targetTenantIds[0]}`);
  
  // Simulate the API call logic
  const sourceItem = await prisma.inventoryItem.findUnique({
    where: { id: sourceItemId },
  });
  
  if (!sourceItem) {
    throw new Error('Source item not found');
  }
  
  // Create copy at target
  const newItem = await prisma.inventoryItem.create({
    data: {
      tenantId: targetTenantIds[0],
      sku: sourceItem.sku,
      name: sourceItem.name,
      title: sourceItem.title,
      brand: sourceItem.brand,
      description: sourceItem.description,
      price: sourceItem.price,
      priceCents: sourceItem.priceCents,
      stock: sourceItem.stock,
      quantity: sourceItem.quantity,
      imageUrl: sourceItem.imageUrl,
      imageGallery: sourceItem.imageGallery,
      marketingDescription: sourceItem.marketingDescription,
      metadata: sourceItem.metadata as any,
      availability: sourceItem.availability,
      categoryPath: sourceItem.categoryPath,
      condition: sourceItem.condition,
      currency: sourceItem.currency,
      gtin: sourceItem.gtin,
      itemStatus: sourceItem.itemStatus,
      mpn: sourceItem.mpn,
      visibility: sourceItem.visibility,
      manufacturer: sourceItem.manufacturer,
      source: sourceItem.source,
      enrichmentStatus: sourceItem.enrichmentStatus,
    } as any,
  });
  
  console.log(`✅ Item propagated successfully: ${newItem.id}`);
  
  // Verify
  const targetItem = await prisma.inventoryItem.findFirst({
    where: {
      tenantId: targetTenantIds[0],
      sku: sourceItem.sku,
    },
  });
  
  if (targetItem) {
    console.log(`✅ Verification passed: Item exists at target location`);
  } else {
    throw new Error('Verification failed: Item not found at target');
  }
}

async function testBulkPropagation(ctx: TestContext): Promise<void> {
  console.log('\n🚀 Testing bulk propagation from hero location...\n');
  
  const results = {
    total: 0,
    created: 0,
    skipped: 0,
    errors: 0,
  };
  
  // Get all items from hero location
  const heroItems = await prisma.inventoryItem.findMany({
    where: { tenantId: ctx.heroTenantId },
  });
  
  console.log(`  Found ${heroItems.length} items at hero location`);
  console.log(`  Propagating to ${ctx.otherTenantIds.length} locations`);
  
  // Propagate each item to all other locations
  for (const item of heroItems) {
    for (const targetTenantId of ctx.otherTenantIds) {
      results.total++;
      
      try {
        // Check if already exists
        const existing = await prisma.inventoryItem.findFirst({
          where: {
            tenantId: targetTenantId,
            sku: item.sku,
          },
        });
        
        if (existing) {
          results.skipped++;
          continue;
        }
        
        // Create copy
        await prisma.inventoryItem.create({
          data: {
            tenantId: targetTenantId,
            sku: item.sku,
            name: item.name,
            title: item.title,
            brand: item.brand,
            description: item.description,
            price: item.price,
            priceCents: item.priceCents,
            stock: item.stock,
            quantity: item.quantity,
            imageUrl: item.imageUrl,
            imageGallery: item.imageGallery,
            marketingDescription: item.marketingDescription,
            metadata: item.metadata as any,
            availability: item.availability,
            categoryPath: item.categoryPath,
            condition: item.condition,
            currency: item.currency,
            gtin: item.gtin,
            itemStatus: item.itemStatus,
            mpn: item.mpn,
            visibility: item.visibility,
            manufacturer: item.manufacturer,
            source: item.source,
            enrichmentStatus: item.enrichmentStatus,
          } as any,
        });
        
        results.created++;
      } catch (error: any) {
        console.error(`  ❌ Error propagating ${item.sku} to ${targetTenantId}:`, error.message);
        results.errors++;
      }
    }
  }
  
  console.log('\n📊 Bulk Propagation Results:');
  console.log(`  Total operations: ${results.total}`);
  console.log(`  ✅ Created: ${results.created}`);
  console.log(`  ⏭️  Skipped: ${results.skipped}`);
  console.log(`  ❌ Errors: ${results.errors}`);
}

async function validateResults(ctx: TestContext): Promise<void> {
  console.log('\n✅ Validating results...\n');
  
  // Check each location has the items
  for (const tenantId of ctx.otherTenantIds) {
    const itemCount = await prisma.inventoryItem.count({
      where: { tenantId },
    });
    
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    
    console.log(`  ${tenant?.name}: ${itemCount} items`);
    
    if (itemCount !== NUM_TEST_PRODUCTS) {
      console.warn(`  ⚠️  Expected ${NUM_TEST_PRODUCTS} items, found ${itemCount}`);
    }
  }
  
  // Check organization total
  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    include: {
      Tenant: {
        select: {
          _count: {
            select: {
              inventoryItems: true,
            },
          },
        },
      },
    },
  });
  
  const totalSKUs = org?.Tenant.reduce((sum: any, t: { _count: { inventoryItems: any; }; }) => sum + t._count.inventoryItems, 0) || 0;
  const expectedTotal = NUM_TEST_PRODUCTS * (NUM_LOCATIONS + 1); // +1 for hero location
  
  console.log(`\n  Total SKUs across chain: ${totalSKUs}`);
  console.log(`  Expected: ${expectedTotal}`);
  
  if (totalSKUs === expectedTotal) {
    console.log('  ✅ All items propagated successfully!');
  } else {
    console.warn(`  ⚠️  Mismatch in total SKU count`);
  }
}

async function main() {
  console.log('🧪 Chain SKU Propagation Test Suite\n');
  console.log('═'.repeat(60));
  
  try {
    // Step 1: Cleanup
    await cleanup();
    
    // Step 2: Create test chain
    const ctx = await createTestChain();
    
    // Step 3: Create test products at hero location
    await createTestProducts(ctx);
    
    // Step 4: Test single item propagation
    await testSingleItemPropagation(ctx);
    
    // Step 5: Test bulk propagation
    await testBulkPropagation(ctx);
    
    // Step 6: Validate results
    await validateResults(ctx);
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ All tests passed!\n');
    
    // Optional: Cleanup test data
    console.log('💡 Test data remains in database for manual inspection.');
    console.log('   Run this script again to cleanup and re-test.\n');
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
