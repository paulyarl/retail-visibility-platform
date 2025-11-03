/**
 * Quick Start Product Generator
 * 
 * Provides reusable functions for generating starter products for new tenants.
 * Used by both CLI seeding script and Quick Start API endpoint.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Product scenarios with realistic data
const SCENARIOS = {
  grocery: {
    name: 'Grocery Store',
    categories: [
      { name: 'Dairy & Eggs', slug: 'dairy-eggs', googleCategoryId: '422' },
      { name: 'Produce', slug: 'produce', googleCategoryId: '2660' },
      { name: 'Meat & Seafood', slug: 'meat-seafood', googleCategoryId: '2660' },
      { name: 'Bakery', slug: 'bakery', googleCategoryId: '422' },
      { name: 'Frozen Foods', slug: 'frozen-foods', googleCategoryId: '422' },
      { name: 'Beverages', slug: 'beverages', googleCategoryId: '413' },
      { name: 'Snacks', slug: 'snacks', googleCategoryId: '422' },
      { name: 'Pantry Staples', slug: 'pantry-staples', googleCategoryId: '422' },
    ],
    products: [
      { name: 'Organic Whole Milk', price: 549, category: 'Dairy & Eggs', brand: 'Organic Valley' },
      { name: 'Large Eggs (Dozen)', price: 449, category: 'Dairy & Eggs', brand: 'Happy Farms' },
      { name: 'Greek Yogurt', price: 599, category: 'Dairy & Eggs', brand: 'Chobani' },
      { name: 'Cheddar Cheese Block', price: 699, category: 'Dairy & Eggs', brand: 'Tillamook' },
      { name: 'Butter (1 lb)', price: 549, category: 'Dairy & Eggs', brand: 'Land O Lakes' },
      { name: 'Fresh Bananas (lb)', price: 79, category: 'Produce', brand: 'Fresh' },
      { name: 'Organic Apples (lb)', price: 299, category: 'Produce', brand: 'Organic' },
      { name: 'Baby Carrots (1 lb)', price: 149, category: 'Produce', brand: 'Grimmway' },
      { name: 'Romaine Lettuce', price: 249, category: 'Produce', brand: 'Fresh' },
      { name: 'Cherry Tomatoes', price: 349, category: 'Produce', brand: 'NatureSweet' },
      { name: 'Ground Beef (1 lb)', price: 699, category: 'Meat & Seafood', brand: 'Butcher' },
      { name: 'Chicken Breast (1 lb)', price: 599, category: 'Meat & Seafood', brand: 'Fresh' },
      { name: 'Atlantic Salmon (lb)', price: 1299, category: 'Meat & Seafood', brand: 'Fresh' },
      { name: 'Fresh Bread Loaf', price: 349, category: 'Bakery', brand: 'Bakery Fresh' },
      { name: 'Croissants (4 pack)', price: 499, category: 'Bakery', brand: 'Bakery Fresh' },
      { name: 'Bagels (6 pack)', price: 449, category: 'Bakery', brand: 'Thomas' },
      { name: 'Frozen Pizza', price: 699, category: 'Frozen Foods', brand: 'DiGiorno' },
      { name: 'Ice Cream (1.5 qt)', price: 549, category: 'Frozen Foods', brand: 'Ben & Jerry\'s' },
      { name: 'Frozen Vegetables', price: 249, category: 'Frozen Foods', brand: 'Birds Eye' },
      { name: 'Orange Juice (64 oz)', price: 449, category: 'Beverages', brand: 'Tropicana' },
      { name: 'Coffee (12 oz)', price: 899, category: 'Beverages', brand: 'Starbucks' },
      { name: 'Sparkling Water (12 pk)', price: 599, category: 'Beverages', brand: 'LaCroix' },
      { name: 'Potato Chips', price: 399, category: 'Snacks', brand: 'Lay\'s' },
      { name: 'Granola Bars (6 pk)', price: 449, category: 'Snacks', brand: 'Nature Valley' },
      { name: 'Pasta (1 lb)', price: 199, category: 'Pantry Staples', brand: 'Barilla' },
      { name: 'Pasta Sauce (24 oz)', price: 349, category: 'Pantry Staples', brand: 'Prego' },
      { name: 'Rice (2 lb)', price: 399, category: 'Pantry Staples', brand: 'Uncle Ben\'s' },
      { name: 'Olive Oil (16 oz)', price: 899, category: 'Pantry Staples', brand: 'Bertolli' },
      { name: 'Cereal (12 oz)', price: 499, category: 'Pantry Staples', brand: 'General Mills' },
      { name: 'Peanut Butter (16 oz)', price: 449, category: 'Pantry Staples', brand: 'Jif' },
    ],
  },
  fashion: {
    name: 'Fashion Boutique',
    categories: [
      { name: 'Women\'s Tops', slug: 'womens-tops', googleCategoryId: '212' },
      { name: 'Women\'s Bottoms', slug: 'womens-bottoms', googleCategoryId: '204' },
      { name: 'Dresses', slug: 'dresses', googleCategoryId: '2271' },
      { name: 'Men\'s Shirts', slug: 'mens-shirts', googleCategoryId: '212' },
      { name: 'Men\'s Pants', slug: 'mens-pants', googleCategoryId: '204' },
      { name: 'Accessories', slug: 'accessories', googleCategoryId: '167' },
      { name: 'Shoes', slug: 'shoes', googleCategoryId: '187' },
    ],
    products: [
      { name: 'Classic White T-Shirt', price: 2499, category: 'Women\'s Tops', brand: 'Everlane' },
      { name: 'Silk Blouse', price: 6999, category: 'Women\'s Tops', brand: 'Theory' },
      { name: 'Cashmere Sweater', price: 12999, category: 'Women\'s Tops', brand: 'Vince' },
      { name: 'High-Waisted Jeans', price: 8999, category: 'Women\'s Bottoms', brand: 'Levi\'s' },
      { name: 'Midi Skirt', price: 5999, category: 'Women\'s Bottoms', brand: 'Zara' },
      { name: 'Summer Dress', price: 7999, category: 'Dresses', brand: 'Reformation' },
      { name: 'Cocktail Dress', price: 14999, category: 'Dresses', brand: 'Diane von Furstenberg' },
      { name: 'Oxford Shirt', price: 5999, category: 'Men\'s Shirts', brand: 'Brooks Brothers' },
      { name: 'Polo Shirt', price: 4999, category: 'Men\'s Shirts', brand: 'Ralph Lauren' },
      { name: 'Chinos', price: 6999, category: 'Men\'s Pants', brand: 'Bonobos' },
      { name: 'Dress Pants', price: 8999, category: 'Men\'s Pants', brand: 'Hugo Boss' },
      { name: 'Leather Belt', price: 3999, category: 'Accessories', brand: 'Coach' },
      { name: 'Sunglasses', price: 15999, category: 'Accessories', brand: 'Ray-Ban' },
      { name: 'Leather Handbag', price: 24999, category: 'Accessories', brand: 'Michael Kors' },
      { name: 'Sneakers', price: 8999, category: 'Shoes', brand: 'Nike' },
      { name: 'Ankle Boots', price: 12999, category: 'Shoes', brand: 'Steve Madden' },
    ],
  },
  electronics: {
    name: 'Electronics Store',
    categories: [
      { name: 'Smartphones', slug: 'smartphones', googleCategoryId: '267' },
      { name: 'Laptops', slug: 'laptops', googleCategoryId: '328' },
      { name: 'Tablets', slug: 'tablets', googleCategoryId: '4745' },
      { name: 'Accessories', slug: 'accessories', googleCategoryId: '222' },
      { name: 'Audio', slug: 'audio', googleCategoryId: '249' },
      { name: 'Smart Home', slug: 'smart-home', googleCategoryId: '222' },
    ],
    products: [
      { name: 'iPhone 15 Pro', price: 99999, category: 'Smartphones', brand: 'Apple' },
      { name: 'Samsung Galaxy S24', price: 79999, category: 'Smartphones', brand: 'Samsung' },
      { name: 'MacBook Pro 14"', price: 199999, category: 'Laptops', brand: 'Apple' },
      { name: 'Dell XPS 13', price: 129999, category: 'Laptops', brand: 'Dell' },
      { name: 'iPad Air', price: 59999, category: 'Tablets', brand: 'Apple' },
      { name: 'Samsung Galaxy Tab', price: 44999, category: 'Tablets', brand: 'Samsung' },
      { name: 'AirPods Pro', price: 24999, category: 'Audio', brand: 'Apple' },
      { name: 'Sony WH-1000XM5', price: 39999, category: 'Audio', brand: 'Sony' },
      { name: 'USB-C Cable', price: 1999, category: 'Accessories', brand: 'Anker' },
      { name: 'Phone Case', price: 2999, category: 'Accessories', brand: 'OtterBox' },
      { name: 'Screen Protector', price: 1499, category: 'Accessories', brand: 'Spigen' },
      { name: 'Smart Speaker', price: 9999, category: 'Smart Home', brand: 'Amazon Echo' },
      { name: 'Smart Bulbs (4 pk)', price: 4999, category: 'Smart Home', brand: 'Philips Hue' },
    ],
  },
  general: {
    name: 'General Store',
    categories: [
      { name: 'Home & Garden', slug: 'home-garden', googleCategoryId: '536' },
      { name: 'Health & Beauty', slug: 'health-beauty', googleCategoryId: '469' },
      { name: 'Sports & Outdoors', slug: 'sports-outdoors', googleCategoryId: '499' },
      { name: 'Toys & Games', slug: 'toys-games', googleCategoryId: '1253' },
      { name: 'Books & Media', slug: 'books-media', googleCategoryId: '783' },
    ],
    products: [
      { name: 'Throw Pillow', price: 2499, category: 'Home & Garden', brand: 'HomeGoods' },
      { name: 'Candle Set', price: 3499, category: 'Home & Garden', brand: 'Yankee Candle' },
      { name: 'Face Cream', price: 4999, category: 'Health & Beauty', brand: 'Neutrogena' },
      { name: 'Shampoo', price: 1299, category: 'Health & Beauty', brand: 'Pantene' },
      { name: 'Yoga Mat', price: 2999, category: 'Sports & Outdoors', brand: 'Gaiam' },
      { name: 'Water Bottle', price: 1999, category: 'Sports & Outdoors', brand: 'Hydro Flask' },
      { name: 'Board Game', price: 2999, category: 'Toys & Games', brand: 'Hasbro' },
      { name: 'Puzzle (1000 pc)', price: 1999, category: 'Toys & Games', brand: 'Ravensburger' },
      { name: 'Bestseller Novel', price: 1699, category: 'Books & Media', brand: 'Penguin' },
      { name: 'Cookbook', price: 2499, category: 'Books & Media', brand: 'Random House' },
    ],
  },
};

export type QuickStartScenario = keyof typeof SCENARIOS;

export interface QuickStartOptions {
  tenantId: string;
  scenario: QuickStartScenario;
  productCount: number;
  assignCategories?: boolean;
  createAsDrafts?: boolean;
}

export interface QuickStartResult {
  productsCreated: number;
  categoriesCreated: number;
  categorizedProducts: number;
  activeProducts: number;
  inStockProducts: number;
}

/**
 * Generate quick start products for a tenant
 */
