#!/usr/bin/env node
/**
 * Tenant Products & Categories Seeder
 * 
 * IMPORTANT: Run with Doppler for database connection
 * 
 * Usage Examples:
 *   doppler run -- node seed-tenant-products.js --tenant=tenant_123                    # Seed default products
 *   doppler run -- node seed-tenant-products.js --tenant=tenant_123 --products=500     # 500 products
 *   doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=grocery # Grocery store
 *   doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=fashion # Fashion store
 *   doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=electronics # Electronics
 *   doppler run -- node seed-tenant-products.js --tenant=tenant_123 --with-categories  # Create categories too
 *   doppler run -- node seed-tenant-products.js --tenant=tenant_123 --assign-all       # Assign all products to categories
 *   doppler run -- node seed-tenant-products.js --tenant=tenant_123 --clear            # Clear existing first
 * 
 * Complete Example:
 *   doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=grocery --products=300 --assign-all --clear
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse arguments
const args = process.argv.slice(2);
const getArg = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const hasFlag = (name) => args.includes(`--${name}`);

const config = {
  tenantId: getArg('tenant'),
  productCount: parseInt(getArg('products')) || 100,
  scenario: getArg('scenario') || 'general',
  withCategories: hasFlag('with-categories'),
  assignAll: hasFlag('assign-all'),
  clear: hasFlag('clear'),
};

// Validate tenant ID
if (!config.tenantId) {
  console.error('❌ Error: --tenant=<tenant_id> is required');
  console.log('\nUsage: doppler run -- node seed-tenant-products.js --tenant=tenant_123 [options]');
  console.log('\nExamples:');
  console.log('  doppler run -- node seed-tenant-products.js --tenant=tenant_123 --scenario=grocery --products=300 --assign-all');
  console.log('  doppler run -- node seed-tenant-products.js --tenant=tenant_123 --with-categories');
  process.exit(1);
}

// Product scenarios with categories and sample products
const scenarios = {
  grocery: {
    name: 'Grocery Store',
    categories: [
      { name: 'Dairy & Eggs', googleCategoryId: '436', slug: 'dairy-eggs' },
      { name: 'Produce', googleCategoryId: '5794', slug: 'produce' },
      { name: 'Meat & Seafood', googleCategoryId: '5795', slug: 'meat-seafood' },
      { name: 'Bakery', googleCategoryId: '5796', slug: 'bakery' },
      { name: 'Frozen Foods', googleCategoryId: '5797', slug: 'frozen' },
      { name: 'Beverages', googleCategoryId: '5798', slug: 'beverages' },
      { name: 'Snacks', googleCategoryId: '5799', slug: 'snacks' },
      { name: 'Pantry Staples', googleCategoryId: '5800', slug: 'pantry' },
    ],
    products: [
      { name: 'Whole Milk', brand: 'Dairy Fresh', category: 'Dairy & Eggs', price: 399 },
      { name: 'Large Eggs', brand: 'Farm Fresh', category: 'Dairy & Eggs', price: 449 },
      { name: 'Cheddar Cheese', brand: 'Dairy Fresh', category: 'Dairy & Eggs', price: 599 },
      { name: 'Bananas', brand: 'Fresh Produce', category: 'Produce', price: 129 },
      { name: 'Organic Apples', brand: 'Fresh Produce', category: 'Produce', price: 349 },
      { name: 'Ground Beef', brand: 'Premium Meats', category: 'Meat & Seafood', price: 899 },
      { name: 'Fresh Salmon', brand: 'Ocean Catch', category: 'Meat & Seafood', price: 1299 },
      { name: 'Sourdough Bread', brand: 'Artisan Bakery', category: 'Bakery', price: 499 },
      { name: 'Frozen Pizza', brand: 'Quick Meal', category: 'Frozen Foods', price: 699 },
      { name: 'Orange Juice', brand: 'Fresh Squeeze', category: 'Beverages', price: 449 },
    ],
  },
  fashion: {
    name: 'Fashion Store',
    categories: [
      { name: "Men's Clothing", googleCategoryId: '1604', slug: 'mens-clothing' },
      { name: "Women's Clothing", googleCategoryId: '1604', slug: 'womens-clothing' },
      { name: 'Shoes', googleCategoryId: '1581', slug: 'shoes' },
      { name: 'Accessories', googleCategoryId: '167', slug: 'accessories' },
      { name: 'Activewear', googleCategoryId: '212', slug: 'activewear' },
      { name: 'Outerwear', googleCategoryId: '213', slug: 'outerwear' },
    ],
    products: [
      { name: 'Classic T-Shirt', brand: 'Urban Style', category: "Men's Clothing", price: 2499 },
      { name: 'Slim Fit Jeans', brand: 'Denim Co', category: "Men's Clothing", price: 5999 },
      { name: 'Summer Dress', brand: 'Elegant', category: "Women's Clothing", price: 7999 },
      { name: 'Yoga Pants', brand: 'Active Fit', category: 'Activewear', price: 4999 },
      { name: 'Running Shoes', brand: 'SportMax', category: 'Shoes', price: 8999 },
      { name: 'Leather Boots', brand: 'Classic Footwear', category: 'Shoes', price: 12999 },
      { name: 'Winter Jacket', brand: 'Warm Wear', category: 'Outerwear', price: 15999 },
      { name: 'Leather Belt', brand: 'Accessories Plus', category: 'Accessories', price: 3499 },
    ],
  },
  electronics: {
    name: 'Electronics Store',
    categories: [
      { name: 'Computers', googleCategoryId: '222', slug: 'computers' },
      { name: 'Smartphones', googleCategoryId: '267', slug: 'smartphones' },
      { name: 'Audio', googleCategoryId: '249', slug: 'audio' },
      { name: 'Gaming', googleCategoryId: '1279', slug: 'gaming' },
      { name: 'Cameras', googleCategoryId: '147', slug: 'cameras' },
      { name: 'Accessories', googleCategoryId: '249', slug: 'accessories' },
    ],
    products: [
      { name: 'Laptop Pro 15"', brand: 'TechBrand', category: 'Computers', price: 129999 },
      { name: 'Wireless Mouse', brand: 'TechBrand', category: 'Accessories', price: 2999 },
      { name: 'Smartphone X', brand: 'PhoneCo', category: 'Smartphones', price: 79999 },
      { name: 'Wireless Earbuds', brand: 'AudioMax', category: 'Audio', price: 14999 },
      { name: 'Gaming Console', brand: 'GameStation', category: 'Gaming', price: 49999 },
      { name: 'DSLR Camera', brand: 'PhotoPro', category: 'Cameras', price: 89999 },
      { name: 'USB-C Cable', brand: 'TechBrand', category: 'Accessories', price: 1999 },
    ],
  },
  general: {
    name: 'General Store',
    categories: [
      { name: 'Electronics', googleCategoryId: '632', slug: 'electronics' },
      { name: 'Home & Garden', googleCategoryId: '536', slug: 'home-garden' },
      { name: 'Toys & Games', googleCategoryId: '1279', slug: 'toys-games' },
      { name: 'Sports', googleCategoryId: '888', slug: 'sports' },
      { name: 'Books', googleCategoryId: '784', slug: 'books' },
    ],
    products: [
      { name: 'Bluetooth Speaker', brand: 'SoundMax', category: 'Electronics', price: 4999 },
      { name: 'Coffee Maker', brand: 'BrewMaster', category: 'Home & Garden', price: 7999 },
      { name: 'Board Game', brand: 'Fun Games', category: 'Toys & Games', price: 2999 },
      { name: 'Yoga Mat', brand: 'FitGear', category: 'Sports', price: 3499 },
      { name: 'Bestseller Novel', brand: 'Publisher Co', category: 'Books', price: 1999 },
    ],
  },
};

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Generate realistic product variations
function generateProductVariations(baseProducts, count) {
  const products = [];
  const sizes = ['Small', 'Medium', 'Large', 'XL'];
  const colors = ['Red', 'Blue', 'Green', 'Black', 'White', 'Gray'];
  const adjectives = ['Premium', 'Deluxe', 'Classic', 'Modern', 'Vintage', 'Eco'];
  
  while (products.length < count) {
    const base = getRandom(baseProducts);
    const variation = {
      ...base,
      name: `${getRandom(adjectives)} ${base.name}`,
      price: base.price + getRandomInt(-500, 1000),
      sku: `SKU-${Date.now()}-${products.length.toString().padStart(5, '0')}`,
    };
    
    // Add size/color variations for some products
    if (Math.random() > 0.5) {
      variation.name += ` - ${getRandom(colors)}`;
    }
    if (Math.random() > 0.7) {
      variation.name += ` (${getRandom(sizes)})`;
    }
    
    products.push(variation);
  }
  
  return products;
}

async function main() {
  console.log('🌱 Tenant Products & Categories Seeder\n');
  
  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({
    where: { id: config.tenantId },
  });
  
  if (!tenant) {
    console.error(`❌ Tenant not found: ${config.tenantId}`);
    process.exit(1);
  }
  
  console.log(`📍 Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`📦 Scenario: ${scenarios[config.scenario].name}`);
  console.log(`🔢 Products: ${config.productCount}\n`);
  
  const scenario = scenarios[config.scenario];
  const timestamp = Date.now();
  
  // Clear existing data if requested
  if (config.clear) {
    console.log('🗑️  Clearing existing data...');
    await prisma.inventoryItem.deleteMany({ where: { tenantId: config.tenantId } });
    await prisma.category.deleteMany({ where: { tenantId: config.tenantId } });
    console.log('   ✅ Cleared\n');
  }
  
  // Create categories
  let categories = [];
  if (config.withCategories || config.assignAll) {
    console.log('📁 Creating categories...');
    
    for (const cat of scenario.categories) {
      const category = await prisma.category.create({
        data: {
          tenantId: config.tenantId,
          name: cat.name,
          slug: cat.slug,
          googleCategoryId: cat.googleCategoryId,
          isActive: true,
          sortOrder: categories.length,
        },
      });
      
      categories.push({ ...category, originalName: cat.name });
      console.log(`   ✅ ${cat.name}`);
    }
    console.log('');
  }
  
  // Generate products
  console.log('📦 Creating products...');
  const baseProducts = scenario.products;
  const allProducts = generateProductVariations(baseProducts, config.productCount);
  
  let createdCount = 0;
  const batchSize = 100;
  
  for (let i = 0; i < allProducts.length; i += batchSize) {
    const batch = allProducts.slice(i, i + batchSize);
    const items = batch.map((product, idx) => {
      const availability = getRandom(['in_stock', 'in_stock', 'in_stock', 'out_of_stock']);
      const stock = availability === 'in_stock' ? getRandomInt(5, 100) : 0;
      
      // Find matching category if we created them
      let categoryId = null;
      if (config.assignAll && categories.length > 0) {
        const matchingCat = categories.find(c => c.originalName === product.category);
        categoryId = matchingCat ? matchingCat.id : getRandom(categories).id;
      }
      
      return {
        tenantId: config.tenantId,
        sku: `SKU-${timestamp}-${(i + idx).toString().padStart(5, '0')}`,
        name: product.name,
        title: product.name,
        brand: product.brand || 'Generic',
        priceCents: product.price,
        price: product.price / 100,
        currency: 'USD',
        stock: stock,
        availability: availability,
        itemStatus: getRandom(['active', 'active', 'active', 'inactive']),
        categoryId: categoryId,
      };
    });
    
    await prisma.inventoryItem.createMany({ data: items });
    createdCount += items.length;
    
    if (createdCount % 100 === 0 || createdCount === allProducts.length) {
      process.stdout.write(`\r   ✅ Created ${createdCount}/${allProducts.length} products`);
    }
  }
  
  console.log('\n');
  
  // Calculate stats
  const totalProducts = await prisma.inventoryItem.count({
    where: { tenantId: config.tenantId },
  });
  
  const activeProducts = await prisma.inventoryItem.count({
    where: { tenantId: config.tenantId, itemStatus: 'active' },
  });
  
  const inStockProducts = await prisma.inventoryItem.count({
    where: { tenantId: config.tenantId, availability: 'in_stock' },
  });
  
  const categorizedProducts = await prisma.inventoryItem.count({
    where: { tenantId: config.tenantId, categoryId: { not: null } },
  });
  
  // Summary
  console.log('📊 Summary:');
  console.log('━'.repeat(60));
  console.log(`Tenant: ${tenant.name}`);
  console.log(`Scenario: ${scenario.name}`);
  console.log(`Total Products: ${totalProducts}`);
  console.log(`Active: ${activeProducts} (${((activeProducts / totalProducts) * 100).toFixed(1)}%)`);
  console.log(`In Stock: ${inStockProducts} (${((inStockProducts / totalProducts) * 100).toFixed(1)}%)`);
  
  if (categories.length > 0) {
    console.log(`Categories: ${categories.length}`);
    console.log(`Categorized: ${categorizedProducts} (${((categorizedProducts / totalProducts) * 100).toFixed(1)}%)`);
  }
  
  console.log('━'.repeat(60));
  console.log('\n🎉 Seeding completed successfully!\n');
  console.log('📍 View at:');
  console.log(`   http://localhost:3000/t/${config.tenantId}/items`);
  if (categories.length > 0) {
    console.log(`   http://localhost:3000/t/${config.tenantId}/categories`);
  }
  console.log('');
  
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
