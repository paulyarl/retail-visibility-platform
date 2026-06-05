/**
 * Product Data Service
 * 
 * Provides cached product data operations for public product pages
 * Extends PublicApiSingleton for public product data access
 */

import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface Product {
  id: string;
  sku: string;
  name: string;
  title: string;
  brand: string;
  manufacturer?: string;
  description?: string;
  price: number;
  currency: string;
  priceCents: number;
  stock: number;
  imageUrl?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  itemStatus?: 'active' | 'inactive' | 'draft' | 'archived';
  visibility?: 'public' | 'private';
  categoryPath?: string[];
  condition?: string;
  gtin?: string;
  mpn?: string;
  tenantId: string;
  product_slug?: string; // New product slug field for simplified availability
  tenant?: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier?: string;
    city?: string;
    state?: string;
  };
  createdAt: string;
  updatedAt: string;
  
  // Category assignment
  tenantCategoryId?: string | null;
  tenantCategory?: {
    id: string;
    name: string;
    slug: string;
    googleCategoryId?: string | null;
  } | null;
  
  // Enriched barcode data
  upc?: string;
  
  // Nutrition & dietary
  nutritionFacts?: {
    servingSize?: string;
    calories?: number;
    totalFat?: string;
    saturatedFat?: string;
    transFat?: string;
    cholesterol?: string;
    sodium?: string;
    totalCarbohydrate?: string;
    dietaryFiber?: string;
    sugars?: string;
    protein?: string;
    [key: string]: any;
  };
  allergens?: string[];
  ingredients?: string;
  dietaryInfo?: string[];
  nutriScore?: string;
  
  // Physical attributes
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  weight?: {
    value?: number;
    unit?: string;
  };
  
  // Additional specs
  specifications?: Record<string, any>;
  environmentalInfo?: string[];
  
  // Tier-based landing page fields
  marketingDescription?: string;
  imageGallery?: string[];
  customCta?: {
    text: string;
    link: string;
    style?: string;
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  customBranding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  customSections?: Array<{
    type: string;
    title: string;
    content: string;
  }>;
  landingPageTheme?: string;
  hasActivePaymentGateway?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  subscriptionTier?: string;
  hasActivePaymentGateway?: boolean;
  metadata?: {
    businessName?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string;
    logo_url?: string;
    social_links?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      linkedin?: string;
    };
  };
}

/**
 * Product Data Service
 * 
 * Handles product data fetching and tenant profile operations
 * for public product pages with proper caching
 */
class ProductDataService extends PublicApiSingleton {
  private static instance: ProductDataService;

  private constructor() {
    super('product-data-service', { encrypt: false });
  }

  public static getInstance(): ProductDataService {
    if (!ProductDataService.instance) {
      ProductDataService.instance = new ProductDataService();
    }
    return ProductDataService.instance;
  }

