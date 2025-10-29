#!/usr/bin/env node
/**
 * Enhanced Test Tenant Creator
 * 
 * Usage Examples:
 *   node create-test-tenants.js                              # Default tenant
 *   node create-test-tenants.js --name="My Store"            # Custom name
 *   node create-test-tenants.js --skus=500                   # 500 SKUs
 *   node create-test-tenants.js --size=small                 # Small store (100 SKUs)
 *   node create-test-tenants.js --size=medium                # Medium store (500 SKUs)
 *   node create-test-tenants.js --size=large                 # Large store (1000 SKUs)
 *   node create-test-tenants.js --count=10                   # Create 10 tenants
 *   node create-test-tenants.js --random                     # Random data
 *   node create-test-tenants.js --type=restaurant            # Restaurant
 *   node create-test-tenants.js --type=retail                # Retail store
 *   node create-test-tenants.js --type=grocery               # Grocery store
 *   node create-test-tenants.js --type=electronics           # Electronics store
 *   node create-test-tenants.js --count=5 --random           # 5 random tenants
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse arguments
const args = process.argv.slice(2);
const getArg = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const hasFlag = (name) => args.includes(`--${name}`);

const config = {
  customName: getArg('name'),
  customSkus: parseInt(getArg('skus')) || null,
  size: getArg('size'),
  count: parseInt(getArg('count')) || 1,
  random: hasFlag('random'),
  type: getArg('type'),
};

// Size presets
const sizePresets = {
  small: { skus: 100, tier: 'starter' },
  medium: { skus: 500, tier: 'professional' },
  large: { skus: 1000, tier: 'professional' },
};

// Business types
const businessTypes = {
  restaurant: {
    names: ['Burger Palace', 'Pizza Haven', 'Taco Express', 'Sushi Bar', 'Steakhouse', 'Cafe Delight', 'Noodle House'],
    skuRange: [30, 100],
    categories: ['Appetizers', 'Entrees', 'Desserts', 'Beverages', 'Sides'],
  },
  retail: {
    names: ['Fashion Boutique', 'Style Shop', 'Trendy Threads', 'Urban Wear', 'Classic Clothing', 'Modern Apparel'],
    skuRange: [200, 800],
    categories: ['Tops', 'Bottoms', 'Dresses', 'Accessories', 'Shoes'],
  },
  grocery: {
    names: ['Fresh Market', 'Corner Store', 'Daily Groceries', 'Food Mart', 'Quick Shop', 'Local Market'],
    skuRange: [500, 1500],
    categories: ['Produce', 'Dairy', 'Meat', 'Bakery', 'Beverages'],
  },
  electronics: {
    names: ['Tech Hub', 'Gadget Store', 'Electronics Plus', 'Digital World', 'Tech Central', 'Device Shop'],
    skuRange: [150, 600],
    categories: ['Phones', 'Laptops', 'Accessories', 'Audio', 'Gaming'],
  },
  pharmacy: {
    names: ['Health Pharmacy', 'Care Plus', 'Wellness Store', 'Medical Mart', 'Quick Pharmacy', 'Life Care'],
    skuRange: [300, 1000],
    categories: ['Medications', 'Vitamins', 'Personal Care', 'First Aid', 'Beauty'],
  },
  bookstore: {
    names: ['Book Haven', 'Page Turner', 'Literary Corner', 'Read More', 'Book World', 'Story Shop'],
    skuRange: [400, 1200],
    categories: ['Fiction', 'Non-Fiction', 'Children', 'Educational', 'Magazines'],
  },
};

const randomStoreNames = [
  'Main Street Store', 'Downtown Shop', 'City Market', 'Local Business', 'Corner Store',
  'Plaza Shop', 'Avenue Store', 'Central Market', 'Neighborhood Shop', 'Express Store'
];

const cities = [
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
  { city: 'Seattle', state: 'WA', zip: '98101' },
  { city: 'Denver', state: 'CO', zip: '80201' },
  { city: 'Boston', state: 'MA', zip: '02101' },
  { city: 'Miami', state: 'FL', zip: '33101' },
  { city: 'Atlanta', state: 'GA', zip: '30301' },
];

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function createTenant(index) {
  const timestamp = Date.now() + index;
  
  // Determine configuration
  let tenantName, skuCount, tier, businessType, categories;
  
  if (config.type && businessTypes[config.type]) {
    const bt = businessTypes[config.type];
    tenantName = config.customName || getRandom(bt.names);
    skuCount = config.customSkus || getRandomInt(...bt.skuRange);
    categories = bt.categories;
    tier = skuCount < 200 ? 'starter' : 'professional';
    businessType = config.type;
  } else if (config.size && sizePresets[config.size]) {
    const preset = sizePresets[config.size];
    tenantName = config.customName || (config.random ? getRandom(randomStoreNames) : 'Demo Store');
    skuCount = preset.skus;
    tier = preset.tier;
    categories = ['Category A', 'Category B', 'Category C', 'Category D', 'Category E'];
  } else {
    tenantName = config.customName || (config.random ? getRandom(randomStoreNames) : 'Demo Store');
    skuCount = config.customSkus || 250;
    tier = skuCount < 200 ? 'starter' : 'professional';
    categories = ['Category A', 'Category B', 'Category C', 'Category D', 'Category E'];
  }

  const city = getRandom(cities);
  
  console.log(`\n🏪 Creating: ${tenantName} ${index > 0 ? `(#${index + 1})` : ''}`);
  console.log(`   📍 Location: ${city.city}, ${city.state}`);
  console.log(`   📦 SKUs: ${skuCount}`);
  console.log(`   🎫 Tier: ${tier}\n`);

  // Create tenant
  console.log('1️⃣  Creating tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      id: `tenant_${timestamp}`,
      name: tenantName,
      subscriptionTier: tier,
      metadata: {
        city: city.city,
        state: city.state,
        address_line1: `${getRandomInt(100, 9999)} ${getRandom(['Main', 'Oak', 'Maple', 'Park', 'Broadway', 'First', 'Second'])} St`,
        postal_code: city.zip,
        business_type: businessType || 'retail',
        phone: `${getRandomInt(200, 999)}-${getRandomInt(200, 999)}-${getRandomInt(1000, 9999)}`,
      },
    },
  });
  console.log(`   ✅ ${tenant.name}`);

  // Create SKUs
  console.log('\n2️⃣  Adding inventory...');
  const items = [];
  
  for (let i = 0; i < skuCount; i++) {
    const category = getRandom(categories);
    const price = getRandomInt(500, 50000);
    
    items.push({
      tenantId: tenant.id,
      sku: `SKU-${timestamp}-${i.toString().padStart(5, '0')}`,
      name: `${category} Product ${i + 1}`,
      title: `${category} Product ${i + 1}`,
      brand: getRandom(['Generic', 'Premium', 'Value', 'Elite', 'Standard']),
      priceCents: price,
      price: price / 100,
      currency: 'USD',
      stock: getRandomInt(0, 100),
      availability: getRandom(['in_stock', 'in_stock', 'in_stock', 'out_of_stock']), // 75% in stock
      itemStatus: getRandom(['active', 'active', 'active', 'inactive']), // 75% active
    });
  }

  await prisma.inventoryItem.createMany({ data: items });
  console.log(`   ✅ ${skuCount} SKUs added`);

  // Summary
  console.log('\n📊 Summary:');
  console.log('━'.repeat(60));
  console.log(`Tenant: ${tenant.name}`);
  console.log(`ID: ${tenant.id}`);
  console.log(`Location: ${city.city}, ${city.state}`);
  console.log(`SKUs: ${skuCount}`);
  console.log(`Tier: ${tier}`);
  console.log('━'.repeat(60));
  
  return tenant.id;
}

async function main() {
  console.log('🚀 Enhanced Test Tenant Creator\n');
  
  if (config.count > 1) {
    console.log(`Creating ${config.count} tenants...\n`);
  }

  const tenantIds = [];
  
  for (let i = 0; i < config.count; i++) {
    const tenantId = await createTenant(i);
    tenantIds.push(tenantId);
  }

  console.log('\n🎉 All tenants created successfully!\n');
  
  if (tenantIds.length > 0) {
    console.log('📍 View at:');
    console.log(`   http://localhost:3000/tenants`);
    console.log(`   http://localhost:3000/settings/admin/tenants\n`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
