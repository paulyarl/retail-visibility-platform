/**
 * Product Display Types & Interfaces
 * Standardized product display requirements with mandatory fields
 */

// ====================
// PRODUCT DISPLAY CORE
// ====================

export interface ProductDisplay {
  // Required fields - always present
  name: string;
  stock: number;
  sku: string;
  price: {
    cents: number;
    currency: string;
    formatted: string;
  };
  
  // Sale pricing (optional but first-class supported)
  salePrice?: {
    cents: number;
    currency: string;
    formatted: string;
  };
  
  // Required fields - may be null/undefined or array
  featuredType?: FeaturedType | FeaturedType[] | null;
  category?: Category | null;
  
  // Optional rich fields for enhanced display
  description?: string;
  imageUrl?: string;
  brand?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  
  // Enhanced fields for rich product display
  averageRating?: number;
  reviewCount?: number;
  viewCount?: number;
  wishlistCount?: number;
  shareCount?: number;
  isOnSale?: boolean;
  discountPercentage?: string;
  hasGallery?: boolean;
  videoUrl?: string;
  imageUrls?: string[];
  galleryUrls?: string[];
  thumbnailUrl?: string;
  featuredImageUrl?: string;
  marketingDescription?: string;
  manufacturer?: string;
  condition?: string;
  gtin?: string;
  mpn?: string;
  specifications?: any;
  attributes?: any;
  customFields?: any;
  searchKeywords?: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  metadata?: any;
  tenantId?: string;
}

// ====================
// FEATURED TYPES
// ====================

export type FeaturedType = 
  // Merchant-controlled types
  | 'new_arrival'
  | 'seasonal' 
  | 'sale'
  | 'staff_pick'
  | 'clearance'
  | 'featured'
  // Platform-controlled types (algorithmic)
  | 'trending'
  | 'recommended'
  | 'bestseller'
  | 'random_featured'
  // Directory type
  | 'store_selection';

export interface FeaturedTypeInfo {
  type: FeaturedType;
  label: string;
  color: string;
  priority: number;
  icon?: string;
}

export const FEATURED_TYPES: Record<FeaturedType, FeaturedTypeInfo> = {
  // Merchant-controlled types
  new_arrival: {
    type: 'new_arrival',
    label: 'New Arrival',
    color: 'green',
    priority: 1,
    icon: '🆕'
  },
  seasonal: {
    type: 'seasonal',
    label: 'Seasonal',
    color: 'orange',
    priority: 2,
    icon: '🍂'
  },
  sale: {
    type: 'sale',
    label: 'Sale',
    color: 'red',
    priority: 3,
    icon: '🏷️'
  },
  staff_pick: {
    type: 'staff_pick',
    label: "Staff Pick",
    color: 'purple',
    priority: 4,
    icon: '⭐'
  },
  clearance: {
    type: 'clearance',
    label: 'Clearance',
    color: 'yellow',
    priority: 5,
    icon: '🔥'
  },
  featured: {
    type: 'featured',
    label: 'Premium',
    color: 'indigo',
    priority: 6,
    icon: '👑'
  },
  
  // Platform-controlled types (algorithmic)
  trending: {
    type: 'trending',
    label: 'Trending',
    color: 'pink',
    priority: 7,
    icon: '📈'
  },
  recommended: {
    type: 'recommended',
    label: 'Recommended',
    color: 'teal',
    priority: 8,
    icon: '🏆'
  },
  bestseller: {
    type: 'bestseller',
    label: 'Bestseller',
    color: 'amber',
    priority: 9,
    icon: '🥇'
  },
  random_featured: {
    type: 'random_featured',
    label: 'Discover',
    color: 'cyan',
    priority: 10,
    icon: '✨'
  },
  
  // Directory type
  store_selection: {
    type: 'store_selection',
    label: 'Featured',
    color: 'blue',
    priority: 11,
    icon: '⭐'
  }
};

// ====================
// CATEGORIES
// ====================

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  parentId?: string;
}

// ====================
// DISPLAY VARIANTS
// ====================