  /**
   * Fetch product data by ID
   */
  async fetchProduct(id: string): Promise<any> {
    try {
      const cachekey = `product-data-${id}`;
      console.log(`[ProductDataService] cachekey: ${cachekey}`);
      const response = await this.makeDefaultRequest<any>(
        `/api/public/products/${id}?include=variants,metadata,analytics,store`,
        {},
        cachekey,
        this.cacheTTL,{
          context: AppContext.PRODUCT,
          isolation: CacheIsolation.PRODUCT,
        }
      );
      
      if (!response.success) {
        console.error('[ProductDataService] Failed to fetch product:', response.error);
        return null;
      }

      const productData = response.data.data; // Fixed: product data is nested
      // console.log(`[ProductDataService] productData: ${JSON.stringify(productData)}`);
      // console.log(`[ProductDataService] productData: ${JSON.stringify(productData)}`);
      return productData;
    } catch (error) {
      console.error('[ProductDataService] Error in fetchProduct:', error);
      throw new Error(`Failed to fetch product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch tenant profile by tenant ID
   */
  async fetchTenantProfile(tenantId: string): Promise<any> {
    try {
      const cachekey = `tenant-profile-${tenantId}`;
      const response = await this.makeDefaultRequest<any>(
        `/api/public/tenant/${tenantId}/profile`,
        {},
        cachekey,
        this.cacheTTL
      );
      
      if (!response.success) {
        console.error('[ProductDataService] Failed to fetch tenant profile:', response.error);
        return null;
      }

      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to fetch tenant profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch directory entry by tenant slug
   */
  async fetchDirectoryEntry(tenantSlug: string): Promise<any> {
    const response = await this.makeDefaultRequest<any>(
      `/api/directory/${tenantSlug}`,
      {},
      `directory-entry-${tenantSlug}`,
      this.cacheTTL
    );
    
    if (!response.success) {
      throw new Error(`Failed to fetch directory entry: ${response.error || 'Unknown error'}`);
    }
    
    return response.data;
  }

  /**
   * Get complete product data with tenant information
   */
  async getProductWithTenant(id: string): Promise<{ product: Product; tenant: Tenant | null; storeStatus?: any; directorySlug?: string } | null> {
    try {
      // Fetch product
      const productData = await this.fetchProduct(id);
      
      if (!productData) {
        console.error('Product data is null');
        return null;
      }
      
      // Extract enriched fields from direct columns first, fallback to metadata for backward compatibility
      const metadata = productData.metadata || {};
      const enrichedFields: any = {};
      
      // Extract AI-generated enriched content from direct columns or metadata
      if (productData.enhanced_description || metadata.enhancedDescription) {
        enrichedFields.marketingDescription = productData.enhanced_description || metadata.enhancedDescription;
      }
      if ((productData.features && Array.isArray(productData.features)) || (metadata.features && Array.isArray(metadata.features))) {
        enrichedFields.environmentalInfo = productData.features || metadata.features; // Reuse environmentalInfo for features display
      }
      if ((productData.specifications && typeof productData.specifications === 'object') || (metadata.specifications && typeof metadata.specifications === 'object')) {
        enrichedFields.specifications = {
          ...(productData.specifications || {}),
          ...(metadata.specifications || {})
        };
      }
      
      // Normalize field names from snake_case to camelCase
      const product: Product = {
        ...productData,
        ...enrichedFields,
        itemStatus: productData.itemStatus || productData.item_status || 'active',
        tenantId: productData.tenantId || productData.tenant_id,
        tenantCategoryId: productData.tenantCategoryId || productData.directory_category_id || null,
        tenantCategory: productData.tenantCategory || null,
        condition: productData.condition === 'brand_new' ? 'new' : productData.condition,
      };

      // Fetch tenant info and business profile using public endpoint
      let tenant: Tenant | null = null;
      let storeStatus = 'unknown';
      
      if (product.tenant?.id) {
        try {
          const profileData = await this.fetchTenantProfile(product.tenant.id);
          
          // Transform to match expected Tenant interface
          tenant = {
            id: product.tenant.id,
            name: profileData.name || 'Unknown Store',
            subscriptionTier: profileData.subscriptionTier,
            hasActivePaymentGateway: productData.hasActivePaymentGateway || false,
            metadata: {
              businessName: profileData.businessName,
              phone: profileData.phone,
              email: profileData.email,
              website: profileData.website,
              address: profileData.address,
              logo_url: profileData.logo_url,
              social_links: profileData.social_links,
            },
          };
          
          // Extract store hours for status calculation
          const { computeStoreStatus } = await import('../lib/hours-utils');
          const statusResult = computeStoreStatus(profileData.hours);
          storeStatus = statusResult?.status || 'unknown';
        } catch (e) {
          console.warn('Failed to fetch tenant profile:', e);
        }
      }
      
      // Fetch directory publish status (optional for public pages)
      let directoryPublished = false;
      let tenantSlug: string | null = null;
      if (tenant?.metadata?.businessName) {
        tenantSlug = tenant.metadata.businessName?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        try {
          await this.fetchDirectoryEntry(tenantSlug);
          // If the directory page exists, the store is published
          directoryPublished = true;
        } catch (e) {
          // Directory page doesn't exist or error - store is not published
          directoryPublished = false;
        }
      }
      
      let returnSlang: string | undefined;
      
      if (directoryPublished && tenantSlug) {
        returnSlang = tenantSlug;
      } else {
        returnSlang = undefined;
      }
      
      return { product, tenant, storeStatus, directorySlug: returnSlang };
    } catch (error) {
      console.error('Error fetching product:', error);
      return null;
    }
  }
}

// Export singleton instance
export const productDataService = ProductDataService.getInstance();
export default productDataService;
