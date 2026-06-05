/**
 * Shop System Constants & Configuration
 * Centralized configuration for shops discovery and management
 */

// ====================
// SHOP CATEGORIES
// ====================

export const SHOP_CATEGORIES = {
  GROCERY: {
    id: 'grocery',
    name: 'Grocery & Food',
    description: 'Grocery stores, food markets, and specialty food shops',
    icon: '🛒',
    color: '#10b981'
  },
  FASHION: {
    id: 'fashion',
    name: 'Fashion & Apparel',
    description: 'Clothing, accessories, and fashion boutiques',
    icon: '👗',
    color: '#ec4899'
  },
  ELECTRONICS: {
    id: 'electronics',
    name: 'Electronics',
    description: 'Electronics, gadgets, and technology stores',
    icon: '📱',
    color: '#3b82f6'
  },
  HOME: {
    id: 'home',
    name: 'Home & Garden',
    description: 'Home goods, furniture, and garden supplies',
    icon: '🏠',
    color: '#f59e0b'
  },
  HEALTH: {
    id: 'health',
    name: 'Health & Beauty',
    description: 'Health products, beauty supplies, and personal care',
    icon: '💄',
    color: '#8b5cf6'
  },
  SPORTS: {
    id: 'sports',
    name: 'Sports & Outdoors',
    description: 'Sports equipment, outdoor gear, and fitness supplies',
    icon: '⚽',
    color: '#06b6d4'
  },
  BOOKS: {
    id: 'books',
    name: 'Books & Media',
    description: 'Bookstores, media, and entertainment',
    icon: '📚',
    color: '#84cc16'
  },
  TOYS: {
    id: 'toys',
    name: 'Toys & Games',
    description: 'Toy stores, games, and hobby shops',
    icon: '🎮',
    color: '#f97316'
  },
  PETS: {
    id: 'pets',
    name: 'Pet Supplies',
    description: 'Pet stores, pet food, and pet accessories',
    icon: '🐕',
    color: '#a855f7'
  },
  AUTOMOTIVE: {
    id: 'automotive',
    name: 'Automotive',
    description: 'Auto parts, accessories, and services',
    icon: '🚗',
    color: '#64748b'
  }
} as const;

export type ShopCategoryId = keyof typeof SHOP_CATEGORIES;

// ====================
// SHOP TIERS & FEATURES
// ====================

export const SHOP_TIERS = {
  BASIC: {
    id: 'basic',
    name: 'Basic',
    description: 'Essential shop features for small businesses',
    price: 0,
    features: [
      'listing',
      'basic_analytics',
      'contact_info'
    ],
    limits: {
      products: 50,
      images: 5,
      featured_products: 0
    }
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium',
    description: 'Advanced features for growing businesses',
    price: 29.99,
    features: [
      'listing',
      'basic_analytics',
      'advanced_analytics',
      'branding',
      'featured_placement',
      'messaging',
      'reviews_management'
    ],
    limits: {
      products: 500,
      images: 20,
      featured_products: 5
    }
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Complete solution for large businesses',
    price: 99.99,
    features: [
      'listing',
      'basic_analytics',
      'advanced_analytics',
      'branding',
      'featured_placement',
      'api_access',
      'messaging',
      'reviews_management',
      'inventory_management',
      'shipping_integration',
      'payment_processing'
    ],
    limits: {
      products: -1, // unlimited
      images: -1, // unlimited
      featured_products: 20
    }
  }
} as const;

export type ShopTierId = keyof typeof SHOP_TIERS;

// ====================
// SHOP STATUS & PUBLISHING
// ====================

export const SHOP_STATUS = {
  DRAFT: {
    id: 'draft',
    name: 'Draft',
    description: 'Shop is being created and not yet submitted',
    color: '#6b7280',
    icon: '📝'
  },
  PENDING_REVIEW: {
    id: 'pending_review',
    name: 'Pending Review',
    description: 'Shop is submitted and waiting for approval',
    color: '#f59e0b',
    icon: '⏳'
  },
  APPROVED: {
    id: 'approved',
    name: 'Approved',
    description: 'Shop has been approved but not yet published',
    color: '#10b981',
    icon: '✅'
  },
  PUBLISHED: {
    id: 'published',
    name: 'Published',
    description: 'Shop is live and visible to customers',
    color: '#059669',
    icon: '🚀'
  },
  SUSPENDED: {
    id: 'suspended',
    name: 'Suspended',
    description: 'Shop has been temporarily suspended',
    color: '#dc2626',
    icon: '⚠️'
  },
  REJECTED: {
    id: 'rejected',
    name: 'Rejected',
    description: 'Shop submission was rejected',
    color: '#991b1b',
    icon: '❌'
  }
} as const;

export type ShopStatusId = keyof typeof SHOP_STATUS;

// ====================
// FEATURED TYPES
// ====================

