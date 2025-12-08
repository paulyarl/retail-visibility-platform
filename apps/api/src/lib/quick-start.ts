/**
 * Quick Start Product Generator
 * 
 * Provides reusable functions for generating starter products for new tenants.
 * Used by both CLI seeding script and Quick Start API endpoint.
 */

import { generateItemId, generateQuickStartSku } from './id-generator';
import { suggestCategories, getCategoryById } from './google/taxonomy';
import { productCacheService } from '../services/ProductCacheService';

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
        price_cents: product.price,
        price: product.price / 100,
        currency: 'USD',
        stock,
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
          const { _categoryName, ...itemData } = item as any;
          const created = await prismaClient.inventory_items.create({ data: itemData });
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
                'openai', // Use DALL-E for now
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
                  
                  console.log(`[Quick Start] ✓ Item updated with image_url:`, updated);
                  
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
