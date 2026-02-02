/**
 * Product Display Utilities
 * Functions to transform inventory data into standardized ProductDisplay format
 */

import { ProductDisplay, FeaturedType, Category } from '@/types/product-display';

// ====================
// DATA TRANSFORMATION
// ====================

/**
 * Transform inventory item data to ProductDisplay format
 * Ensures all required fields are present and properly formatted
 */
export function transformInventoryToProductDisplay(
  inventoryItem: any,
  options: {
    featuredType?: FeaturedType;
    category?: Category;
    includeRichFields?: boolean;
  } = {}
): ProductDisplay {
  const { featuredType, category, includeRichFields = true } = options;

  // Validate required fields
  if (!inventoryItem.name) {
    throw new Error('Inventory item must have a name');
  }

  if (typeof inventoryItem.stock !== 'number') {
    throw new Error('Inventory item must have stock as a number');
  }

  if (!inventoryItem.sku) {
    throw new Error('Inventory item must have a SKU');
  }

  if (!inventoryItem.price_cents) {
    throw new Error('Inventory item must have price_cents');
  }

  // Format price
  const price = {
    cents: inventoryItem.price_cents,
    currency: inventoryItem.currency || 'USD',
    formatted: formatPrice({
      cents: inventoryItem.price_cents,
      currency: inventoryItem.currency || 'USD'
    })
  };

  // Build base product display
  const productDisplay: ProductDisplay = {
    // Required fields
    name: inventoryItem.name,
    stock: inventoryItem.stock,
    sku: inventoryItem.sku,
    price,
    
    // Required but optional fields
    featuredType: featuredType || inventoryItem.featured_type || null,
    category: category || null,
    
    // Rich fields (if requested)
    ...(includeRichFields && {
      description: inventoryItem.description,
      imageUrl: inventoryItem.image_url || inventoryItem.imageUrl,
      brand: inventoryItem.brand,
      weight: inventoryItem.weight,
      dimensions: inventoryItem.dimensions,
      tags: inventoryItem.tags || [],
      createdAt: inventoryItem.created_at,
      updatedAt: inventoryItem.updated_at
    })
  };

  return productDisplay;
}

/**
 * Transform multiple inventory items to ProductDisplay format
 */
export function transformInventoryListToProductDisplays(
  inventoryItems: any[],
  options: {
    featuredTypeMap?: Record<string, FeaturedType>;
    categoryMap?: Record<string, Category>;
    includeRichFields?: boolean;
  } = {}
): ProductDisplay[] {
  const { featuredTypeMap = {}, categoryMap = {}, includeRichFields = true } = options;

  return inventoryItems.map((item) => {
    return transformInventoryToProductDisplay(item, {
      featuredType: featuredTypeMap[item.id],
      category: categoryMap[item.category_id],
      includeRichFields
    });
  });
}

// ====================
// FEATURED TYPE HELPERS
// ====================

/**
 * Extract featured type from inventory metadata
 */
export function extractFeaturedTypeFromMetadata(metadata: any): FeaturedType | null {
  if (!metadata) return null;

  // Check various possible metadata fields
  const featuredType = metadata.featured_type || 
                      metadata.featuredType || 
                      metadata.featured ||
                      metadata.type;

  if (!featuredType) return null;

  // Validate it's a known featured type
  const validTypes: FeaturedType[] = [
    'new_arrival', 'seasonal', 'sale', 'staff_pick', 
    'clearance', 'featured', 'trending'
  ];

  return validTypes.includes(featuredType as FeaturedType) 
    ? featuredType as FeaturedType 
    : null;
}

/**
 * Build featured type map from featured products data
 */
export function buildFeaturedTypeMap(
  featuredProducts: any[]
): Record<string, FeaturedType> {
  const map: Record<string, FeaturedType> = {};

  featuredProducts.forEach((fp) => {
    if (fp.inventory_item_id && fp.featured_type) {
      map[fp.inventory_item_id] = fp.featured_type;
    }
  });

  return map;
}

// ====================
// CATEGORY HELPERS
// ====================

/**
 * Transform category data to Category interface
 */
export function transformCategory(categoryData: any): Category {
  return {
    id: categoryData.id,
    name: categoryData.name,
    slug: categoryData.slug || categoryData.name.toLowerCase().replace(/\s+/g, '-'),
    icon: categoryData.icon,
    color: categoryData.color,
    parentId: categoryData.parent_id
  };
}

/**
 * Build category map from categories data
 */
