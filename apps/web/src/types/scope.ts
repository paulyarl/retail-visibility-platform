/**
 * Scope-Aware Discovery Types
 * Phase 5 UI Implementation
 */

export type ScopeType = 'global' | 'category' | 'location';
export type BucketType = 'trending' | 'new' | 'sale' | 'seasonal' | 'staff' | 'selection' | 'random';
export type CategoryType = 'product' | 'shop' | 'both';

export interface ScopeParams {
  scope: ScopeType;
  category?: CategoryParams;
  location?: LocationParams;
}

export interface CategoryParams {
  productName?: string;
  productSlug?: string;
  productId?: string;
  googleProductId?: string;
  shopCategoryName?: string;
  shopCategoryId?: string;
  shopGoogleCategoryId?: string;
  categoryType?: CategoryType;
}

export interface LocationParams {
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface CategoryAggregation {
  category_name: string;
  category_slug: string;
  category_type: 'product' | 'shop';
  product_count: number;
  shop_count: number;
  avg_trending_score: number;
  products_in_stock: number;
}

export interface NearbyShop {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string | null;
  shop_category: string;
  tenant_city: string;
  tenant_state: string;
  tenant_zip: string;
  tenant_address: string;
  tenant_latitude: number;
  tenant_longitude: number;
  product_count: number;
  products_with_images: number;
  products_in_stock: number;
  avg_trending_score: number;
  distance_miles: number;
}