export const FEATURED_TYPES = {
  STORE_SELECTION: {
    id: 'store_selection',
    name: 'Store Selection',
    description: 'Hand-picked by our team',
    color: '#059669',
    icon: '⭐',
    priority: 100
  },
  NEW_ARRIVAL: {
    id: 'new_arrival',
    name: 'New Arrival',
    description: 'Recently joined shops',
    color: '#7c3aed',
    icon: '✨',
    priority: 80
  },
  TRENDING: {
    id: 'trending',
    name: 'Trending',
    description: 'Popular shops right now',
    color: '#dc2626',
    icon: '🔥',
    priority: 90
  },
  SEASONAL: {
    id: 'seasonal',
    name: 'Seasonal',
    description: 'Seasonal highlights',
    color: '#ea580c',
    icon: '🍂',
    priority: 70
  },
  STAFF_PICK: {
    id: 'staff_pick',
    name: 'Staff Pick',
    description: 'Recommended by our staff',
    color: '#0891b2',
    icon: '👍',
    priority: 60
  },
  PREMIUM: {
    id: 'premium',
    name: 'Premium',
    description: 'Premium shop members',
    color: '#7c2d12',
    icon: '💎',
    priority: 50
  }
} as const;

export type FeaturedTypeId = keyof typeof FEATURED_TYPES;

// ====================
// URL CONFIGURATION
// ====================

export const SHOP_URL_CONFIG = {
  BASE_PATH: '/shops',
  ROUTES: {
    DIRECTORY: '/shops/directory',
    CATEGORIES: '/shops/categories',
    TRENDING: '/shops/trending',
    MANAGEMENT: '/dashboard/shops',
    CREATE: '/dashboard/shops/create',
    EDIT: '/dashboard/shops/edit',
    ANALYTICS: '/dashboard/shops/analytics'
  },
  IDENTIFIER_PATTERNS: {
    TENANT_ID: /^tid-[a-z0-9]+$/,
    SLUG: /^[a-z0-9]+(-[a-z0-9]+)*$/,
    AUTO_ID: /^[A-Z0-9]{4}$/
  },
  RESOLUTION_PRIORITY: ['slug', 'tenantId', 'autoId'] as const,
  CANONICAL_PREFERENCE: 'slug' as const
};

// ====================
// API CONFIGURATION
// ====================

export const SHOP_API_CONFIG = {
  ENDPOINTS: {
    DIRECTORY: '/api/shops/directory',
    TRENDING: '/api/shops/trending',
    CATEGORIES: '/api/shops/categories',
    SHOP: '/api/shops/:identifier',
    CREATE: '/api/shops',
    UPDATE: '/api/shops/:identifier',
    DELETE: '/api/shops/:identifier',
    PUBLISH: '/api/shops/:identifier/publish',
    ANALYTICS: '/api/shops/:identifier/analytics',
    PRODUCTS: '/api/shops/:identifier/products'
  },
  TIMEOUTS: {
    DEFAULT: 10000,
    UPLOAD: 30000,
    ANALYTICS: 15000
  },
  RETRY_ATTEMPTS: 3,
  CACHE_TTL: {
    DIRECTORY: 300, // 5 minutes
    TRENDING: 600, // 10 minutes
    CATEGORIES: 3600, // 1 hour
    SHOP_DETAILS: 1800, // 30 minutes
    ANALYTICS: 900 // 15 minutes
  }
};

// ====================
// UI CONFIGURATION
// ====================

export const SHOP_UI_CONFIG = {
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    LIMIT_OPTIONS: [12, 20, 40, 60, 100]
  },
  SEARCH: {
    MIN_LENGTH: 2,
    DEBOUNCE_MS: 300,
    MAX_RESULTS: 50
  },
  IMAGES: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    MAX_DIMENSION: 2048,
    THUMBNAIL_SIZE: 300
  },
  RATINGS: {
    MAX: 5,
    PRECISION: 1,
    SHOW_DECIMALS: false
  },
  CARDS: {
    VARIANTS: {
      DEFAULT: 'default',
      COMPACT: 'compact',
      FEATURED: 'featured',
      GRID: 'grid'
    },
    ASPECT_RATIO: '16/9',
    BORDER_RADIUS: 8
  }
};

// ====================
// VALIDATION RULES
// ====================

export const SHOP_VALIDATION = {
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z0-9\s\-',.&]+$/,
    REQUIRED: true
  },
  SLUG: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^[a-z0-9]+(-[a-z0-9]+)*$/,
    REQUIRED: false,
    UNIQUE: true
  },
  DESCRIPTION: {
    MIN_LENGTH: 10,
    MAX_LENGTH: 2000,
    REQUIRED: true
  },
  CATEGORY: {
    REQUIRED: true,
    ALLOWED: Object.keys(SHOP_CATEGORIES)
  },
  LOCATION: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 100,
    REQUIRED: true
  },
  CONTACT: {
    EMAIL: {
      PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      REQUIRED: true
    },
    PHONE: {
      PATTERN: /^[\d\s\-\+\(\)]+$/,
      REQUIRED: true
    },
    WEBSITE: {
      PATTERN: /^https?:\/\/.+/,
      REQUIRED: false
    }
  }
};

