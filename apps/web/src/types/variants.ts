/**
 * Product Variants Type Definitions
 * Based on storefront_variants_mv materialized view
 * Phase 5 - Product Variants Integration
 * 
 * Note: This integrates with existing ProductVariant in products.ts
 * MVVariant = MV data structure, ProductVariant = existing rich structure
 */

/**
 * Product type classification from MV
 */
export type ProductType = 'simple' | 'parent' | 'variant';

/**
 * Variant attributes (color, size, material, etc.)
 * Flexible key-value structure for any attribute type
 */
export interface VariantAttributes {
  [key: string]: string;
}

/**
 * Variant data from storefront_variants_mv
 * This is the raw MV structure that gets transformed into ProductVariant
 */
export interface MVVariant {
  id: string;
  sku: string;
  variant_name: string;
  price_cents: number;
  sale_price_cents?: number;
  stock: number;
  image_url?: string;
  attributes: VariantAttributes;
  sort_order: number;
  is_active: boolean;
  is_on_sale: boolean;
  discount_percentage: number;
}

/**
 * Parent product reference
 * Used when displaying a variant to link back to parent
 */
export interface ParentProduct {
  id: string;
  sku: string;
  name: string;
  has_variants: boolean;
}

/**
 * Price range for products with variants
 */
export interface PriceRange {
  min_cents: number;
  max_cents: number;
  currency?: string;
}

/**
 * Available attributes across all variants
 * Used for variant selector dropdowns
 */
export interface AvailableAttributes {
  [attributeName: string]: string[];
}

/**
 * Complete product with variant information
 * Extends base product with variant-specific fields
 */
export interface ProductWithVariants {
  // Variant-specific fields from storefront_variants_mv
  product_type: ProductType;
  parent_item_id?: string;
  variant_attributes?: VariantAttributes;
  variant_name?: string;
  variant_sort_order?: number;
  variant_is_active?: boolean;
  variant_group?: MVVariant[];
  parent_product?: ParentProduct;
  
  // Computed fields for UI
  has_variants?: boolean;
  variant_count?: number;
  price_range?: PriceRange;
  available_attributes?: AvailableAttributes;
}

/**
 * Variant selection state
 * Tracks user's current variant selection
 */
export interface VariantSelection {
  selectedVariantId?: string;
  selectedAttributes: VariantAttributes;
  availableVariants: MVVariant[];
}

/**
 * Variant filter options
 * For filtering products by variant attributes
 */
export interface VariantFilterOptions {
  attributes?: VariantAttributes;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

/**
 * Helper type guards
 */
export const isParentProduct = (product: ProductWithVariants): boolean => {
  return product.product_type === 'parent';
};

export const isVariantProduct = (product: ProductWithVariants): boolean => {
  return product.product_type === 'variant';
};

export const isSimpleProduct = (product: ProductWithVariants): boolean => {
  return product.product_type === 'simple';
};

export const hasActiveVariants = (product: ProductWithVariants): boolean => {
  return isParentProduct(product) && 
         !!product.variant_group && 
         product.variant_group.length > 0;
};

/**
 * Variant utility functions
 */
export const getVariantDisplayPrice = (variant: MVVariant): number => {
  return variant.sale_price_cents && variant.is_on_sale
    ? variant.sale_price_cents
    : variant.price_cents;
};

export const getProductPriceRange = (variants: MVVariant[]): PriceRange | null => {
  if (!variants || variants.length === 0) return null;
  
  const prices = variants.map(v => getVariantDisplayPrice(v));
  return {
    min_cents: Math.min(...prices),
    max_cents: Math.max(...prices)
  };
};

export const extractAvailableAttributes = (variants: MVVariant[]): AvailableAttributes => {
  const attributeMap: AvailableAttributes = {};
  
  variants.forEach(variant => {
    if (variant.attributes) {
      Object.entries(variant.attributes).forEach(([key, value]) => {
        if (!attributeMap[key]) {
          attributeMap[key] = [];
        }
        if (!attributeMap[key].includes(value)) {
          attributeMap[key].push(value);
        }
      });
    }
  });
  
  return attributeMap;
};

export const findVariantByAttributes = (
  variants: MVVariant[],
  attributes: VariantAttributes
): MVVariant | undefined => {
  return variants.find(variant => {
    if (!variant.attributes) return false;
    
    return Object.entries(attributes).every(([key, value]) => {
      return variant.attributes[key] === value;
    });
  });
};

export const getVariantStockStatus = (variant: MVVariant): 'in_stock' | 'low_stock' | 'out_of_stock' => {
  if (variant.stock === 0) return 'out_of_stock';
  if (variant.stock <= 5) return 'low_stock';
  return 'in_stock';
};
