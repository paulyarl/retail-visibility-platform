/**
 * Quick Start Product Generator
 * 
 * Provides reusable functions for generating starter products for new tenants.
 * Used by both CLI seeding script and Quick Start API endpoint.
 */

import { generateItemId, generateQuickStartSku, generateQuickStart } from './id-generator';
import { suggestCategories, getCategoryById } from './google/taxonomy';
import { productCacheService } from '../services/ProductCacheService';
import { z } from 'zod';

// Item schema validation (copied from index.ts for consistency)
const baseItemSchema = z.object({
  tenant_id: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(), // Accept camelCase from frontend
  sku: z.string().min(1),
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  image_url: z.string().url().nullable().optional(),
  metadata: z.any().optional(),
  description: z.string().nullable().optional(),
  // v3.4 SWIS fields (required by schema)
  title: z.string().min(1).optional(),
  brand: z.string().min(1).optional(),
  manufacturer: z.string().nullable().optional(),
  price: z.union([z.number(), z.string().transform(Number)]).pipe(z.number().nonnegative()).optional(),
  currency: z.string().length(3).optional(),
  availability: z.enum(['in_stock', 'out_of_stock', 'preorder']).optional(),
  // Item status and visibility
  item_status: z.enum(['active', 'inactive', 'archived']).optional(),
  itemStatus: z.enum(['active', 'inactive', 'archived']).optional(), // Accept camelCase from frontend
  status: z.string().optional(), // Legacy field, ignore
  visibility: z.enum(['public', 'private']).optional(),
  // Category path for Google Shopping
  category_path: z.array(z.string()).optional(),
  // Tenant category assignment
  directory_category_id: z.string().nullable().optional(),
  tenantCategoryId: z.string().nullable().optional(), // Accept camelCase from frontend
});

const createItemSchema = baseItemSchema.extend({
  // Apply defaults only for creation
  price_cents: z.number().int().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
}).transform((data) => {
  const { tenant_id, tenantId, itemStatus, item_status, tenantCategoryId, directory_category_id, status, ...rest } = data;
  return {
    ...rest,
    tenant_id: tenant_id || tenantId, // Prefer snake_case, fallback to camelCase
    item_status: item_status || itemStatus || 'active', // Prefer snake_case, fallback to camelCase, default to active
    directory_category_id: directory_category_id || tenantCategoryId || null, // Prefer snake_case, fallback to camelCase
  };
});