export type ProductDisplayVariant = 
  | 'card'        // Standard product card
  | 'list'        // List item view
  | 'compact'     // Minimal display
  | 'featured'    // Enhanced featured display
  | 'grid'        // Grid layout
  | 'detail';     // Full detail view

export interface ProductDisplayProps {
  product: ProductDisplay;
  variant?: ProductDisplayVariant;
  showStock?: boolean;
  showSKU?: boolean;
  showFeaturedType?: boolean;
  showCategory?: boolean;
  className?: string;
  onClick?: () => void;
  tenantId?: string;
}

// ====================
// VALIDATION HELPERS
// ====================

export function validateProductDisplay(product: any): ProductDisplay {
  if (!product) {
    throw new Error('Product is required');
  }

  // Validate required fields
  if (!product.name || typeof product.name !== 'string') {
    throw new Error('Product name is required and must be a string');
  }

  if (typeof product.stock !== 'number') {
    throw new Error('Product stock is required and must be a number');
  }

  if (!product.sku || typeof product.sku !== 'string') {
    throw new Error('Product SKU is required and must be a string');
  }

  if (!product.price || typeof product.price.cents !== 'number') {
    throw new Error('Product price is required and must have cents');
  }

  // Return validated product with defaults for optional fields
  return {
    name: product.name,
    stock: product.stock,
    sku: product.sku,
    price: {
      cents: product.price.cents,
      currency: product.price.currency || 'USD',
      formatted: product.price.formatted || `$${(product.price.cents / 100).toFixed(2)}`
    },
    featuredType: product.featuredType || null,
    category: product.category || null,
    description: product.description,
    imageUrl: product.imageUrl,
    brand: product.brand,
    weight: product.weight,
    dimensions: product.dimensions,
    tags: product.tags || [],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    tenantId: product.tenantId
  };
}

// ====================
// DISPLAY HELPERS
// ====================

export function getFeaturedTypeDisplay(type: FeaturedType | FeaturedType[] | null | undefined): FeaturedTypeInfo[] {
  if (!type) {
    return [];
  }

  // Handle single featured type
  if (typeof type === 'string') {
    const singleType = FEATURED_TYPES[type];
    return singleType ? [singleType] : [];
  }

  // Handle array of featured types
  if (Array.isArray(type)) {
    return type
      .map(t => FEATURED_TYPES[t])
      .filter(Boolean)
      .sort((a, b) => a.priority - b.priority); // Sort by priority
  }

  return [];
}

export function getCategoryDisplay(category: Category | null | undefined): string {
  if (!category) {
    return 'Uncategorized';
  }
  return category.name;
}

export function getStockStatus(stock: number): {
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  label: string;
  color: string;
} {
  if (stock === 0) {
    return {
      status: 'out_of_stock',
      label: 'Out of Stock',
      color: 'red'
    };
  } else if (stock < 5) {
    return {
      status: 'low_stock',
      label: `Low Stock (${stock})`,
      color: 'yellow'
    };
  } else {
    return {
      status: 'in_stock',
      label: `In Stock (${stock})`,
      color: 'green'
    };
  }
}

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

export function getSalePricing(product: ProductDisplay): {
  isOnSale: boolean;
  salePrice?: { cents: number; currency: string; formatted: string };
  regularPrice: { cents: number; currency: string; formatted: string };
  discountPercentage?: number;
  discountAmount?: { cents: number; currency: string; formatted: string };
} {
  const regularPrice = product.price;
  const salePrice = product.salePrice;
  
  if (!salePrice || salePrice.cents >= regularPrice.cents) {
    return {
      isOnSale: false,
      regularPrice
    };
  }
  
  const discountAmount = regularPrice.cents - salePrice.cents;
  const discountPercentage = Math.round((discountAmount / regularPrice.cents) * 100);
  
  return {
    isOnSale: true,
    salePrice,
    regularPrice,
    discountPercentage,
    discountAmount: {
      cents: discountAmount,
      currency: regularPrice.currency,
      formatted: formatPrice({ cents: discountAmount, currency: regularPrice.currency })
    }
  };
}
