/**
 * Enhanced Product Data for Shops
 * Comprehensive product information with rich media and metadata
 */

import { FeaturedType } from '@/services/featured/FeaturedShopManager';

export interface ShopProduct {
  // Basic product info
  id: string;
  sku: string;
  name: string;
  title: string;
  description: string;
  price: number;
  salePrice?: number;
  currency?: string;
  
  // Shop-specific data
  shopId: string;
  shopName: string;
  shopSlug: string;
  shopAutoId: string;
  
  // Rich data
  images: ProductImage[];
  videos: ProductVideo[];
  specifications: ProductSpec[];
  reviews: ProductReview[];
  variants: ProductVariant[];
  metadata: ProductMetadata;
  
  // Shop management
  featuredTypes: FeaturedType[];
  isShopExclusive: boolean;
  shopInventory: number;
  
  // Status and timestamps
  status: 'active' | 'inactive' | 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  title?: string;
  description?: string;
  isPrimary: boolean;
  sortOrder: number;
  width?: number;
  height?: number;
  size: number;
  format: string;
  tags: string[];
}

export interface ProductVideo {
  id: string;
  url: string;
  thumbnailUrl: string;
  title: string;
  description: string;
  duration: number;
  format: string;
  size: number;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductSpec {
  id: string;
  name: string;
  value: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'url';
  unit?: string;
  category: string;
  sortOrder: number;
  isRequired: boolean;
}

export interface ProductReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  images?: ProductImage[];
  verified: boolean;
  helpful: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  salePrice?: number;
  compareAtPrice?: number;
  cost?: number;
  weight?: number;
  dimensions?: ProductDimensions;
  attributes: VariantAttribute[];
  image?: ProductImage;
  inventory: number;
  trackInventory: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface VariantAttribute {
  id: string;
  name: string;
  value: string;
  type: 'color' | 'size' | 'material' | 'style' | 'custom';
  displayValue?: string;
  sortOrder: number;
}

export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
  unit: string;
  weight?: number;
}

export interface ProductMetadata {
  tags: string[];
  categories: string[];
  brand?: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  isbn?: string;
  upc?: string;
  mpn?: string;
  gtin?: string;
  condition: 'new' | 'used' | 'refurbished' | 'open_box';
  availability: 'in_stock' | 'out_of_stock' | 'pre_order' | 'made_to_order';
  shipping: ProductShipping;
  returns: ProductReturns;
  seo: ProductSEO;
  analytics: ProductAnalytics;
}

export interface ProductShipping {
  weight: number;
  dimensions: ProductDimensions;
  freeShipping: boolean;
  shippingCost: number;
  shippingTime: string;
  shippingRegions: string[];
  restrictions: string[];
}

export interface ProductReturns {
  accepted: boolean;
  period: number; // days
  conditions: string[];
  restockingFee?: number;
  instructions: string;
}

export interface ProductSEO {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl?: string;
  ogImage?: string;
  schemaType: string;
  metaRobots: string;
}

export interface ProductAnalytics {
  views: number;
  clicks: number;
  addToCarts: number;
  purchases: number;
  conversionRate: number;
  averageRating: number;
  reviewCount: number;
  searchRankings: Record<string, number>;
  popularInRegions: string[];
}

// Product management interfaces
export interface ProductBulkOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'publish' | 'archive';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  errors: ProductOperationError[];
  startedAt: string;
  completedAt?: string;
}

export interface ProductOperationError {
  productId: string;
  sku: string;
  field: string;
  message: string;
  fixable: boolean;
}

export interface ProductImport {
  format: 'csv' | 'json' | 'xml' | 'excel';
  data: any;
  mapping: ImportMapping;
  validationMode: 'strict' | 'lenient';
  updateStrategy: 'create' | 'update' | 'merge' | 'replace';
  dryRun: boolean;
}

export interface ImportMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transform?: string;
  required: boolean;
  defaultValue?: any;
}

export interface ProductExport {
  format: 'csv' | 'json' | 'xml' | 'excel';
  fields: string[];
  filters: ProductFilter;
  includeImages: boolean;
  includeVariants: boolean;
  includeReviews: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ProductFilter {
  status?: string[];
  shopId?: string;
  category?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  ratingRange?: {
    min: number;
    max: number;
  };
  inStock?: boolean;
  hasImages?: boolean;
  hasVideos?: boolean;
  tags?: string[];
  featuredTypes?: FeaturedType[];
}

// Product validation interfaces
export interface ProductValidationResult {
  isValid: boolean;
  errors: ProductValidationError[];
  warnings: ProductValidationWarning[];
  score: number;
}

export interface ProductValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  fixable: boolean;
  suggestion?: string;
}

export interface ProductValidationWarning {
  field: string;
  message: string;
  recommendation: string;
}

// Product search and indexing
export interface ProductSearchResult {
  products: ShopProduct[];
  total: number;
  page: number;
  pageSize: number;
  facets: ProductFacet[];
  suggestions: string[];
}

