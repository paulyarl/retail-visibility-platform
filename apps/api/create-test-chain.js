#!/usr/bin/env node
/**
 * Create Test Chain Organization
 * Run: node create-test-chain.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestChain() {
  console.log('🏗️  Creating test chain organization...\n');

  try {
    // 1. Create organization
    console.log('1️⃣  Creating organization...');
    const org = await prisma.organization.upsert({
      where: { id: 'org_test_chain_001' },
      update: {
        name: 'Demo Retail Chain',
        maxLocations: 5,
        maxTotalSKUs: 2500,
        updatedAt: new Date(),
      },
      create: {
        id: 'org_test_chain_001',
        name: 'Demo Retail Chain',
        ownerId: 'demo-user',
        subscriptionTier: 'chain_professional',
        subscriptionStatus: 'active',
        maxLocations: 5,
        maxTotalSKUs: 2500,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`   ✅ Organization created: ${org.name}`);

    // 2. Create locations
    console.log('\n2️⃣  Creating locations...');
    
    const locations = [
      {
        id: 'chain_location_main',
        name: 'Demo Chain - Main Store',
        metadata: { city: 'New York', state: 'NY', address_line1: '123 Main St', postal_code: '10001' },
        skuCount: 850,
      },
      {
        id: 'chain_location_downtown',
        name: 'Demo Chain - Downtown Branch',
        metadata: { city: 'New York', state: 'NY', address_line1: '456 Broadway', postal_code: '10012' },
        skuCount: 600,
      },
      {
        id: 'chain_location_uptown',
        name: 'Demo Chain - Uptown Store',
        metadata: { city: 'New York', state: 'NY', address_line1: '789 Park Ave', postal_code: '10021' },
        skuCount: 400,
      },
    ];

    for (const loc of locations) {
      const tenant = await prisma.tenant.upsert({
        where: { id: loc.id },
        update: {
          organization: {
            connect: { id: org.id }
          },
        },
        create: {
          id: loc.id,
          name: loc.name,
          subscriptionTier: 'professional',
          subscriptionStatus: 'active',
          organization: {
            connect: { id: org.id }
          },
          metadata: loc.metadata,
        },
      });
      console.log(`   ✅ Location created: ${tenant.name}`);

      // Create items for this location
      console.log(`      Adding ${loc.skuCount} SKUs...`);
      const items = [];
      for (let i = 1; i <= loc.skuCount; i++) {
        const priceInDollars = Math.floor(Math.random() * 100 + 10);
        items.push({
          id: `item_${loc.id}_${i}`,
          tenantId: loc.id,
          sku: `${loc.id.split('_')[2].toUpperCase()}-SKU-${String(i).padStart(4, '0')}`,
          name: `Product ${i}`,
          title: `${loc.name} Product ${i}`,
          brand: 'Demo Brand',
          price: priceInDollars, // Decimal price
          priceCents: priceInDollars * 100, // Integer cents
          currency: 'USD',
          availability: 'in_stock',
          itemStatus: 'active',
          visibility: 'public',
        });
      }

      // Insert in batches of 100
      for (let i = 0; i < items.length; i += 100) {
        const batch = items.slice(i, i + 100);
        await prisma.inventoryItem.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
      console.log(`      ✅ ${loc.skuCount} SKUs added`);
    }

    // 3. Show summary
    console.log('\n📊 Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Organization: ${org.name}`);
    console.log(`Organization ID: ${org.id}`);
    console.log(`Max Locations: ${org.maxLocations}`);
    console.log(`Max Total SKUs: ${org.maxTotalSKUs}`);
    console.log(`\nLocations:`);
    
    let totalSKUs = 0;
    for (const loc of locations) {
      const count = await prisma.inventoryItem.count({
        where: { tenantId: loc.id },
      });
      totalSKUs += count;
      const percentage = ((count / org.maxTotalSKUs) * 100).toFixed(1);
      console.log(`  • ${loc.name}: ${count} SKUs (${percentage}%)`);
    }
    
    console.log(`\nTotal SKUs: ${totalSKUs} / ${org.maxTotalSKUs} (${((totalSKUs / org.maxTotalSKUs) * 100).toFixed(1)}%)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n🎉 Test chain created successfully!');
    console.log('\n📍 Access the dashboard at:');
    console.log(`   https://retail-visibility-platform-web.vercel.app/settings/organization?organizationId=${org.id}`);
    console.log('\n💡 Or from settings:');
    console.log('   https://retail-visibility-platform-web.vercel.app/settings');
    console.log('   → Click "Organization Dashboard"');

  } catch (error) {
    console.error('❌ Error creating test chain:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestChain();