export async function generateQuickStartProducts(
  options: QuickStartOptions
): Promise<QuickStartResult> {
  const {
    tenantId,
    scenario,
    productCount,
    assignCategories = true,
    createAsDrafts = true,
  } = options;

  // Validate scenario
  if (!SCENARIOS[scenario]) {
    throw new Error(`Invalid scenario: ${scenario}`);
  }

  // Validate tenant exists
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const scenarioData = SCENARIOS[scenario];
  const timestamp = Date.now();

  // Create categories
  const categories: Array<{ id: string; name: string; slug: string; originalName: string }> = [];
  for (const cat of scenarioData.categories) {
    const category = await prisma.tenantCategory.upsert({
      where: {
        tenantId_slug: {
          tenantId,
          slug: cat.slug,
        },
      },
      update: {
        name: cat.name,
        googleCategoryId: cat.googleCategoryId,
        isActive: true,
      },
      create: {
        tenantId,
        name: cat.name,
        slug: cat.slug,
        googleCategoryId: cat.googleCategoryId,
        isActive: true,
        sortOrder: categories.length,
      },
    });
    categories.push({ ...category, originalName: cat.name });
  }

  // Generate products (cycle through available products)
  const allProducts = [];
  const baseProducts = scenarioData.products;
  
  for (let i = 0; i < productCount; i++) {
    const baseProduct = baseProducts[i % baseProducts.length];
    const variant = Math.floor(i / baseProducts.length);
    
    allProducts.push({
      ...baseProduct,
      name: variant > 0 ? `${baseProduct.name} (${variant + 1})` : baseProduct.name,
    });
  }

  // Create products in batches
  const batchSize = 100;
  let createdCount = 0;

  for (let i = 0; i < allProducts.length; i += batchSize) {
    const batch = allProducts.slice(i, i + batchSize);
    const items = batch.map((product, idx) => {
      const availability = Math.random() > 0.25 ? 'in_stock' as const : 'out_of_stock' as const;
      const stock = availability === 'in_stock' ? Math.floor(Math.random() * 96) + 5 : 0;

      // Assign category if enabled
      let categoryAssignment: { tenantCategoryId?: string; categoryPath?: string[] } = {};
      if (assignCategories && categories.length > 0) {
        const matchingCat = categories.find((c) => c.originalName === product.category);
        const selectedCat = matchingCat || categories[Math.floor(Math.random() * categories.length)];
        categoryAssignment = {
          tenantCategoryId: selectedCat.id,
          categoryPath: [selectedCat.slug],
        };
      }

      // Determine item status
      const itemStatus = createAsDrafts ? 'inactive' as const : (Math.random() > 0.25 ? 'active' as const : 'inactive' as const);

      return {
        tenantId,
        sku: `SKU-${timestamp}-${(i + idx).toString().padStart(5, '0')}`,
        name: product.name,
        title: product.name,
        brand: product.brand || 'Generic',
        priceCents: product.price,
        price: product.price / 100,
        currency: 'USD',
        stock,
        availability,
        itemStatus,
        ...categoryAssignment,
      };
    });

    await prisma.inventoryItem.createMany({ data: items });
    createdCount += items.length;
  }

  // Get final counts
  const totalProducts = await prisma.inventoryItem.count({
    where: { tenantId },
  });

  const activeProducts = await prisma.inventoryItem.count({
    where: { tenantId, itemStatus: 'active' },
  });

  const inStockProducts = await prisma.inventoryItem.count({
    where: { tenantId, availability: 'in_stock' },
  });

  const categorizedProducts = await prisma.inventoryItem.count({
    where: { tenantId, tenantCategoryId: { not: null } },
  });

  return {
    productsCreated: createdCount,
    categoriesCreated: categories.length,
    categorizedProducts,
    activeProducts,
    inStockProducts,
  };
}

/**
 * Get available scenarios
 */
export function getAvailableScenarios() {
  return Object.keys(SCENARIOS).map((key) => ({
    id: key,
    name: SCENARIOS[key as QuickStartScenario].name,
    categoryCount: SCENARIOS[key as QuickStartScenario].categories.length,
    sampleProductCount: SCENARIOS[key as QuickStartScenario].products.length,
  }));
}