export function buildCategoryMap(categories: any[]): Record<string, Category> {
  const map: Record<string, Category> = {};

  categories.forEach((category) => {
    map[category.id] = transformCategory(category);
  });

  return map;
}

// ====================
// PRICE FORMATTING
// ====================

/**
 * Format price with currency
 */
export function formatPrice(price: { cents: number; currency: string }): string {
  const { cents, currency } = price;
  
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(cents / 100);
  } catch (error) {
    // Fallback formatting
    return `${currency || '$'}${(cents / 100).toFixed(2)}`;
  }
}

// ====================
// VALIDATION HELPERS
// ====================

/**
 * Validate that all required fields are present in inventory data
 */
export function validateInventoryForDisplay(inventoryItem: any): {
  isValid: boolean;
  missingFields: string[];
  errors: string[];
} {
  const requiredFields = ['name', 'stock', 'sku', 'price_cents'];
  const missingFields: string[] = [];
  const errors: string[] = [];

  // Check required fields
  requiredFields.forEach((field) => {
    if (!inventoryItem[field]) {
      missingFields.push(field);
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Validate field types
  if (inventoryItem.name && typeof inventoryItem.name !== 'string') {
    errors.push('Name must be a string');
  }

  if (inventoryItem.stock !== undefined && typeof inventoryItem.stock !== 'number') {
    errors.push('Stock must be a number');
  }

  if (inventoryItem.sku && typeof inventoryItem.sku !== 'string') {
    errors.push('SKU must be a string');
  }

  if (inventoryItem.price_cents !== undefined && typeof inventoryItem.price_cents !== 'number') {
    errors.push('Price cents must be a number');
  }

  return {
    isValid: missingFields.length === 0 && errors.length === 0,
    missingFields,
    errors
  };
}

/**
 * Generate mock product data for testing
 */
export function generateMockProductDisplay(overrides: Partial<ProductDisplay> = {}): ProductDisplay {
  const mockProduct: ProductDisplay = {
    name: 'Sample Product',
    stock: 100,
    sku: 'SAMPLE-001',
    price: {
      cents: 1999,
      currency: 'USD',
      formatted: '$19.99'
    },
    featuredType: undefined,
    category: undefined,
    description: 'This is a sample product for testing purposes.',
    imageUrl: undefined,
    brand: 'Sample Brand',
    weight: 500,
    dimensions: {
      length: 10,
      width: 8,
      height: 5
    },
    tags: ['sample', 'test', 'demo'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return { ...mockProduct, ...overrides };
}

/**
 * Generate multiple mock products
 */
export function generateMockProductDisplays(count: number): ProductDisplay[] {
  const products: ProductDisplay[] = [];
  
  for (let i = 0; i < count; i++) {
    products.push(generateMockProductDisplay({
      name: `Sample Product ${i + 1}`,
      sku: `SAMPLE-${String(i + 1).padStart(3, '0')}`,
      price: {
        cents: Math.floor(Math.random() * 50000) + 1000,
        currency: 'USD',
        formatted: `$${((Math.floor(Math.random() * 50000) + 1000) / 100).toFixed(2)}`
      },
      stock: Math.floor(Math.random() * 200),
      featuredType: i % 3 === 0 ? 'featured' : null
    }));
  }

  return products;
}

// ====================
// DISPLAY CONFIGURATION
// ====================

/**
 * Default display configuration for different contexts
 */
export const PRODUCT_DISPLAY_CONFIGS = {
  // Shop directory - compact cards
  shopDirectory: {
    variant: 'card' as const,
    showStock: true,
    showSKU: false,
    showFeaturedType: true,
    showCategory: true
  },

  // Featured products - enhanced display
  featuredProducts: {
    variant: 'featured' as const,
    showStock: true,
    showSKU: true,
    showFeaturedType: true,
    showCategory: true
  },

  // Product list - table-like view
  productList: {
    variant: 'list' as const,
    showStock: true,
    showSKU: true,
    showFeaturedType: true,
    showCategory: true
  },

  // Search results - compact view
  searchResults: {
    variant: 'compact' as const,
    showStock: false,
    showSKU: false,
    showFeaturedType: true,
    showCategory: false
  },

  // Product detail - full view
  productDetail: {
    variant: 'detail' as const,
    showStock: true,
    showSKU: true,
    showFeaturedType: true,
    showCategory: true
  }
};

/**
 * Get display configuration for a specific context
 */
export function getDisplayConfig(context: keyof typeof PRODUCT_DISPLAY_CONFIGS) {
  return PRODUCT_DISPLAY_CONFIGS[context];
}