// ====================
// BUSINESS RULES
// ====================

export const SHOP_BUSINESS_RULES = {
  PUBLISHING: {
    MIN_COMPLETION_SCORE: 80,
    REQUIRED_FIELDS: ['name', 'description', 'category', 'location', 'contact.email'],
    REVIEW_TIME_HOURS: 24,
    AUTO_APPROVE_THRESHOLD: 90
  },
  RATINGS: {
    MIN_REVIEWS_FOR_DISPLAY: 3,
    MIN_RATING_FOR_FEATURED: 4.0,
    MAX_RATING_AGE_DAYS: 365
  },
  INVENTORY: {
    MIN_PRODUCTS_FOR_LISTING: 1,
    MAX_OUT_OF_STOCK_DAYS: 30,
    LOW_STOCK_THRESHOLD: 5
  },
  ACTIVITY: {
    INACTIVE_DAYS_THRESHOLD: 90,
    MIN_VIEWS_PER_MONTH: 10,
    MIN_UPDATES_PER_QUARTER: 1
  }
};

// ====================
// ERROR MESSAGES
// ====================

export const SHOP_ERROR_MESSAGES = {
  NOT_FOUND: 'Shop not found',
  ACCESS_DENIED: 'You do not have permission to access this shop',
  INVALID_IDENTIFIER: 'Invalid shop identifier',
  ALREADY_EXISTS: 'Shop with this identifier already exists',
  PUBLISHING_FAILED: 'Failed to publish shop',
  VALIDATION_FAILED: 'Shop information is incomplete or invalid',
  RATE_LIMITED: 'Too many requests. Please try again later',
  SERVER_ERROR: 'An unexpected error occurred. Please try again',
  NETWORK_ERROR: 'Network error. Please check your connection',
  UPLOAD_FAILED: 'Failed to upload image',
  DELETE_FAILED: 'Failed to delete shop'
};

// ====================
// SUCCESS MESSAGES
// ====================

export const SHOP_SUCCESS_MESSAGES = {
  CREATED: 'Shop created successfully',
  UPDATED: 'Shop updated successfully',
  PUBLISHED: 'Shop published successfully',
  DELETED: 'Shop deleted successfully',
  IMAGE_UPLOADED: 'Image uploaded successfully',
  SETTINGS_SAVED: 'Settings saved successfully',
  BRANDING_UPDATED: 'Branding updated successfully'
};

// ====================
// HELPER FUNCTIONS
// ====================

export function getShopCategoryById(id: string) {
  return Object.values(SHOP_CATEGORIES).find(category => category.id === id);
}

export function getShopTierById(id: string) {
  return Object.values(SHOP_TIERS).find(tier => tier.id === id);
}

export function getShopStatusById(id: string) {
  return Object.values(SHOP_STATUS).find(status => status.id === id);
}

export function getFeaturedTypeById(id: string) {
  return Object.values(FEATURED_TYPES).find(type => type.id === id);
}

export function validateShopIdentifier(identifier: string): {
  isValid: boolean;
  type: 'tenantId' | 'slug' | 'autoId' | 'unknown';
} {
  if (SHOP_URL_CONFIG.IDENTIFIER_PATTERNS.TENANT_ID.test(identifier)) {
    return { isValid: true, type: 'tenantId' };
  }
  
  if (SHOP_URL_CONFIG.IDENTIFIER_PATTERNS.SLUG.test(identifier)) {
    return { isValid: true, type: 'slug' };
  }
  
  if (SHOP_URL_CONFIG.IDENTIFIER_PATTERNS.AUTO_ID.test(identifier)) {
    return { isValid: true, type: 'autoId' };
  }
  
  return { isValid: false, type: 'unknown' };
}

export function formatShopUrl(identifier: string, options: {
  includeDomain?: boolean;
  domain?: string;
} = {}): string {
  const { includeDomain = false, domain } = options;
  
  const path = `${SHOP_URL_CONFIG.BASE_PATH}/${identifier}`;
  
  if (includeDomain) {
    const baseDomain = domain || process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com';
    return `${baseDomain}${path}`;
  }
  
  return path;
}

export default {
  SHOP_CATEGORIES,
  SHOP_TIERS,
  SHOP_STATUS,
  FEATURED_TYPES,
  SHOP_URL_CONFIG,
  SHOP_API_CONFIG,
  SHOP_UI_CONFIG,
  SHOP_VALIDATION,
  SHOP_BUSINESS_RULES,
  SHOP_ERROR_MESSAGES,
  SHOP_SUCCESS_MESSAGES,
  getShopCategoryById,
  getShopTierById,
  getShopStatusById,
  getFeaturedTypeById,
  validateShopIdentifier,
  formatShopUrl
};
