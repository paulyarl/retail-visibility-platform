/**
 * Variant Transformation Utilities
 * 
 * Transforms raw variant data from storefront_variants_mv into computed fields
 * for frontend consumption.
 */

export interface VariantAttributes {
  [key: string]: string[];
}

export interface PriceRange {
  min_cents: number;
  max_cents: number;
  currency?: string;
}

export interface ComputedVariantFields {
  has_variants: boolean;
  variant_count: number;
  price_range?: PriceRange;
  available_attributes?: VariantAttributes;
}

export interface ProductWithVariants {
  inventory_item_id: string;
  product_type?: string;
  parent_item_id?: string;
  variant_attributes?: any;
  variant_name?: string;
  variant_sort_order?: number;
  variant_is_active?: boolean;
  variant_group?: string;
  parent_product?: string;
  price_cents?: number;
  current_price_cents?: number;
  currency?: string;
  [key: string]: any;
}

/**
 * Parse variant attributes from JSON string or object
 */
function parseVariantAttributes(attributes: any): Record<string, string> | null {
  if (!attributes) return null;
  
  if (typeof attributes === 'string') {
    try {
      return JSON.parse(attributes);
    } catch {
      return null;
    }
  }
  
  if (typeof attributes === 'object') {
    return attributes;
  }
  
  return null;
}

/**
 * Extract available attribute options from a group of variants
 */
function extractAvailableAttributes(variants: ProductWithVariants[]): VariantAttributes {
  const attributeMap: VariantAttributes = {};
  
  for (const variant of variants) {
    const attrs = parseVariantAttributes(variant.variant_attributes);
    if (!attrs) continue;
    
    for (const [key, value] of Object.entries(attrs)) {
      if (!attributeMap[key]) {
        attributeMap[key] = [];
      }
      
      const stringValue = String(value);
      if (!attributeMap[key].includes(stringValue)) {
        attributeMap[key].push(stringValue);
      }
    }
  }
  
  // Sort attribute values for consistency
  for (const key in attributeMap) {
    attributeMap[key].sort();
  }
  
  return attributeMap;
}

/**
 * Calculate price range from a group of variants
 */
function calculatePriceRange(variants: ProductWithVariants[]): PriceRange | null {
  const prices = variants
    .map(v => v.current_price_cents || v.price_cents)
    .filter((p): p is number => typeof p === 'number' && p > 0);
  
  if (prices.length === 0) return null;
  
  const min_cents = Math.min(...prices);
  const max_cents = Math.max(...prices);
  const currency = variants.find(v => v.currency)?.currency || 'USD';
  
  return { min_cents, max_cents, currency };
}

/**
 * Transform a single product with its variant data
 */
export function transformProductWithVariants(
  product: ProductWithVariants,
  allProducts: ProductWithVariants[]
): ProductWithVariants & ComputedVariantFields {
  // Check if this is a parent product (has variants)
  const isParent = product.product_type === 'parent';
  
  if (!isParent) {
    // This is a standalone product or a variant itself
    return {
      ...product,
      has_variants: false,
      variant_count: 0,
    };
  }
  
  // Find all variants for this parent product
  const variants = allProducts.filter(
    p => p.parent_item_id === product.inventory_item_id && p.variant_is_active !== false
  );
  
  const variant_count = variants.length;
  const has_variants = variant_count > 0;
  
  // Calculate computed fields
  const price_range = calculatePriceRange(variants);
  const available_attributes = extractAvailableAttributes(variants);
  
  return {
    ...product,
    has_variants,
    variant_count,
    price_range: price_range || undefined,
    available_attributes: Object.keys(available_attributes).length > 0 ? available_attributes : undefined,
  };
}

/**
 * Convert BigInt values to numbers for JSON serialization
 */
function convertBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigInts(value);
    }
    return converted;
  }
  
  return obj;
}

/**
 * Transform an array of products with variant data
 * Groups products by parent and computes variant fields
 */
export function transformProductsWithVariants(
  products: ProductWithVariants[]
): (ProductWithVariants & ComputedVariantFields)[] {
  // Create a map for quick lookups
  const productMap = new Map<string, ProductWithVariants>();
  products.forEach(p => productMap.set(p.inventory_item_id, p));
  
  // Transform each product and convert BigInts
  return products.map(product => {
    const transformed = transformProductWithVariants(product, products);
    return convertBigInts(transformed);
  });
}

/**
 * Group products by parent and return only parent products with computed variant data
 * Useful for product listing pages where we want to show parent products with variant info
 */
export function groupProductsByParent(
  products: ProductWithVariants[]
): (ProductWithVariants & ComputedVariantFields)[] {
  // Separate parents and variants
  const parents = products.filter(p => p.product_type === 'parent');
  const standalones = products.filter(p => !p.product_type || p.product_type === 'standalone');
  const variants = products.filter(p => p.product_type === 'variant');
  
  // Transform parents with their variant data
  const transformedParents = parents.map(parent => {
    const parentVariants = variants.filter(
      v => v.parent_item_id === parent.inventory_item_id && v.variant_is_active !== false
    );
    
    const variant_count = parentVariants.length;
    const price_range = calculatePriceRange(parentVariants);
    const available_attributes = extractAvailableAttributes(parentVariants);
    
    return {
      ...parent,
      has_variants: variant_count > 0,
      variant_count,
      price_range: price_range || undefined,
      available_attributes: Object.keys(available_attributes).length > 0 ? available_attributes : undefined,
    };
  });
  
  // Transform standalone products
  const transformedStandalones = standalones.map(product => ({
    ...product,
    has_variants: false,
    variant_count: 0,
  }));
  
  // Combine and return
  return [...transformedParents, ...transformedStandalones];
}

/**
 * Filter out variant children and return only parent/standalone products
 * with computed variant fields
 */
export function filterToParentsOnly(
  products: ProductWithVariants[]
): (ProductWithVariants & ComputedVariantFields)[] {
  const grouped = groupProductsByParent(products);
  return grouped;
}
