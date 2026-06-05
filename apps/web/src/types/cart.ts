/**
 * Cart Types for Platform Shopping Cart System
 */

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  addedAt: string;
  lastAdded: string;
  // Optional product details
  productName?: string;
  productImage?: string;
  productSku?: string;
  variant?: ProductVariant;
  // Digital product fields
  productType?: 'physical' | 'digital' | 'hybrid';
  digitalDeliveryMethod?: 'direct_download' | 'license_key' | 'external_link' | 'access_grant';
  hasDownloadPage?: boolean;
  downloadPageId?: string;
  requiresLicenseKey?: boolean;
  accessDurationDays?: number;
  downloadLimit?: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  sku: string;
  attributes: Record<string, string>;
}

export interface ShopCart {
  shopId: string;
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  lastUpdated: string;
  // Optional shop details
  shopName?: string;
  shopSlug?: string;
  shopUrl?: string;
}

export interface PlatformCart {
  shops: Record<string, ShopCart>;
  totalItems: number;
  totalPrice: number;
  lastUpdated: string;
}

export interface CartValidationResult {
  isValid: boolean;
  errors: CartValidationError[];
  warnings: CartValidationWarning[];
}

export interface CartValidationError {
  productId: string;
  shopId: string;
  type: 'out_of_stock' | 'price_changed' | 'product_unavailable' | 'quantity_limit';
  message: string;
  currentData?: any;
}

export interface CartValidationWarning {
  productId: string;
  shopId: string;
  type: 'low_stock' | 'price_dropped' | 'bulk_discount_available';
  message: string;
  recommendation?: string;
}

export interface CartAnalytics {
  totalCarts: number;
  activeCarts: number;
  conversionRate: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  shopPerformance: Array<{
    shopId: string;
    shopName: string;
    cartCount: number;
    revenue: number;
    averageOrderValue: number;
  }>;
}

export interface CartEvent {
  type: 'item_added' | 'item_removed' | 'quantity_updated' | 'cart_cleared' | 'checkout_started' | 'checkout_completed';
  shopId: string;
  productId?: string;
  quantity?: number;
  price?: number;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface CartSettings {
  maxItemsPerCart: number;
  maxQuantityPerItem: number;
  allowBackorders: boolean;
  autoRemoveUnavailable: boolean;
  priceUpdateStrategy: 'notify' | 'auto_update' | 'block';
  sessionTimeout: number; // in minutes
}

export interface CartExport {
  format: 'json' | 'csv' | 'pdf';
  includeAnalytics: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
  shopIds?: string[];
}

export interface CartImport {
  format: 'json' | 'csv';
  data: any;
  validationMode: 'strict' | 'lenient';
  mergeStrategy: 'replace' | 'merge' | 'append';
}