export interface ProductFacet {
  field: string;
  name: string;
  values: FacetValue[];
  type: 'category' | 'price_range' | 'rating' | 'brand' | 'tags';
}

export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

// Product inventory management
export interface ProductInventory {
  productId: string;
  sku: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorders: boolean;
  restockLevel: number;
  restockFrequency: string;
  lastRestocked: string;
}

export interface InventoryAlert {
  id: string;
  productId: string;
  sku: string;
  type: 'low_stock' | 'out_of_stock' | 'overstock' | 'restock_needed';
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  threshold?: number;
  createdAt: string;
  acknowledged: boolean;
}

// Product analytics and reporting
export interface ProductReport {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dateRange: {
    start: string;
    end: string;
  };
  metrics: ProductMetrics;
  topProducts: ProductMetric[];
  shopPerformance: ShopProductMetric[];
  trends: ProductTrend[];
}

export interface ProductMetrics {
  totalProducts: number;
  activeProducts: number;
  totalViews: number;
  totalSales: number;
  totalRevenue: number;
  averagePrice: number;
  conversionRate: number;
  averageRating: number;
  totalReviews: number;
}

export interface ProductMetric {
  productId: string;
  sku: string;
  name: string;
  views: number;
  clicks: number;
  addToCarts: number;
  purchases: number;
  revenue: number;
  conversionRate: number;
  rating: number;
  reviewCount: number;
}

export interface ShopProductMetric {
  shopId: string;
  shopName: string;
  productCount: number;
  totalViews: number;
  totalSales: number;
  totalRevenue: number;
  averageRating: number;
  topProduct: ProductMetric;
}

export interface ProductTrend {
  period: string;
  metric: string;
  value: number;
  change: number;
  changePercent: number;
}

// React hooks for product management
import { useState, useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';

export function useShopProducts(shopId: string, filters?: ProductFilter) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const loadProducts = async () => {
    setLoading(true);
    try {
      // In a real implementation, fetch from API
      const mockProducts = await getMockProducts(shopId, filters);
      setProducts(mockProducts.products);
      setTotal(mockProducts.total);
    } catch (error) {
      clientLogger.error('Error loading products:', { detail: error });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [shopId, filters]);

  return {
    products,
    loading,
    total,
    refresh: loadProducts
  };
}

export function useProduct(productId: string) {
  const [product, setProduct] = useState<ShopProduct | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProduct = async () => {
    setLoading(true);
    try {
      // In a real implementation, fetch from API
      const mockProduct = await getMockProduct(productId);
      setProduct(mockProduct);
    } catch (error) {
      clientLogger.error('Error loading product:', { detail: error });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [productId]);

  return {
    product,
    loading,
    refresh: loadProduct
  };
}

// Mock data functions (in real implementation, these would fetch from API)
async function getMockProducts(shopId: string, filters?: ProductFilter): Promise<{ products: ShopProduct[]; total: number }> {
  // Mock implementation
  const mockProducts: ShopProduct[] = [
    {
      id: '1',
      sku: 'PROD-001',
      name: 'Sample Product 1',
      title: 'High-Quality Sample Product',
      description: 'This is a sample product for demonstration purposes.',
      price: 29.99,
      shopId,
      shopName: 'Sample Shop',
      shopSlug: 'sample-shop',
      shopAutoId: 'sample-1',
      images: [],
      videos: [],
      specifications: [],
      reviews: [],
      variants: [],
      metadata: {
        tags: ['sample', 'demo'],
        categories: ['electronics'],
        condition: 'new',
        availability: 'in_stock',
        shipping: {
          weight: 1,
          dimensions: { length: 10, width: 10, height: 10, unit: 'cm' },
          freeShipping: false,
          shippingCost: 5.99,
          shippingTime: '3-5 days',
          shippingRegions: ['US', 'CA'],
          restrictions: []
        },
        returns: {
          accepted: true,
          period: 30,
          conditions: ['Unused', 'Original packaging'],
          restockingFee: 0,
          instructions: 'Return within 30 days of purchase'
        },
        seo: {
          title: 'Sample Product',
          description: 'A sample product for demonstration',
          keywords: ['sample', 'demo', 'product'],
          schemaType: 'Product',
          metaRobots: 'index,follow'
        },
        analytics: {
          views: 0,
          clicks: 0,
          addToCarts: 0,
          purchases: 0,
          conversionRate: 0,
          averageRating: 0,
          reviewCount: 0,
          searchRankings: {},
          popularInRegions: []
        }
      },
      featuredTypes: [],
      isShopExclusive: false,
      shopInventory: 100,
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ];

  return {
    products: mockProducts,
    total: mockProducts.length
  };
}

async function getMockProduct(productId: string): Promise<ShopProduct> {
  const mockProducts = await getMockProducts('sample-shop');
  const product = mockProducts.products.find(p => p.id === productId);
  
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  return product;
}