// Product scenarios with realistic data
const SCENARIOS = {
  grocery: {
    name: 'Grocery Store',
    categories: [
      { name: 'Dairy & Eggs', slug: 'dairy-eggs', searchTerm: 'dairy eggs milk cheese' },
      { name: 'Produce', slug: 'produce', searchTerm: 'fresh produce fruits vegetables' },
      { name: 'Meat & Seafood', slug: 'meat-seafood', searchTerm: 'meat seafood fish chicken beef' },
      { name: 'Bakery', slug: 'bakery', searchTerm: 'bakery bread pastries' },
      { name: 'Frozen Foods', slug: 'frozen-foods', searchTerm: 'frozen food ice cream pizza' },
      { name: 'Beverages', slug: 'beverages', searchTerm: 'beverages drinks juice coffee' },
      { name: 'Snacks', slug: 'snacks', searchTerm: 'snacks chips cookies candy' },
      { name: 'Pantry Staples', slug: 'pantry-staples', searchTerm: 'pantry staples pasta rice canned goods' },
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
      { name: 'Women\'s Tops', slug: 'womens-tops', searchTerm: 'women tops shirts blouses' },
      { name: 'Women\'s Bottoms', slug: 'womens-bottoms', searchTerm: 'women pants jeans skirts' },
      { name: 'Dresses', slug: 'dresses', searchTerm: 'women dresses gowns' },
      { name: 'Men\'s Shirts', slug: 'mens-shirts', searchTerm: 'men shirts polo oxford' },
      { name: 'Men\'s Pants', slug: 'mens-pants', searchTerm: 'men pants jeans chinos' },
      { name: 'Accessories', slug: 'accessories', searchTerm: 'fashion accessories bags belts' },
      { name: 'Shoes', slug: 'shoes', searchTerm: 'shoes footwear sneakers boots' },
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
      { name: 'Smartphones', slug: 'smartphones', searchTerm: 'smartphones mobile phones cell' },
      { name: 'Laptops', slug: 'laptops', searchTerm: 'laptops computers notebooks' },
      { name: 'Tablets', slug: 'tablets', searchTerm: 'tablets ipad android' },
      { name: 'Accessories', slug: 'accessories', searchTerm: 'electronics accessories cables chargers' },
      { name: 'Audio', slug: 'audio', searchTerm: 'audio headphones speakers earbuds' },
      { name: 'Smart Home', slug: 'smart-home', searchTerm: 'smart home automation devices' },
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
    name: 'General Retail',
    categories: [
      { name: 'Home & Garden', slug: 'home-garden', searchTerm: 'home garden furniture decor' },
      { name: 'Health & Beauty', slug: 'health-beauty', searchTerm: 'health beauty cosmetics skincare' },
      { name: 'Sports & Outdoors', slug: 'sports-outdoors', searchTerm: 'sports outdoors fitness camping' },
      { name: 'Toys & Games', slug: 'toys-games', searchTerm: 'toys games puzzles board games' },
      { name: 'Books & Media', slug: 'books-media', searchTerm: 'books media magazines dvd' },
      { name: 'Office Supplies', slug: 'office-supplies', searchTerm: 'office supplies stationery paper' },
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
  
  // ============================================
  // NEW SCENARIOS - Realistic Retail Shelf Products
  // ============================================
  
  pharmacy: {
    name: 'Pharmacy',
    categories: [
      { name: 'Over-the-Counter Medicine', slug: 'otc-medicine', searchTerm: 'otc medicine pain relief cold flu' },
      { name: 'Vitamins & Supplements', slug: 'vitamins-supplements', searchTerm: 'vitamins supplements minerals health' },
      { name: 'First Aid', slug: 'first-aid', searchTerm: 'first aid bandages antiseptic medical' },
      { name: 'Personal Care', slug: 'personal-care', searchTerm: 'personal care hygiene toiletries' },
      { name: 'Baby Care', slug: 'baby-care', searchTerm: 'baby care diapers formula infant' },
      { name: 'Eye & Ear Care', slug: 'eye-ear-care', searchTerm: 'eye care ear care drops contacts' },
    ],
    products: [
      { name: 'Ibuprofen 200mg (100 ct)', price: 899, category: 'Over-the-Counter Medicine', brand: 'Advil' },
      { name: 'Acetaminophen 500mg (50 ct)', price: 699, category: 'Over-the-Counter Medicine', brand: 'Tylenol' },
      { name: 'Allergy Relief 24hr (30 ct)', price: 1899, category: 'Over-the-Counter Medicine', brand: 'Claritin' },
      { name: 'Cold & Flu Severe (24 ct)', price: 1299, category: 'Over-the-Counter Medicine', brand: 'DayQuil' },
      { name: 'Antacid Tablets (72 ct)', price: 799, category: 'Over-the-Counter Medicine', brand: 'Tums' },
      { name: 'Multivitamin Daily (150 ct)', price: 1499, category: 'Vitamins & Supplements', brand: 'Centrum' },
      { name: 'Vitamin D3 2000IU (200 ct)', price: 1199, category: 'Vitamins & Supplements', brand: 'Nature Made' },
      { name: 'Fish Oil 1000mg (120 ct)', price: 1699, category: 'Vitamins & Supplements', brand: 'Nature\'s Bounty' },
      { name: 'Probiotic Daily (30 ct)', price: 2499, category: 'Vitamins & Supplements', brand: 'Culturelle' },
      { name: 'Adhesive Bandages (100 ct)', price: 599, category: 'First Aid', brand: 'Band-Aid' },
      { name: 'Hydrogen Peroxide 16oz', price: 299, category: 'First Aid', brand: 'Swan' },
      { name: 'Triple Antibiotic Ointment', price: 699, category: 'First Aid', brand: 'Neosporin' },
      { name: 'Digital Thermometer', price: 1299, category: 'First Aid', brand: 'Vicks' },
      { name: 'Toothpaste Whitening 4.8oz', price: 549, category: 'Personal Care', brand: 'Crest' },
      { name: 'Deodorant Antiperspirant', price: 599, category: 'Personal Care', brand: 'Dove' },
      { name: 'Hand Sanitizer 8oz', price: 449, category: 'Personal Care', brand: 'Purell' },
      { name: 'Diapers Size 3 (88 ct)', price: 2999, category: 'Baby Care', brand: 'Pampers' },
      { name: 'Baby Wipes (400 ct)', price: 1499, category: 'Baby Care', brand: 'Huggies' },
      { name: 'Infant Formula 22.2oz', price: 3499, category: 'Baby Care', brand: 'Similac' },
      { name: 'Contact Lens Solution 12oz', price: 1099, category: 'Eye & Ear Care', brand: 'Opti-Free' },
      { name: 'Eye Drops Lubricant', price: 899, category: 'Eye & Ear Care', brand: 'Visine' },
    ],
  },
  
  home_garden: {
    name: 'Home & Garden',
    categories: [
      { name: 'Kitchen & Dining', slug: 'kitchen-dining', searchTerm: 'kitchen dining cookware dishes' },
      { name: 'Bedding & Bath', slug: 'bedding-bath', searchTerm: 'bedding bath towels sheets pillows' },
      { name: 'Home Decor', slug: 'home-decor', searchTerm: 'home decor wall art frames mirrors' },
      { name: 'Storage & Organization', slug: 'storage-organization', searchTerm: 'storage organization bins containers' },
      { name: 'Garden & Outdoor', slug: 'garden-outdoor', searchTerm: 'garden outdoor plants pots tools' },
      { name: 'Cleaning Supplies', slug: 'cleaning-supplies', searchTerm: 'cleaning supplies household cleaners' },
    ],
    products: [
      { name: 'Non-Stick Frying Pan 12"', price: 2999, category: 'Kitchen & Dining', brand: 'T-fal' },
      { name: 'Stainless Steel Pot Set (10pc)', price: 8999, category: 'Kitchen & Dining', brand: 'Cuisinart' },
      { name: 'Dinnerware Set (16pc)', price: 4999, category: 'Kitchen & Dining', brand: 'Corelle' },
      { name: 'Knife Block Set (14pc)', price: 7999, category: 'Kitchen & Dining', brand: 'Henckels' },
      { name: 'Queen Sheet Set 400TC', price: 4999, category: 'Bedding & Bath', brand: 'Threshold' },
      { name: 'Memory Foam Pillow (2pk)', price: 3999, category: 'Bedding & Bath', brand: 'Tempur-Pedic' },
      { name: 'Bath Towel Set (6pc)', price: 2999, category: 'Bedding & Bath', brand: 'Fieldcrest' },
      { name: 'Shower Curtain & Hooks', price: 1999, category: 'Bedding & Bath', brand: 'Threshold' },
      { name: 'Decorative Throw Blanket', price: 3499, category: 'Home Decor', brand: 'Threshold' },
      { name: 'Wall Art Canvas 24x36"', price: 4999, category: 'Home Decor', brand: 'Americanflat' },
      { name: 'Scented Candle 3-Wick', price: 2499, category: 'Home Decor', brand: 'Yankee Candle' },
      { name: 'Picture Frame Set (7pc)', price: 2999, category: 'Home Decor', brand: 'Gallery Perfect' },
      { name: 'Plastic Storage Bins (6pk)', price: 2499, category: 'Storage & Organization', brand: 'Sterilite' },
      { name: 'Closet Organizer System', price: 5999, category: 'Storage & Organization', brand: 'ClosetMaid' },
      { name: 'Potting Soil 25qt', price: 1299, category: 'Garden & Outdoor', brand: 'Miracle-Gro' },
      { name: 'Garden Hose 50ft', price: 2999, category: 'Garden & Outdoor', brand: 'Flexzilla' },
      { name: 'Ceramic Planter 12"', price: 1999, category: 'Garden & Outdoor', brand: 'Costa Farms' },
      { name: 'All-Purpose Cleaner 32oz', price: 449, category: 'Cleaning Supplies', brand: 'Lysol' },
      { name: 'Laundry Detergent 100oz', price: 1299, category: 'Cleaning Supplies', brand: 'Tide' },
      { name: 'Paper Towels (8 rolls)', price: 1599, category: 'Cleaning Supplies', brand: 'Bounty' },
    ],
  },
  
  health_beauty: {
    name: 'Health & Beauty',
    categories: [
      { name: 'Skincare', slug: 'skincare', searchTerm: 'skincare moisturizer cleanser serum' },
      { name: 'Haircare', slug: 'haircare', searchTerm: 'haircare shampoo conditioner styling' },
      { name: 'Makeup', slug: 'makeup', searchTerm: 'makeup cosmetics foundation lipstick' },
      { name: 'Fragrance', slug: 'fragrance', searchTerm: 'fragrance perfume cologne body spray' },
      { name: 'Men\'s Grooming', slug: 'mens-grooming', searchTerm: 'mens grooming shaving beard' },
    ],
    products: [
      { name: 'Daily Moisturizer SPF 30', price: 1899, category: 'Skincare', brand: 'CeraVe' },
      { name: 'Facial Cleanser 16oz', price: 1499, category: 'Skincare', brand: 'Cetaphil' },
      { name: 'Vitamin C Serum 1oz', price: 2999, category: 'Skincare', brand: 'TruSkin' },
      { name: 'Retinol Night Cream', price: 2499, category: 'Skincare', brand: 'RoC' },
      { name: 'Eye Cream Anti-Aging', price: 2199, category: 'Skincare', brand: 'Olay' },
      { name: 'Shampoo Moisturizing 13oz', price: 799, category: 'Haircare', brand: 'Pantene' },
      { name: 'Conditioner Repair 13oz', price: 799, category: 'Haircare', brand: 'Pantene' },
      { name: 'Hair Styling Gel 8oz', price: 599, category: 'Haircare', brand: 'Got2b' },
      { name: 'Dry Shampoo 4.3oz', price: 899, category: 'Haircare', brand: 'Batiste' },
      { name: 'Heat Protectant Spray', price: 1099, category: 'Haircare', brand: 'TRESemmé' },
      { name: 'Foundation Medium Coverage', price: 1299, category: 'Makeup', brand: 'Maybelline' },
      { name: 'Mascara Volumizing', price: 999, category: 'Makeup', brand: 'L\'Oréal' },
      { name: 'Lipstick Matte', price: 899, category: 'Makeup', brand: 'Revlon' },
      { name: 'Eyeshadow Palette (12 colors)', price: 1499, category: 'Makeup', brand: 'NYX' },
      { name: 'Setting Spray 4oz', price: 1099, category: 'Makeup', brand: 'e.l.f.' },
      { name: 'Women\'s Eau de Parfum 3.4oz', price: 8999, category: 'Fragrance', brand: 'Calvin Klein' },
      { name: 'Body Mist 8oz', price: 1899, category: 'Fragrance', brand: 'Victoria\'s Secret' },
      { name: 'Men\'s Cologne 3.4oz', price: 7999, category: 'Fragrance', brand: 'Versace' },
      { name: 'Razor Cartridges (8 ct)', price: 2999, category: 'Men\'s Grooming', brand: 'Gillette' },
      { name: 'Shaving Cream 7oz', price: 599, category: 'Men\'s Grooming', brand: 'Barbasol' },
      { name: 'Beard Oil 2oz', price: 1499, category: 'Men\'s Grooming', brand: 'Honest Amish' },
    ],
  },
  
  sports_outdoors: {
    name: 'Sports & Outdoors',
    categories: [
      { name: 'Fitness Equipment', slug: 'fitness-equipment', searchTerm: 'fitness equipment weights dumbbells' },
      { name: 'Athletic Apparel', slug: 'athletic-apparel', searchTerm: 'athletic apparel workout clothes' },
      { name: 'Camping & Hiking', slug: 'camping-hiking', searchTerm: 'camping hiking tents backpacks' },
      { name: 'Team Sports', slug: 'team-sports', searchTerm: 'team sports balls equipment' },
      { name: 'Water Sports', slug: 'water-sports', searchTerm: 'water sports swimming pool beach' },
    ],
    products: [
      { name: 'Yoga Mat 6mm', price: 2499, category: 'Fitness Equipment', brand: 'Gaiam' },
      { name: 'Resistance Bands Set (5pc)', price: 1999, category: 'Fitness Equipment', brand: 'Fit Simplify' },
      { name: 'Dumbbell Set 20lb (pair)', price: 4999, category: 'Fitness Equipment', brand: 'CAP Barbell' },
      { name: 'Jump Rope Speed', price: 1299, category: 'Fitness Equipment', brand: 'Crossrope' },
      { name: 'Foam Roller 18"', price: 1999, category: 'Fitness Equipment', brand: 'TriggerPoint' },
      { name: 'Men\'s Running Shorts', price: 2999, category: 'Athletic Apparel', brand: 'Nike' },
      { name: 'Women\'s Sports Bra', price: 3499, category: 'Athletic Apparel', brand: 'Under Armour' },
      { name: 'Athletic Socks (6 pair)', price: 1499, category: 'Athletic Apparel', brand: 'Adidas' },
      { name: 'Compression Leggings', price: 3999, category: 'Athletic Apparel', brand: 'Lululemon' },
      { name: '2-Person Tent', price: 7999, category: 'Camping & Hiking', brand: 'Coleman' },
      { name: 'Sleeping Bag 20°F', price: 4999, category: 'Camping & Hiking', brand: 'Kelty' },
      { name: 'Hiking Backpack 40L', price: 8999, category: 'Camping & Hiking', brand: 'Osprey' },
      { name: 'LED Headlamp', price: 1999, category: 'Camping & Hiking', brand: 'Black Diamond' },
      { name: 'Basketball Official Size', price: 2999, category: 'Team Sports', brand: 'Spalding' },
      { name: 'Soccer Ball Size 5', price: 2499, category: 'Team Sports', brand: 'Adidas' },
      { name: 'Football Official', price: 2999, category: 'Team Sports', brand: 'Wilson' },
      { name: 'Baseball Glove 12"', price: 4999, category: 'Team Sports', brand: 'Rawlings' },
      { name: 'Swim Goggles', price: 1499, category: 'Water Sports', brand: 'Speedo' },
      { name: 'Beach Towel Oversized', price: 1999, category: 'Water Sports', brand: 'Dock & Bay' },
      { name: 'Pool Float Lounger', price: 2999, category: 'Water Sports', brand: 'Intex' },
    ],
  },
  
  toys_games: {
    name: 'Toys & Games',
    categories: [
      { name: 'Action Figures & Dolls', slug: 'action-figures-dolls', searchTerm: 'action figures dolls toys collectibles' },
      { name: 'Building Sets', slug: 'building-sets', searchTerm: 'building sets lego blocks construction' },
      { name: 'Board Games & Puzzles', slug: 'board-games-puzzles', searchTerm: 'board games puzzles family games' },
      { name: 'Outdoor Play', slug: 'outdoor-play', searchTerm: 'outdoor play toys bikes scooters' },
      { name: 'Educational Toys', slug: 'educational-toys', searchTerm: 'educational toys learning stem' },
    ],
    products: [
      { name: 'Barbie Dreamhouse', price: 19999, category: 'Action Figures & Dolls', brand: 'Barbie' },
      { name: 'Action Figure 6" Collectible', price: 1999, category: 'Action Figures & Dolls', brand: 'Marvel Legends' },
      { name: 'Baby Doll with Accessories', price: 2999, category: 'Action Figures & Dolls', brand: 'Baby Alive' },
      { name: 'Plush Teddy Bear 18"', price: 2499, category: 'Action Figures & Dolls', brand: 'Build-A-Bear' },
      { name: 'LEGO City Set (500pc)', price: 4999, category: 'Building Sets', brand: 'LEGO' },
      { name: 'LEGO Star Wars Set', price: 7999, category: 'Building Sets', brand: 'LEGO' },
      { name: 'Magnetic Building Tiles (100pc)', price: 3999, category: 'Building Sets', brand: 'Magna-Tiles' },
      { name: 'Lincoln Logs Classic', price: 2999, category: 'Building Sets', brand: 'Lincoln Logs' },
      { name: 'Monopoly Classic', price: 1999, category: 'Board Games & Puzzles', brand: 'Hasbro' },
      { name: 'Scrabble Deluxe', price: 2999, category: 'Board Games & Puzzles', brand: 'Hasbro' },
      { name: 'Puzzle 1000 Pieces', price: 1499, category: 'Board Games & Puzzles', brand: 'Ravensburger' },
      { name: 'Uno Card Game', price: 799, category: 'Board Games & Puzzles', brand: 'Mattel' },
      { name: 'Jenga Classic', price: 1499, category: 'Board Games & Puzzles', brand: 'Hasbro' },
      { name: 'Kids Scooter 2-Wheel', price: 4999, category: 'Outdoor Play', brand: 'Razor' },
      { name: 'Sidewalk Chalk (24 ct)', price: 599, category: 'Outdoor Play', brand: 'Crayola' },
      { name: 'Bubble Machine', price: 1999, category: 'Outdoor Play', brand: 'Little Tikes' },
      { name: 'STEM Robot Kit', price: 5999, category: 'Educational Toys', brand: 'LEGO Mindstorms' },
      { name: 'Microscope Kids Set', price: 3999, category: 'Educational Toys', brand: 'National Geographic' },
      { name: 'LeapFrog Learning Tablet', price: 2499, category: 'Educational Toys', brand: 'LeapFrog' },
    ],
  },
  
  automotive: {
    name: 'Automotive',
    categories: [
      { name: 'Motor Oil & Fluids', slug: 'motor-oil-fluids', searchTerm: 'motor oil fluids automotive lubricants' },
      { name: 'Car Care & Cleaning', slug: 'car-care-cleaning', searchTerm: 'car care cleaning wash wax detail' },
      { name: 'Interior Accessories', slug: 'interior-accessories', searchTerm: 'car interior accessories mats covers' },
      { name: 'Exterior Accessories', slug: 'exterior-accessories', searchTerm: 'car exterior accessories lights covers' },
    ],
    products: [
      { name: 'Full Synthetic Motor Oil 5qt', price: 2999, category: 'Motor Oil & Fluids', brand: 'Mobil 1' },
      { name: 'Conventional Motor Oil 5qt', price: 1999, category: 'Motor Oil & Fluids', brand: 'Pennzoil' },
      { name: 'Windshield Washer Fluid 1gal', price: 399, category: 'Motor Oil & Fluids', brand: 'Rain-X' },
      { name: 'Brake Fluid 12oz', price: 799, category: 'Motor Oil & Fluids', brand: 'Prestone' },
      { name: 'Antifreeze/Coolant 1gal', price: 1499, category: 'Motor Oil & Fluids', brand: 'Prestone' },
      { name: 'Car Wash Soap 64oz', price: 999, category: 'Car Care & Cleaning', brand: 'Meguiar\'s' },
      { name: 'Tire Shine Spray 15oz', price: 799, category: 'Car Care & Cleaning', brand: 'Armor All' },
      { name: 'Interior Cleaner 16oz', price: 699, category: 'Car Care & Cleaning', brand: 'Chemical Guys' },
      { name: 'Microfiber Towels (24 pk)', price: 1499, category: 'Car Care & Cleaning', brand: 'Kirkland' },
      { name: 'Car Wax Paste 11oz', price: 1299, category: 'Car Care & Cleaning', brand: 'Turtle Wax' },
      { name: 'Floor Mats All-Weather (4pc)', price: 3999, category: 'Interior Accessories', brand: 'WeatherTech' },
      { name: 'Seat Covers Universal (2pc)', price: 2999, category: 'Interior Accessories', brand: 'FH Group' },
      { name: 'Phone Mount Dashboard', price: 1999, category: 'Interior Accessories', brand: 'iOttie' },
      { name: 'Air Freshener 3-Pack', price: 599, category: 'Interior Accessories', brand: 'Little Trees' },
      { name: 'Dash Cam 1080p', price: 4999, category: 'Exterior Accessories', brand: 'Garmin' },
      { name: 'License Plate Frame (2pk)', price: 1299, category: 'Exterior Accessories', brand: 'Motorup' },
    ],
  },
  
  books_media: {
    name: 'Books & Media',
    categories: [
      { name: 'Fiction', slug: 'fiction', searchTerm: 'fiction novels bestsellers literature' },
      { name: 'Non-Fiction', slug: 'non-fiction', searchTerm: 'non-fiction biography history self-help' },
      { name: 'Children\'s Books', slug: 'childrens-books', searchTerm: 'children books kids picture books' },
      { name: 'Magazines & Periodicals', slug: 'magazines', searchTerm: 'magazines periodicals subscriptions' },
      { name: 'Music & Movies', slug: 'music-movies', searchTerm: 'music cds vinyl movies dvd blu-ray' },
    ],
    products: [
      { name: 'Bestseller Thriller Novel', price: 1699, category: 'Fiction', brand: 'Random House' },
      { name: 'Romance Paperback', price: 999, category: 'Fiction', brand: 'Harlequin' },
      { name: 'Science Fiction Hardcover', price: 2799, category: 'Fiction', brand: 'Tor Books' },
      { name: 'Mystery Novel', price: 1599, category: 'Fiction', brand: 'Penguin' },
      { name: 'Self-Help Bestseller', price: 1899, category: 'Non-Fiction', brand: 'Simon & Schuster' },
      { name: 'Biography Hardcover', price: 2999, category: 'Non-Fiction', brand: 'Little, Brown' },
      { name: 'Cookbook Illustrated', price: 3499, category: 'Non-Fiction', brand: 'America\'s Test Kitchen' },
      { name: 'History Book', price: 2199, category: 'Non-Fiction', brand: 'Oxford Press' },
      { name: 'Picture Book Ages 3-5', price: 899, category: 'Children\'s Books', brand: 'Scholastic' },
      { name: 'Chapter Book Ages 6-9', price: 799, category: 'Children\'s Books', brand: 'Scholastic' },
      { name: 'Activity Book with Stickers', price: 1099, category: 'Children\'s Books', brand: 'Melissa & Doug' },
      { name: 'Dr. Seuss Collection', price: 1499, category: 'Children\'s Books', brand: 'Random House' },
      { name: 'Monthly Magazine Subscription', price: 599, category: 'Magazines & Periodicals', brand: 'Time' },
      { name: 'Weekly News Magazine', price: 699, category: 'Magazines & Periodicals', brand: 'The Economist' },
      { name: 'Vinyl Record Classic Album', price: 2999, category: 'Music & Movies', brand: 'Various' },
      { name: 'Blu-ray Movie New Release', price: 2499, category: 'Music & Movies', brand: 'Universal' },
      { name: 'DVD Box Set TV Series', price: 3999, category: 'Music & Movies', brand: 'Warner Bros' },
    ],
  },
  
  pet_supplies: {
    name: 'Pet Supplies',
    categories: [
      { name: 'Dog Food & Treats', slug: 'dog-food-treats', searchTerm: 'dog food treats kibble' },
      { name: 'Cat Food & Treats', slug: 'cat-food-treats', searchTerm: 'cat food treats wet dry' },
      { name: 'Pet Toys', slug: 'pet-toys', searchTerm: 'pet toys dog cat interactive' },
      { name: 'Pet Care & Grooming', slug: 'pet-care-grooming', searchTerm: 'pet grooming shampoo brushes' },
    ],
    products: [
      { name: 'Dry Dog Food 30lb', price: 4999, category: 'Dog Food & Treats', brand: 'Blue Buffalo' },
      { name: 'Wet Dog Food (12 cans)', price: 2499, category: 'Dog Food & Treats', brand: 'Pedigree' },
      { name: 'Dog Treats Training (16oz)', price: 999, category: 'Dog Food & Treats', brand: 'Milk-Bone' },
      { name: 'Dental Chews (30 ct)', price: 2499, category: 'Dog Food & Treats', brand: 'Greenies' },
      { name: 'Dry Cat Food 16lb', price: 3499, category: 'Cat Food & Treats', brand: 'Purina ONE' },
      { name: 'Wet Cat Food (24 cans)', price: 1999, category: 'Cat Food & Treats', brand: 'Fancy Feast' },
      { name: 'Cat Treats Crunchy (16oz)', price: 699, category: 'Cat Food & Treats', brand: 'Temptations' },
      { name: 'Catnip Organic 1oz', price: 499, category: 'Cat Food & Treats', brand: 'SmartyKat' },
      { name: 'Dog Chew Toy Durable', price: 1299, category: 'Pet Toys', brand: 'KONG' },
      { name: 'Dog Ball Launcher', price: 1999, category: 'Pet Toys', brand: 'Chuckit!' },
      { name: 'Cat Feather Wand', price: 799, category: 'Pet Toys', brand: 'SmartyKat' },
      { name: 'Cat Scratching Post 32"', price: 2999, category: 'Pet Toys', brand: 'Amazon Basics' },
      { name: 'Pet Shampoo 16oz', price: 899, category: 'Pet Care & Grooming', brand: 'Burt\'s Bees' },
      { name: 'Dog Brush Deshedding', price: 1999, category: 'Pet Care & Grooming', brand: 'FURminator' },
      { name: 'Pet Nail Clippers', price: 999, category: 'Pet Care & Grooming', brand: 'Safari' },
      { name: 'Cat Litter 40lb', price: 1999, category: 'Pet Care & Grooming', brand: 'Tidy Cats' },
    ],
  },
  
  office_supplies: {
    name: 'Office Supplies',
    categories: [
      { name: 'Writing Instruments', slug: 'writing-instruments', searchTerm: 'pens pencils markers highlighters' },
      { name: 'Paper Products', slug: 'paper-products', searchTerm: 'paper notebooks copy paper notepads' },
      { name: 'Filing & Organization', slug: 'filing-organization', searchTerm: 'folders binders filing organization' },
      { name: 'Desk Accessories', slug: 'desk-accessories', searchTerm: 'desk accessories organizers staplers' },
      { name: 'Mailing & Shipping', slug: 'mailing-shipping', searchTerm: 'mailing shipping envelopes boxes tape' },
    ],
    products: [
      { name: 'Ballpoint Pens (12 pk)', price: 599, category: 'Writing Instruments', brand: 'Bic' },
      { name: 'Gel Pens Assorted (8 pk)', price: 899, category: 'Writing Instruments', brand: 'Pilot G2' },
      { name: 'Mechanical Pencils (10 pk)', price: 799, category: 'Writing Instruments', brand: 'Pentel' },
      { name: 'Highlighters (6 pk)', price: 599, category: 'Writing Instruments', brand: 'Sharpie' },
      { name: 'Permanent Markers (12 pk)', price: 999, category: 'Writing Instruments', brand: 'Sharpie' },
      { name: 'Copy Paper 500 Sheets', price: 799, category: 'Paper Products', brand: 'HP' },
      { name: 'Legal Pads (12 pk)', price: 1499, category: 'Paper Products', brand: 'TOPS' },
      { name: 'Spiral Notebook 5-Subject', price: 599, category: 'Paper Products', brand: 'Five Star' },
      { name: 'Sticky Notes 3x3 (12 pk)', price: 999, category: 'Paper Products', brand: 'Post-it' },
      { name: 'Index Cards 3x5 (500 ct)', price: 599, category: 'Paper Products', brand: 'Oxford' },
      { name: 'Manila Folders (100 ct)', price: 1299, category: 'Filing & Organization', brand: 'Pendaflex' },
      { name: '3-Ring Binder 2" (4 pk)', price: 1999, category: 'Filing & Organization', brand: 'Avery' },
      { name: 'Sheet Protectors (100 ct)', price: 999, category: 'Filing & Organization', brand: 'Avery' },
      { name: 'File Cabinet 2-Drawer', price: 8999, category: 'Filing & Organization', brand: 'HON' },
      { name: 'Desktop Stapler', price: 1299, category: 'Desk Accessories', brand: 'Swingline' },
      { name: 'Tape Dispenser with Tape', price: 799, category: 'Desk Accessories', brand: 'Scotch' },
      { name: 'Desk Organizer Mesh', price: 1999, category: 'Desk Accessories', brand: 'Rolodex' },
      { name: 'Paper Clips (1000 ct)', price: 499, category: 'Desk Accessories', brand: 'ACCO' },
      { name: 'Shipping Boxes 12x12x12 (25pk)', price: 2999, category: 'Mailing & Shipping', brand: 'Uline' },
      { name: 'Packing Tape 6-Roll', price: 1499, category: 'Mailing & Shipping', brand: 'Scotch' },
      { name: 'Bubble Mailers (25 pk)', price: 1999, category: 'Mailing & Shipping', brand: 'Poly' },
    ],
  },
  
  jewelry: {
    name: 'Jewelry',
    categories: [
      { name: 'Necklaces & Pendants', slug: 'necklaces-pendants', searchTerm: 'necklaces pendants chains jewelry' },
      { name: 'Earrings', slug: 'earrings', searchTerm: 'earrings studs hoops drops jewelry' },
      { name: 'Bracelets & Bangles', slug: 'bracelets-bangles', searchTerm: 'bracelets bangles cuffs jewelry' },
      { name: 'Rings', slug: 'rings', searchTerm: 'rings bands statement jewelry' },
    ],
    products: [
      { name: 'Sterling Silver Chain 18"', price: 4999, category: 'Necklaces & Pendants', brand: 'Pandora' },
      { name: 'Gold Plated Pendant', price: 3999, category: 'Necklaces & Pendants', brand: 'Kate Spade' },
      { name: 'Pearl Necklace Classic', price: 7999, category: 'Necklaces & Pendants', brand: 'Mikimoto' },
      { name: 'Layered Chain Set (3pc)', price: 2999, category: 'Necklaces & Pendants', brand: 'BaubleBar' },
      { name: 'Diamond Stud Earrings', price: 19999, category: 'Earrings', brand: 'Blue Nile' },
      { name: 'Gold Hoop Earrings', price: 4999, category: 'Earrings', brand: 'Mejuri' },
      { name: 'Pearl Drop Earrings', price: 5999, category: 'Earrings', brand: 'Swarovski' },
      { name: 'Crystal Stud Set (6 pair)', price: 1999, category: 'Earrings', brand: 'Claire\'s' },
      { name: 'Tennis Bracelet Silver', price: 8999, category: 'Bracelets & Bangles', brand: 'Pandora' },
      { name: 'Charm Bracelet Starter', price: 6999, category: 'Bracelets & Bangles', brand: 'Pandora' },
      { name: 'Bangle Set Gold (5pc)', price: 3999, category: 'Bracelets & Bangles', brand: 'Alex and Ani' },
      { name: 'Leather Wrap Bracelet', price: 2499, category: 'Bracelets & Bangles', brand: 'Chan Luu' },
      { name: 'Engagement Ring Solitaire', price: 99999, category: 'Rings', brand: 'Tiffany & Co.' },
      { name: 'Stackable Rings Set (3pc)', price: 4999, category: 'Rings', brand: 'Kendra Scott' },
      { name: 'Statement Cocktail Ring', price: 5999, category: 'Rings', brand: 'Swarovski' },
      { name: 'Men\'s Wedding Band Titanium', price: 14999, category: 'Rings', brand: 'Blue Nile' },
    ],
  },
  
  baby_kids: {
    name: 'Baby & Kids',
    categories: [
      { name: 'Baby Gear', slug: 'baby-gear', searchTerm: 'baby gear strollers car seats carriers' },
      { name: 'Nursery', slug: 'nursery', searchTerm: 'nursery cribs bedding decor' },
      { name: 'Baby Feeding', slug: 'baby-feeding', searchTerm: 'baby feeding bottles formula high chairs' },
      { name: 'Kids Clothing', slug: 'kids-clothing', searchTerm: 'kids clothing children apparel' },
      { name: 'Baby Toys', slug: 'baby-toys', searchTerm: 'baby toys infant rattles teethers' },
    ],
    products: [
      { name: 'Convertible Car Seat', price: 24999, category: 'Baby Gear', brand: 'Graco' },
      { name: 'Lightweight Stroller', price: 14999, category: 'Baby Gear', brand: 'Chicco' },
      { name: 'Baby Carrier Ergonomic', price: 12999, category: 'Baby Gear', brand: 'Ergobaby' },
      { name: 'Pack N Play Playard', price: 9999, category: 'Baby Gear', brand: 'Graco' },
      { name: 'Convertible Crib 4-in-1', price: 29999, category: 'Nursery', brand: 'Delta Children' },
      { name: 'Crib Mattress Waterproof', price: 8999, category: 'Nursery', brand: 'Newton' },
      { name: 'Crib Bedding Set (4pc)', price: 4999, category: 'Nursery', brand: 'Lambs & Ivy' },
      { name: 'Baby Monitor Video', price: 14999, category: 'Nursery', brand: 'Infant Optics' },
      { name: 'Baby Bottles (6 pk)', price: 2499, category: 'Baby Feeding', brand: 'Dr. Brown\'s' },
      { name: 'High Chair Convertible', price: 12999, category: 'Baby Feeding', brand: 'Graco' },
      { name: 'Sippy Cups (4 pk)', price: 1499, category: 'Baby Feeding', brand: 'Munchkin' },
      { name: 'Baby Food Maker', price: 9999, category: 'Baby Feeding', brand: 'Baby Brezza' },
      { name: 'Toddler T-Shirt (3 pk)', price: 1999, category: 'Kids Clothing', brand: 'Carter\'s' },
      { name: 'Kids Jeans', price: 2499, category: 'Kids Clothing', brand: 'OshKosh B\'gosh' },
      { name: 'Baby Onesies (5 pk)', price: 1499, category: 'Kids Clothing', brand: 'Gerber' },
      { name: 'Teething Toys Set', price: 1299, category: 'Baby Toys', brand: 'Sophie la Girafe' },
      { name: 'Baby Rattle Set (4pc)', price: 999, category: 'Baby Toys', brand: 'Fisher-Price' },
      { name: 'Activity Gym Play Mat', price: 4999, category: 'Baby Toys', brand: 'Skip Hop' },
    ],
  },
  
  arts_crafts: {
    name: 'Arts & Crafts',
    categories: [
      { name: 'Drawing & Painting', slug: 'drawing-painting', searchTerm: 'drawing painting art supplies canvas' },
      { name: 'Craft Supplies', slug: 'craft-supplies', searchTerm: 'craft supplies glue scissors paper' },
      { name: 'Sewing & Fabric', slug: 'sewing-fabric', searchTerm: 'sewing fabric yarn needles' },
      { name: 'Kids Crafts', slug: 'kids-crafts', searchTerm: 'kids crafts art projects children' },
    ],
    products: [
      { name: 'Acrylic Paint Set (24 colors)', price: 1999, category: 'Drawing & Painting', brand: 'Liquitex' },
      { name: 'Canvas Panels 8x10 (12 pk)', price: 1499, category: 'Drawing & Painting', brand: 'Arteza' },
      { name: 'Colored Pencils (72 ct)', price: 2499, category: 'Drawing & Painting', brand: 'Prismacolor' },
      { name: 'Watercolor Set (36 colors)', price: 2999, category: 'Drawing & Painting', brand: 'Winsor & Newton' },
      { name: 'Paint Brush Set (15pc)', price: 1299, category: 'Drawing & Painting', brand: 'Royal & Langnickel' },
      { name: 'Sketch Pad 9x12 (100 sheets)', price: 999, category: 'Drawing & Painting', brand: 'Strathmore' },
      { name: 'Hot Glue Gun with Sticks', price: 1499, category: 'Craft Supplies', brand: 'Gorilla' },
      { name: 'Craft Paper Assorted (200 sheets)', price: 999, category: 'Craft Supplies', brand: 'Crayola' },
      { name: 'Scissors Craft Set (3pc)', price: 899, category: 'Craft Supplies', brand: 'Fiskars' },
      { name: 'Mod Podge 16oz', price: 799, category: 'Craft Supplies', brand: 'Mod Podge' },
      { name: 'Yarn Multipack (20 skeins)', price: 2499, category: 'Sewing & Fabric', brand: 'Red Heart' },
      { name: 'Sewing Kit Complete', price: 1999, category: 'Sewing & Fabric', brand: 'Singer' },
      { name: 'Fabric Quarters (10 pk)', price: 1499, category: 'Sewing & Fabric', brand: 'Waverly' },
      { name: 'Crochet Hooks Set', price: 1299, category: 'Sewing & Fabric', brand: 'Clover' },
      { name: 'Crayons (96 ct)', price: 799, category: 'Kids Crafts', brand: 'Crayola' },
      { name: 'Play-Doh (10 pk)', price: 999, category: 'Kids Crafts', brand: 'Play-Doh' },
      { name: 'Craft Kit Assorted', price: 2499, category: 'Kids Crafts', brand: 'Melissa & Doug' },
      { name: 'Washable Markers (40 ct)', price: 1299, category: 'Kids Crafts', brand: 'Crayola' },
    ],
  },
  
  hardware_tools: {
    name: 'Hardware & Tools',
    categories: [
      { name: 'Hand Tools', slug: 'hand-tools', searchTerm: 'hand tools hammers screwdrivers wrenches' },
      { name: 'Power Tools', slug: 'power-tools', searchTerm: 'power tools drills saws sanders' },
      { name: 'Fasteners & Hardware', slug: 'fasteners-hardware', searchTerm: 'screws nails bolts fasteners' },
      { name: 'Paint & Supplies', slug: 'paint-supplies', searchTerm: 'paint brushes rollers primer' },
      { name: 'Electrical', slug: 'electrical', searchTerm: 'electrical outlets switches wire' },
    ],
    products: [
      { name: 'Hammer Claw 16oz', price: 1999, category: 'Hand Tools', brand: 'Stanley' },
      { name: 'Screwdriver Set (20pc)', price: 2499, category: 'Hand Tools', brand: 'DeWalt' },
      { name: 'Adjustable Wrench Set (3pc)', price: 2999, category: 'Hand Tools', brand: 'Craftsman' },
      { name: 'Tape Measure 25ft', price: 1299, category: 'Hand Tools', brand: 'Stanley' },
      { name: 'Pliers Set (5pc)', price: 3499, category: 'Hand Tools', brand: 'Klein Tools' },
      { name: 'Level 24"', price: 1999, category: 'Hand Tools', brand: 'Empire' },
      { name: 'Cordless Drill 20V', price: 9999, category: 'Power Tools', brand: 'DeWalt' },
      { name: 'Circular Saw 7-1/4"', price: 12999, category: 'Power Tools', brand: 'Milwaukee' },
      { name: 'Orbital Sander', price: 5999, category: 'Power Tools', brand: 'Makita' },
      { name: 'Jigsaw Variable Speed', price: 7999, category: 'Power Tools', brand: 'Bosch' },
      { name: 'Wood Screws Assorted (500pc)', price: 1999, category: 'Fasteners & Hardware', brand: 'Hillman' },
      { name: 'Nails Finishing (1lb)', price: 799, category: 'Fasteners & Hardware', brand: 'Grip-Rite' },
      { name: 'Anchor Kit Wall (100pc)', price: 1499, category: 'Fasteners & Hardware', brand: 'Toggler' },
      { name: 'Interior Paint 1 Gallon', price: 3999, category: 'Paint & Supplies', brand: 'Behr' },
      { name: 'Paint Roller Kit (9pc)', price: 1999, category: 'Paint & Supplies', brand: 'Purdy' },
      { name: 'Painter\'s Tape 1.88" x 60yd', price: 799, category: 'Paint & Supplies', brand: 'ScotchBlue' },
      { name: 'LED Light Bulbs (8 pk)', price: 1999, category: 'Electrical', brand: 'GE' },
      { name: 'Extension Cord 50ft', price: 2499, category: 'Electrical', brand: 'Woods' },
      { name: 'Outlet Covers (10 pk)', price: 599, category: 'Electrical', brand: 'Leviton' },
    ],
  },
  
  furniture: {
    name: 'Furniture',
    categories: [
      { name: 'Living Room', slug: 'living-room', searchTerm: 'living room sofa couch coffee table' },
      { name: 'Bedroom', slug: 'bedroom', searchTerm: 'bedroom bed frame dresser nightstand' },
      { name: 'Office Furniture', slug: 'office-furniture', searchTerm: 'office desk chair bookshelf' },
      { name: 'Outdoor Furniture', slug: 'outdoor-furniture', searchTerm: 'outdoor furniture patio chairs table' },
      { name: 'Storage Furniture', slug: 'storage-furniture', searchTerm: 'storage shelves cabinets organizers' },
    ],
    products: [
      { name: 'Sofa 3-Seater Gray', price: 59999, category: 'Living Room', brand: 'IKEA' },
      { name: 'Coffee Table Wood', price: 19999, category: 'Living Room', brand: 'West Elm' },
      { name: 'TV Stand 65"', price: 24999, category: 'Living Room', brand: 'Walker Edison' },
      { name: 'Accent Chair Velvet', price: 29999, category: 'Living Room', brand: 'Wayfair' },
      { name: 'Area Rug 8x10', price: 19999, category: 'Living Room', brand: 'Safavieh' },
      { name: 'Queen Bed Frame Wood', price: 39999, category: 'Bedroom', brand: 'Zinus' },
      { name: 'Dresser 6-Drawer', price: 34999, category: 'Bedroom', brand: 'IKEA' },
      { name: 'Nightstand with Drawer', price: 12999, category: 'Bedroom', brand: 'Target' },
      { name: 'Mattress Queen Memory Foam', price: 49999, category: 'Bedroom', brand: 'Casper' },
      { name: 'Office Desk 48"', price: 19999, category: 'Office Furniture', brand: 'Bush Furniture' },
      { name: 'Ergonomic Office Chair', price: 29999, category: 'Office Furniture', brand: 'Herman Miller' },
      { name: 'Bookshelf 5-Tier', price: 8999, category: 'Office Furniture', brand: 'VASAGLE' },
      { name: 'Filing Cabinet 3-Drawer', price: 14999, category: 'Office Furniture', brand: 'HON' },
      { name: 'Patio Dining Set (5pc)', price: 49999, category: 'Outdoor Furniture', brand: 'Hampton Bay' },
      { name: 'Outdoor Lounge Chair', price: 19999, category: 'Outdoor Furniture', brand: 'Christopher Knight' },
      { name: 'Patio Umbrella 9ft', price: 7999, category: 'Outdoor Furniture', brand: 'California Umbrella' },
      { name: 'Cube Storage Organizer (9 cube)', price: 6999, category: 'Storage Furniture', brand: 'ClosetMaid' },
      { name: 'Shoe Rack 4-Tier', price: 2999, category: 'Storage Furniture', brand: 'Simple Houseware' },
    ],
  },
  
  restaurant: {
    name: 'Restaurant',
    categories: [
      { name: 'Appetizers', slug: 'appetizers', searchTerm: 'appetizers starters small plates' },
      { name: 'Main Courses', slug: 'main-courses', searchTerm: 'entrees main courses dinner' },
      { name: 'Sides', slug: 'sides', searchTerm: 'side dishes accompaniments' },
      { name: 'Beverages', slug: 'beverages', searchTerm: 'drinks beverages cocktails' },
    ],
    products: [
      { name: 'Mozzarella Sticks (6pc)', price: 899, category: 'Appetizers', brand: 'House Made' },
      { name: 'Buffalo Wings (10pc)', price: 1299, category: 'Appetizers', brand: 'House Made' },
      { name: 'Loaded Nachos', price: 1099, category: 'Appetizers', brand: 'House Made' },
      { name: 'Soup of the Day (Bowl)', price: 599, category: 'Appetizers', brand: 'House Made' },
      { name: 'Caesar Salad', price: 899, category: 'Appetizers', brand: 'House Made' },
      { name: 'Grilled Chicken Breast', price: 1599, category: 'Main Courses', brand: 'House Made' },
      { name: 'NY Strip Steak 12oz', price: 2999, category: 'Main Courses', brand: 'House Made' },
      { name: 'Grilled Salmon', price: 2199, category: 'Main Courses', brand: 'House Made' },
      { name: 'Pasta Primavera', price: 1499, category: 'Main Courses', brand: 'House Made' },
      { name: 'Classic Cheeseburger', price: 1399, category: 'Main Courses', brand: 'House Made' },
      { name: 'Fish & Chips', price: 1699, category: 'Main Courses', brand: 'House Made' },
      { name: 'French Fries', price: 499, category: 'Sides', brand: 'House Made' },
      { name: 'Mashed Potatoes', price: 499, category: 'Sides', brand: 'House Made' },
      { name: 'Seasonal Vegetables', price: 549, category: 'Sides', brand: 'House Made' },
      { name: 'Coleslaw', price: 399, category: 'Sides', brand: 'House Made' },
      { name: 'Soft Drink', price: 299, category: 'Beverages', brand: 'Coca-Cola' },
      { name: 'Iced Tea', price: 299, category: 'Beverages', brand: 'House Made' },
      { name: 'Coffee', price: 299, category: 'Beverages', brand: 'House Made' },
      { name: 'Draft Beer', price: 599, category: 'Beverages', brand: 'Local Brewery' },
      { name: 'House Wine (Glass)', price: 799, category: 'Beverages', brand: 'House Selection' },
    ],
  },
};

export type QuickStartScenario = keyof typeof SCENARIOS;

export interface QuickStartOptions {
  tenant_id: string;
  scenario: QuickStartScenario;
  productCount: number;
  assignCategories?: boolean;
  createAsDrafts?: boolean;
  generateImages?: boolean; // NEW: Generate AI images for products
  imageQuality?: 'standard' | 'hd'; // NEW: Image quality
  textModel?: 'openai' | 'google'; // NEW: AI model for text/product generation
  imageModel?: 'openai' | 'google'; // NEW: AI model for image generation
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
  options: QuickStartOptions,
  prismaClient: any
): Promise<QuickStartResult> {
  const {
    tenant_id,
    scenario,
    productCount,
    assignCategories = true,
    createAsDrafts = true,
    generateImages = false,
    imageQuality = 'standard',
    textModel = 'openai',
    imageModel = 'openai',
  } = options;

  // Validate tenant exists
  const tenant = await prismaClient.tenants.findUnique({ where: { id: tenant_id } });
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenant_id}`);
  }

  // Use fallback scenario data if not in SCENARIOS (for new business types)
  const scenarioData = SCENARIOS[scenario] || SCENARIOS.general;
  const timestamp = Date.now();

  // Create categories with live Google taxonomy alignment and persist to database
  const categories: Array<{ id: string; name: string; slug: string; originalName: string }> = [];
  
  if (assignCategories) {
    for (const cat of scenarioData.categories) {
      // Use live Google taxonomy to find best matching category
      const suggestions = suggestCategories(cat.searchTerm, 1);
      const googleCategoryId = suggestions.length > 0 ? suggestions[0].id : null;
      
      // Log the mapping for transparency
      if (googleCategoryId) {
        const googleCat = getCategoryById(googleCategoryId);
        console.log(`[Quick Start] Mapped "${cat.name}" to Google category: ${googleCat?.path.join(' > ')} (ID: ${googleCategoryId})`);
      } else {
        console.warn(`[Quick Start] No Google category found for "${cat.name}" (search: ${cat.searchTerm})`);
      }
      
      const categoryId = `${tenant_id}_${cat.slug}`;
      
      // Persist category to database (upsert to avoid duplicates)
      await prismaClient.directory_category.upsert({
        where: { id: categoryId },
        create: {
          id: categoryId,
          tenantId: tenant_id,
          name: cat.name,
          slug: cat.slug,
          googleCategoryId: googleCategoryId,  
          sortOrder: categories.length, 
          isActive: true,
          updatedAt: new Date(),
        },
        update: {
          name: cat.name,
          googleCategoryId: googleCategoryId,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      
      categories.push({
        id: categoryId,
        name: cat.name,
        slug: cat.slug,
        originalName: cat.name,
      });
    }
  }

  // Generate products using intelligent cache + AI system
  const allProducts = [];
  
  if (categories.length > 0) {
    // NEW: Use ProductCacheService for intelligent product generation
    console.log(`[Quick Start] Using intelligent product cache for ${categories.length} categories`);
    
    const productsPerCategory = Math.ceil(productCount / categories.length);
    
    for (const category of categories) {
      try {
        const products = await productCacheService.getProductsForScenario({
          businessType: scenario,
          categoryName: category.name,
          googleCategoryId: category.id,
          count: productsPerCategory,
          requireImages: generateImages, // NEW: Request products with images if photos enabled
          textModel, // NEW: Pass user-selected AI model for text generation
        });
        
        // Convert to quick-start format and assign category
        for (const product of products) {
          allProducts.push({
            name: product.name,
            price: product.price,
            brand: product.brand || 'Generic',
            category: category.originalName || category.name,
            description: product.description,
            // Include photo data from cache if available
            imageUrl: product.imageUrl,
            thumbnailUrl: product.thumbnailUrl,
            imageWidth: product.imageWidth,
            imageHeight: product.imageHeight,
            imageBytes: product.imageBytes,
            // Include enriched AI content from cache if available
            enhancedDescription: product.enhancedDescription,
            features: product.features,
            specifications: product.specifications,
          });
        }
      } catch (error: any) {
        console.error(`[Quick Start] Failed to generate products for ${category.name}:`, error.message);
      }
    }
    
    // Trim to exact count if we generated too many
    if (allProducts.length > productCount) {
      allProducts.splice(productCount);
    }
  } else {
    // FALLBACK: Use old hardcoded method if no categories
    console.log(`[Quick Start] No categories available, using fallback products`);
    const baseProducts = scenarioData.products;
    const variantSuffixes = ['', 'Deluxe', 'Premium', 'Pro', 'Plus', 'XL', 'Mini', 'Classic', 'Special Edition', 'Limited'];
    
    for (let i = 0; i < productCount; i++) {
      const baseProduct = baseProducts[i % baseProducts.length];
      const cycleCount = Math.floor(i / baseProducts.length);
      
      let productName = baseProduct.name;
      if (cycleCount > 0) {
        const suffixIndex = cycleCount % variantSuffixes.length;
        const suffix = variantSuffixes[suffixIndex];
        productName = suffix ? `${baseProduct.name} ${suffix}` : `${baseProduct.name} v${cycleCount + 1}`;
      }
      
      allProducts.push({
        ...baseProduct,
        name: productName,
      });
    }
  }

  // Get existing products to handle duplicates intelligently
  const existingProducts = await prismaClient.inventory_items.findMany({
    where: { tenant_id: tenant_id },
    select: { id: true, name: true, image_url: true },
  });
  const existingNames = new Set(existingProducts.map((p: { name: string }) => p.name));
  const existingProductsMap = new Map(
    existingProducts.map((p: { id: string; name: string; image_url: string | null }) => [p.name, p])
  );
  
  // Create products in batches
  const batchSize = 100;
  let createdCount = 0;
  let skippedCount = 0;
  let globalIndex = 0; // Track global index for unique SKUs

  for (let i = 0; i < allProducts.length; i += batchSize) {
    const batch = allProducts.slice(i, i + batchSize);
    const items = [];
    
    for (let idx = 0; idx < batch.length; idx++) {
      const product = batch[idx];
      
      // Smart duplicate handling
      const existingProduct = existingProductsMap.get(product.name) as { id: string; name: string; image_url: string | null } | undefined;
      if (existingProduct) {
        // If new product has photo but existing doesn't, update existing instead of skipping
        const newHasPhoto = !!(product as any).imageUrl;
        const existingHasPhoto = !!existingProduct.image_url;
        
        if (newHasPhoto && !existingHasPhoto && generateImages) {
          console.log(`[Quick Start] Will upgrade existing product with photo: ${product.name}`);
          // Mark for photo upgrade instead of creating new item
          (product as any)._existingProductId = existingProduct.id;
          (product as any)._isUpgrade = true;
          // Don't create new item, just track for photo generation
          continue;
        } else {
          console.log(`[Quick Start] Skipping duplicate product: ${product.name}`);
          skippedCount++;
          continue;
        }
      }
      
      const availability = Math.random() > 0.25 ? 'in_stock' as const : 'out_of_stock' as const;
      const stock = availability === 'in_stock' ? Math.floor(Math.random() * 96) + 5 : 0;

      // Assign category if enabled
      let categoryAssignment: { directory_category_id?: string; category_path?: string[] } = {};
      if (assignCategories && categories.length > 0) {
        const matchingCat = categories.find((c) => c.originalName === product.category);
        const selectedCat = matchingCat || categories[Math.floor(Math.random() * categories.length)];
        categoryAssignment = {
          directory_category_id: selectedCat.id,
          category_path: [selectedCat.slug],
        };
        console.log(`[Quick Start] Assigning category to "${product.name}": ${selectedCat.name} (ID: ${selectedCat.id})${matchingCat ? '' : ' [random fallback]'}`);
      } else {
        console.log(`[Quick Start] Category assignment skipped for "${product.name}": assignCategories=${assignCategories}, categories.length=${categories.length}`);
      }

      // Determine item status (map "draft" semantics to inactive in new enum)
      const itemStatus = createAsDrafts
        ? 'inactive' as const
        : (Math.random() > 0.25 ? 'active' as const : 'inactive' as const);

      const itemId = generateItemId();
      
      // Build metadata with enriched AI content (following scanner enrichment pattern)
      const metadata: any = {};
      const enrichedProduct = product as any;
      if (enrichedProduct.enhancedDescription) metadata.enhancedDescription = enrichedProduct.enhancedDescription;
      if (enrichedProduct.features && enrichedProduct.features.length > 0) metadata.features = enrichedProduct.features;
      if (enrichedProduct.specifications && Object.keys(enrichedProduct.specifications).length > 0) metadata.specifications = enrichedProduct.specifications;
      
      const itemData = {
        id: itemId,
        tenant_id: tenant_id,
        sku: generateQuickStartSku(timestamp + globalIndex), // Use timestamp + global index for unique SKUs
        name: product.name,
        title: product.name,
        brand: product.brand || 'Generic',
        description: product.description || null,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
        price_cents: Math.round(Number(product.price)), // Ensure integer
        price: Number(product.price) / 100, // Ensure decimal
        currency: 'USD',
        stock: Math.max(0, Math.round(stock)), // Ensure non-negative integer
        availability,
        item_status: itemStatus,
        updated_at: new Date(),
        // Attach cached photo if available
        image_url: (product as any).imageUrl || null,
        // Enrichment tracking (following scanner enrichment pattern)
        source: 'MANUAL' as const,
        enrichment_status: 'COMPLETE' as const,
        enriched_at: new Date(),
        enriched_by: 'ai_quick_start',
        missing_images: !(product as any).imageUrl,
        missing_description: !product.description,
        missing_specs: !enrichedProduct.specifications || Object.keys(enrichedProduct.specifications).length === 0,
        missing_brand: !product.brand,
        ...categoryAssignment,
      };
      
      // Store category name for photo cache updates
      (itemData as any)._categoryName = product.category;
      
      items.push(itemData);
      
      // Add to existing names set to prevent duplicates within this batch
      existingNames.add(product.name);
      globalIndex++; // Increment for next product
    }

    if (items.length > 0) {
      // Create items individually to avoid transaction issues
      const createdItems: any[] = [];
      
      for (const item of items) {
        try {
          // Remove temporary tracking fields before creating
          const { _categoryName, ...rawItemData } = item as any;
          
          // Use the same validation and transformation as the regular items API
          const parsed = createItemSchema.safeParse(rawItemData);
          if (!parsed.success) {
            console.error('[Quick Start] Validation failed for item:', rawItemData.name, parsed.error.flatten());
            throw new Error(`Validation failed for item ${rawItemData.name}: ${JSON.stringify(parsed.error.flatten())}`);
          }
          
          // Apply the same transformations as the regular API
          const data = {
            ...parsed.data,
            title: parsed.data.title || parsed.data.name,
            brand: parsed.data.brand || 'Unknown',
            // Price logic: prioritize price (dollars) over price_cents (cents)
            price: parsed.data.price ?? (parsed.data.price_cents ? parsed.data.price_cents / 100 : 0),
            price_cents: parsed.data.price_cents ?? (parsed.data.price ? Math.round(parsed.data.price * 100) : 0),
            currency: parsed.data.currency || 'USD',
            // Auto-set availability based on stock if not explicitly provided
            availability: parsed.data.availability || (parsed.data.stock > 0 ? 'in_stock' : 'out_of_stock'),
            tenant_id: parsed.data.tenant_id || '', // Ensure tenant_id is always a string
            // Category assignment - CRITICAL: preserve directory_category_id from parsed data
            directory_category_id: parsed.data.directory_category_id || null,
            category_path: parsed.data.category_path || [],
          };
          
          // Log category assignment for debugging
          if (data.directory_category_id) {
            console.log(`[Quick Start] Creating item "${data.name}" with category ID: ${data.directory_category_id}, category_path: ${JSON.stringify(data.category_path)}`);
          }
          
          // Keep category_path for storefront filtering (it uses category_path array, not directory_category_id)
          const cleanData = data;
          
          const created = await prismaClient.inventory_items.create({ 
            data: {
              id: generateItemId(),
              ...cleanData,
              updated_at: new Date(),
            }
          });
          
          // If item has a cached photo, also create a photo_assets record for proper gallery management
          if (created.image_url) {
            try {
              const photoId = generateQuickStart("pha");
              await prismaClient.photo_assets.create({
                data: {
                  id: photoId,
                  tenantId: tenant_id,
                  inventoryItemId: created.id,
                  url: created.image_url,
                  position: 0,
                  exifRemoved: false,
                },
              });
              console.log(`[Quick Start] ✓ Created photo_assets record for cached photo: ${created.name}`);
            } catch (photoError: any) {
              console.error(`[Quick Start] Failed to create photo_assets for ${created.name}:`, photoError.message);
            }
          }
          
          // Add back the tracking field for photo generation
          (created as any)._categoryName = _categoryName;
          createdItems.push(created);
          createdCount++;
        } catch (error: any) {
          if (error.code === 'P2002') {
            // Duplicate SKU - skip
            console.log(`[Quick Start] Skipping duplicate SKU: ${item.sku}`);
            skippedCount++;
          } else {
            throw error;
          }
        }
      }
      
      // Handle photo upgrades for existing products
      if (generateImages) {
        const upgradeProducts = batch.filter(p => (p as any)._isUpgrade);
        if (upgradeProducts.length > 0) {
          console.log(`[Quick Start] Found ${upgradeProducts.length} existing products to upgrade with photos`);
          for (const product of upgradeProducts) {
            createdItems.push({
              id: (product as any)._existingProductId,
              name: product.name,
              tenant_id: tenant_id,
              image_url: null, // Will be updated after photo generation
              _categoryName: product.category,
              _isUpgrade: true,
            });
          }
        }
      }
      
      // Generate images if requested (only for items without cached photos)
      if (generateImages && createdItems.length > 0) {
        const itemsNeedingPhotos = createdItems.filter(item => !item.image_url);
        
        if (itemsNeedingPhotos.length > 0) {
          console.log(`[Quick Start] Generating ${itemsNeedingPhotos.length} product images...`);
          const { aiImageService } = await import('../services/AIImageService');
          
          let imagesGenerated = 0;
          let imagesFailed = 0;
          
          for (const item of itemsNeedingPhotos) {
            try {
              const image = await aiImageService.generateProductImage(
                item.name,
                item.tenant_id,
                item.id,
                imageModel, // Use selected AI model
                imageQuality
              );
              
              if (image) {
                console.log(`[Quick Start] Image generated, updating item ${item.id} with URL: ${image.url}`);
                
                try {
                  // Update inventory item with image URL
                  const updated = await prismaClient.inventory_items.update({
                    where: { id: item.id },
                    data: { image_url: image.url },
                    select: { id: true, name: true, image_url: true }
                  });
                  
                  // Also create a photo_assets record for proper gallery management
                  const photoId = generateQuickStart("pha");
                  await prismaClient.photo_assets.create({
                    data: {
                      id: photoId,
                      tenantId: tenant_id,
                      inventoryItemId: item.id,
                      url: image.url,
                      width: image.width || null,
                      height: image.height || null,
                      bytes: image.bytes || null,
                      contentType: 'image/png',
                      position: 0,
                      exifRemoved: false,
                    },
                  });
                  
                  console.log(`[Quick Start] ✓ Item updated with image_url and photo_assets record:`, updated);
                  
                  const upgradeMsg = (item as any)._isUpgrade ? ' (upgraded existing)' : '';
                  
                  // Save to cache for future reuse
                  await productCacheService.updateCacheWithPhoto(
                    scenario,
                    item.name,
                    {
                      imageUrl: image.url,
                      thumbnailUrl: image.thumbnailUrl,
                      imageWidth: image.width,
                      imageHeight: image.height,
                      imageBytes: image.bytes,
                      imageQuality: imageQuality,
                    },
                    (item as any)._categoryName // Pass category for accurate cache matching
                  );
                  
                  console.log(`[Quick Start] ✓ Image generated and attached for: ${item.name}${upgradeMsg}`);
                  imagesGenerated++;
                } catch (updateError: any) {
                  console.error(`[Quick Start] Failed to update item ${item.id} with image_url:`, updateError);
                  imagesFailed++;
                }
              } else {
                console.log(`[Quick Start] ✗ Image generation failed for: ${item.name}`);
                imagesFailed++;
              }
            } catch (error: any) {
              console.error(`[Quick Start] Image generation error for "${item.name}":`, error.message);
              imagesFailed++;
            }
          }
          
          const upgradeCount = itemsNeedingPhotos.filter(i => (i as any)._isUpgrade).length;
          const newCount = imagesGenerated - upgradeCount;
          console.log(`[Quick Start] Images: ${imagesGenerated} generated (${newCount} new, ${upgradeCount} upgrades), ${imagesFailed} failed`);
        } else {
          console.log(`[Quick Start] All ${createdItems.length} items already have cached photos`);
        }
      }
    }
  }
  
  if (skippedCount > 0) {
    console.log(`[Quick Start] Skipped ${skippedCount} duplicate products`);
  }

  // Refresh materialized view for storefront to show new products/categories
  try {
    console.log(`[Quick Start] Refreshing storefront materialized view...`);
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();
    await pool.query('REFRESH MATERIALIZED VIEW storefront_category_counts');
    console.log(`[Quick Start] ✓ Storefront materialized view refreshed`);
  } catch (mvError: any) {
    console.warn(`[Quick Start] Failed to refresh materialized view (non-critical):`, mvError.message);
  }

  // Get final counts
  const totalProducts = await prismaClient.inventory_items.count({
    where: { tenant_id: tenant_id }, 
  });

  const activeProducts = await prismaClient.inventory_items.count({
    where: { tenant_id: tenant_id, item_status: 'active' }, 
  });

  const inStockProducts = await prismaClient.inventory_items.count({
    where: { tenant_id: tenant_id, availability: 'in_stock' }, 
  });

  const categorizedProducts = await prismaClient.inventory_items.count({
    where: { tenant_id: tenant_id, category_path: { isEmpty: false } }, 
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
