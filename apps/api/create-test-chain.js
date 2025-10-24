#!/usr/bin/env node
/**
 * Create Test Chain Organization
 * 
 * Usage:
 *   node create-test-chain.js                                    # Default chain
 *   node create-test-chain.js --name="My Chain"                  # Custom name
 *   node create-test-chain.js --locations=5                      # Custom location count
 *   node create-test-chain.js --skus=1000                        # Custom SKU count per location
 *   node create-test-chain.js --size=small                       # Preset: 2 locations, 500 SKUs
 *   node create-test-chain.js --size=medium                      # Preset: 3 locations, 1500 SKUs
 *   node create-test-chain.js --size=large                       # Preset: 5 locations, 3000 SKUs
 *   node create-test-chain.js --count=5                          # Create 5 different chains
 *   node create-test-chain.js --random                           # Random names and data
 *   node create-test-chain.js --scenario=restaurant              # Restaurant chain
 *   node create-test-chain.js --scenario=retail                  # Retail chain
 *   node create-test-chain.js --scenario=franchise               # Franchise chain
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

// Configuration
const customName = getArg('name');
const customLocations = parseInt(getArg('locations')) || null;
const customSkus = parseInt(getArg('skus')) || null;
const size = getArg('size');
const count = parseInt(getArg('count')) || 1;
const random = hasFlag('random');
const scenario = getArg('scenario');

// Size presets
const sizePresets = {
  small: { locations: 2, skus: 500, maxLocations: 3, maxTotalSKUs: 1500 },
  medium: { locations: 3, skus: 1500, maxTotalSKUs: 2500 },
  large: { locations: 5, skus: 3000, maxLocations: 10, maxTotalSKUs: 5000 },
};

// Scenario presets
const scenarios = {
  restaurant: {
    names: ['Burger Palace', 'Pizza Haven', 'Taco Express', 'Sushi Bar', 'Steakhouse'],
    locationTypes: ['Downtown', 'Uptown', 'Mall', 'Airport', 'Waterfront'],
    skuRange: [50, 150],
  },
  retail: {
    names: ['Fashion Outlet', 'Electronics Plus', 'Home Goods', 'Sports Store', 'Book Shop'],
    locationTypes: ['Main Store', 'Outlet', 'Express', 'Superstore', 'Pop-up'],
    skuRange: [500, 2000],
  },
  franchise: {
    names: ['Quick Mart', 'Coffee Corner', 'Fitness Club', 'Auto Service', 'Pet Store'],
    locationTypes: ['Location A', 'Location B', 'Location C', 'Location D', 'Location E'],
    skuRange: [100, 500],
  },
};

// Random name generators
const randomChainNames = [
  'Metro Retail', 'Urban Stores', 'City Market', 'Prime Shops', 'Elite Outlets',
  'Global Chain', 'National Stores', 'Regional Markets', 'Local Favorites', 'Express Shops'
];

const randomCities = [
  { city: 'New York', state: 'NY', zip: '10001' },
  { city: 'Los Angeles', state: 'CA', zip: '90001' },
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Houston', state: 'TX', zip: '77001' },
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Philadelphia', state: 'PA', zip: '19019' },
  { city: 'San Antonio', state: 'TX', zip: '78201' },
  { city: 'San Diego', state: 'CA', zip: '92101' },
  { city: 'Dallas', state: 'TX', zip: '75201' },
  { city: 'Austin', state: 'TX', zip: '78701' },
];

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function createTestChain(chainIndex = 0) {
  const timestamp = Date.now();
  const uniqueId = chainIndex > 0 ? `_${chainIndex}` : '';
  
  console.log(`\n🏗️  Creating test chain organization ${chainIndex > 0 ? `#${chainIndex + 1}` : ''}...\n`);

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
