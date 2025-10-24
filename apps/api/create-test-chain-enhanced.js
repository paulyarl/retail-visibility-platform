#!/usr/bin/env node
/**
 * Enhanced Test Chain Creator
 * 
 * Usage Examples:
 *   node create-test-chain-enhanced.js                           # Default chain
 *   node create-test-chain-enhanced.js --name="My Chain"         # Custom name
 *   node create-test-chain-enhanced.js --locations=5             # 5 locations
 *   node create-test-chain-enhanced.js --skus=1000               # 1000 SKUs per location
 *   node create-test-chain-enhanced.js --size=small              # Small chain (2 locations, 500 SKUs)
 *   node create-test-chain-enhanced.js --size=medium             # Medium chain (3 locations, 1500 SKUs)
 *   node create-test-chain-enhanced.js --size=large              # Large chain (5 locations, 3000 SKUs)
 *   node create-test-chain-enhanced.js --count=5                 # Create 5 chains
 *   node create-test-chain-enhanced.js --random                  # Random data
 *   node create-test-chain-enhanced.js --scenario=restaurant     # Restaurant chain
 *   node create-test-chain-enhanced.js --scenario=retail         # Retail chain
 *   node create-test-chain-enhanced.js --scenario=franchise      # Franchise chain
 *   node create-test-chain-enhanced.js --count=3 --random        # 3 random chains
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse arguments
const args = process.argv.slice(2);
const getArg = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const hasFlag = (name) => args.includes(`--${name}`);

const config = {
  customName: getArg('name'),
  customLocations: parseInt(getArg('locations')) || null,
  customSkus: parseInt(getArg('skus')) || null,
  size: getArg('size'),
  count: parseInt(getArg('count')) || 1,
  random: hasFlag('random'),
  scenario: getArg('scenario'),
};

// Presets
const sizePresets = {
  small: { locations: 2, skus: 500, maxLocations: 3, maxTotalSKUs: 1500 },
  medium: { locations: 3, skus: 1500, maxLocations: 5, maxTotalSKUs: 2500 },
  large: { locations: 5, skus: 3000, maxLocations: 10, maxTotalSKUs: 5000 },
};

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

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function createChain(index) {
  const timestamp = Date.now() + index;
  
  // Determine configuration
  let chainName, locationCount, skuCount, maxLocs, maxSkus, locationTypes, skuRange;
  
  if (config.scenario && scenarios[config.scenario]) {
    const s = scenarios[config.scenario];
    chainName = config.customName || getRandom(s.names);
    locationTypes = s.locationTypes;
    skuRange = s.skuRange;
    locationCount = config.customLocations || 3;
    skuCount = config.customSkus || getRandomInt(...skuRange);
    maxLocs = locationCount + 2;
    maxSkus = skuCount * locationCount * 1.5;
  } else if (config.size && sizePresets[config.size]) {
    const preset = sizePresets[config.size];
    chainName = config.customName || (config.random ? getRandom(randomChainNames) : 'Demo Retail Chain');
    locationCount = preset.locations;
    skuCount = preset.skus;
    maxLocs = preset.maxLocations || preset.locations + 2;
    maxSkus = preset.maxTotalSKUs;
    locationTypes = ['Main Store', 'Downtown Branch', 'Uptown Store', 'Mall Location', 'Express'];
  } else {
    chainName = config.customName || (config.random ? getRandom(randomChainNames) : 'Demo Retail Chain');
    locationCount = config.customLocations || 3;
    skuCount = config.customSkus || 600;
    maxLocs = locationCount + 2;
    maxSkus = skuCount * locationCount * 1.2;
    locationTypes = ['Main Store', 'Downtown Branch', 'Uptown Store', 'Mall Location', 'Express'];
  }

  console.log(`\n🏗️  Creating: ${chainName} ${index > 0 ? `(#${index + 1})` : ''}`);
  console.log(`   📍 Locations: ${locationCount}`);
  console.log(`   📦 SKUs per location: ~${skuCount}\n`);

  // Create organization
  console.log('1️⃣  Creating organization...');
  const org = await prisma.organization.create({
    data: {
      id: `org_${timestamp}`,
      name: chainName,
      ownerId: 'demo-user',
      subscriptionTier: 'chain_professional',
      subscriptionStatus: 'active',
      maxLocations: maxLocs,
      maxTotalSKUs: Math.floor(maxSkus),
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`   ✅ ${org.name}`);

  // Create locations
  console.log('\n2️⃣  Creating locations...');
  const locations = [];
  
  for (let i = 0; i < locationCount; i++) {
    const city = getRandom(randomCities);
    const locationType = locationTypes[i % locationTypes.length];
    const locationName = `${chainName} - ${locationType}`;
    const locationSkus = config.random ? getRandomInt(skuCount * 0.7, skuCount * 1.3) : Math.floor(skuCount * (1 - i * 0.2));
    
    const tenant = await prisma.tenant.create({
      data: {
        id: `tenant_${timestamp}_${i}`,
        name: locationName,
        organizationId: org.id,
        metadata: {
          city: city.city,
          state: city.state,
          address_line1: `${getRandomInt(100, 9999)} ${getRandom(['Main', 'Oak', 'Maple', 'Park', 'Broadway'])} St`,
          postal_code: city.zip,
        },
      },
    });

    // Add SKUs
    const items = [];
    for (let j = 0; j < locationSkus; j++) {
      items.push({
        tenantId: tenant.id,
        sku: `SKU-${timestamp}-${i}-${j.toString().padStart(4, '0')}`,
        name: `Product ${j + 1}`,
        priceCents: getRandomInt(500, 50000),
        stock: getRandomInt(0, 100),
        title: `Product ${j + 1}`,
        brand: getRandom(['Generic', 'Premium', 'Value', 'Elite']),
        price: getRandomInt(5, 500),
        currency: 'USD',
      });
    }

    await prisma.inventoryItem.createMany({ data: items });
    console.log(`   ✅ ${locationName}: ${locationSkus} SKUs`);
    
    locations.push({ name: locationName, skus: locationSkus });
  }

  // Summary
  const totalSkus = locations.reduce((sum, loc) => sum + loc.skus, 0);
  const utilization = ((totalSkus / maxSkus) * 100).toFixed(1);
  
  console.log('\n📊 Summary:');
  console.log('━'.repeat(60));
  console.log(`Organization: ${org.name}`);
  console.log(`ID: ${org.id}`);
  console.log(`Locations: ${locationCount} / ${maxLocs}`);
  console.log(`Total SKUs: ${totalSkus} / ${Math.floor(maxSkus)} (${utilization}%)`);
  console.log('━'.repeat(60));
  
  return org.id;
}

async function main() {
  console.log('🚀 Enhanced Test Chain Creator\n');
  
  if (config.count > 1) {
    console.log(`Creating ${config.count} chains...\n`);
  }

  const orgIds = [];
  
  for (let i = 0; i < config.count; i++) {
    const orgId = await createChain(i);
    orgIds.push(orgId);
  }

  console.log('\n🎉 All chains created successfully!\n');
  
  if (orgIds.length > 0) {
    console.log('📍 View at:');
    console.log(`   http://localhost:3000/admin/organizations\n`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
