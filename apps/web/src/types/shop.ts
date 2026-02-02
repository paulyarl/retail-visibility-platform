/**
 * Shop System Types & Interfaces
 * Core data structures for the shops discovery and management system
 */

// ====================
// SHOP CORE TYPES
// ====================

export interface Shop {
  // Basic shop information
  tenantId: string;
  name: string;
  slug?: string;
  autoId: string;
  description: string;
  
  // Location & contact
  location: string;
  address?: string;
  category: string;
  primary_category?: string;
  contact?: {
    email: string;
    phone: string;
    website?: string;
  };
  
  // Business hours
  hours?: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  
  // Metrics & status
  productCount: number;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  isActive: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Media
  imageUrl?: string;
  bannerUrl?: string;
  
  // URL generation
  urls: ShopUrls;
}

export interface ShopUrls {
  slugUrl: string | null;
  tenantIdUrl: string;
  autoIdUrl: string;
  canonicalUrl: string;
}

export interface ShopCategory {
  id: string;
  name: string;
  count: number;
  icon?: string;
  description?: string;
}

export interface TrendingShop extends Shop {
  trendingScore: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
}

// ====================
// SHOP IDENTIFICATION
// ====================

export interface ShopIdentifiers {
  tenantId: string;
  slug?: string;
  autoId: string;
}

export interface ShopResolution {
  identifier: string;
  type: 'tenantId' | 'slug' | 'autoId';
  found: boolean;
  shop?: Shop;
}

// ====================
// SHOP MANAGEMENT
// ====================

export interface ShopCreationRequest {
  name: string;
  slug?: string;
  description: string;
  category: string;
  location: string;
  address?: string;
  contact?: {
    email: string;
    phone: string;
    website?: string;
  };
  hours?: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
}

export interface ShopUpdateRequest extends Partial<ShopCreationRequest> {
  // Additional update-specific fields
  branding?: ShopBranding;
  settings?: ShopSettings;
}

export interface ShopBranding {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  logo?: {
    url: string;
    size: 'small' | 'medium' | 'large';
  };
  banner?: {
    url: string;
    height: number;
    overlay: boolean;
  };
}

export interface ShopSettings {
  allowReviews: boolean;
  showContactInfo: boolean;
  enableMessaging: boolean;
  autoApproveReviews: boolean;
  featuredPlacement: boolean;
}

// ====================
// SHOP PUBLISHING WORKFLOW
// ====================

export interface ShopPublishingStatus {
  status: 'draft' | 'pending_review' | 'approved' | 'published' | 'suspended' | 'rejected';
  submittedAt?: string;
  reviewedAt?: string;
  publishedAt?: string;
  rejectionReason?: string;
  reviewNotes?: string;
}

export interface ShopReviewRequest {
  shopId: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  rejectionReason?: string;
}

// ====================
// SHOP ANALYTICS
// ====================

export interface ShopAnalytics {
  shopId: string;
  period: 'daily' | 'weekly' | 'monthly';
  views: number;
  uniqueVisitors: number;
  productViews: number;
  inquiries: number;
  conversionRate: number;
  averageRating: number;
  newReviews: number;
  trendingScore: number;
  growthRate: number;
}

export interface ShopMetrics {
  totalShops: number;
  activeShops: number;
  pendingShops: number;
  publishedShops: number;
  suspendedShops: number;
  averageRating: number;
  totalProducts: number;
  totalReviews: number;
  categories: ShopCategory[];
}

// ====================
// SHOP DISCOVERY
// ====================

export interface ShopSearchParams {
  search?: string;
  category?: string;
  region?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'rating' | 'productCount' | 'createdAt' | 'trendingScore';
  sortOrder?: 'asc' | 'desc';
  verified?: boolean;
  active?: boolean;
}

export interface ShopSearchResponse {
  success: boolean;
  data: Shop[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  filters: {
    search?: string;
    category?: string;
    region?: string;
  };
}

export interface TrendingShopsResponse {
  success: boolean;
  data: TrendingShop[];
  count: number;
  type: 'trending';
  timeframe: 'daily' | 'weekly' | 'monthly';
}

// ====================
// SHOP PRODUCTS
// ====================

export interface ShopProduct {
  // Basic product info
  id: string;
  sku: string;
  name: string;
  title: string;
  description: string;
  price: number;
  salePrice?: number;
  stock: number;
  availability: 'in_stock' | 'out_of_stock' | 'limited';
  
  // Shop-specific data
  shopId: string;
  shopName: string;
  shopSlug: string;
  shopAutoId: string;
  
  // Media
  imageUrl?: string;
  images?: ProductImage[];
  videos?: ProductVideo[];
  
  // Rich data
  specifications?: ProductSpec[];
  reviews?: ProductReview[];
  variants?: ProductVariant[];
  metadata?: Record<string, any>;
  
  // Shop management
  featuredTypes: FeaturedType[];
  isShopExclusive: boolean;
  shopInventory: number;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  isPrimary: boolean;
}

export interface ProductVideo {
  id: string;
  url: string;
  thumbnail: string;
  title: string;
  duration: number;
}

export interface ProductSpec {
  name: string;
  value: string;
  type: 'text' | 'number' | 'boolean';
}

export interface ProductReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  verified: boolean;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  salePrice?: number;
  stock: number;
  attributes: Record<string, string>;
  imageUrl?: string;
}

// ====================
// FEATURED TYPES
// ====================

export type FeaturedType = 
  | 'store_selection'
  | 'new_arrival' 
  | 'trending'
  | 'seasonal'
  | 'staff_pick'
  | 'premium';

export interface FeaturedShop {
  shopId: string;
  type: FeaturedType;
  priority: number;
  featuredAt: string;
  expiresAt?: string;
  autoUnfeature: boolean;
  isActive: boolean;
}

// ====================
// SHOP TIER FEATURES
// ====================

export interface ShopTierFeatures {
  basic: ShopFeature[];
  premium: ShopFeature[];
  enterprise: ShopFeature[];
}

export type ShopFeature = 
  | 'listing'
  | 'basic_analytics'
  | 'advanced_analytics'
  | 'branding'
  | 'featured_placement'
  | 'api_access'
  | 'messaging'
  | 'reviews_management'
  | 'inventory_management'
  | 'shipping_integration'
  | 'payment_processing';

export interface ShopTierValidation {
  shopId: string;
  tier: 'basic' | 'premium' | 'enterprise';
  features: ShopFeature[];
  validFeatures: ShopFeature[];
  invalidFeatures: ShopFeature[];
}

// ====================
// API RESPONSE TYPES
// ====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: any;
  filters?: any;
}

export interface ShopResponse extends ApiResponse<Shop> {}
export interface ShopsResponse extends ApiResponse<Shop[]> {}
export interface TrendingShopsResponse extends ApiResponse<TrendingShop[]> {}
export interface ShopCategoriesResponse extends ApiResponse<ShopCategory[]> {}

// ====================
// ERROR TYPES
// ====================

export class ShopError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ShopError';
  }
}

export class ShopNotFoundError extends ShopError {
  constructor(identifier: string) {
    super(`Shop not found: ${identifier}`, 'SHOP_NOT_FOUND', { identifier });
  }
}

export class ShopAccessDeniedError extends ShopError {
  constructor(shopId: string, userId: string) {
    super(`Access denied to shop: ${shopId}`, 'SHOP_ACCESS_DENIED', { shopId, userId });
  }
}

export class ShopValidationError extends ShopError {
  constructor(message: string, field?: string) {
    super(message, 'SHOP_VALIDATION_ERROR', { field });
  }
}
