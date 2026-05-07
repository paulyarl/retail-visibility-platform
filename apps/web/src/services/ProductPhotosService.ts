/**
 * Product Photos Service
 * 
 * Provides cached product photos operations for public product pages
 * Extends PublicApiSingleton for public product photos access
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export type Photo = {
  url: string;
  alt?: string | null;
  caption?: string | null;
  position: number;
};

/**
 * Product Photos Service
 * 
 * Handles product photos fetching with proper caching
 */
class ProductPhotosService extends PublicApiSingleton {
  private static instance: ProductPhotosService;

  private constructor() {
    super('product-photos-service', { encrypt: false });
  }

  public static getInstance(): ProductPhotosService {
    if (!ProductPhotosService.instance) {
      ProductPhotosService.instance = new ProductPhotosService();
    }
    return ProductPhotosService.instance;
  }

  /**
   * Fetch product photos by product ID
   */
  async fetchProductPhotos(id: string): Promise<Photo[]> {
    try {
      const data = await this.makeDefaultRequest<any>(
        `/api/items/${id}/photos`,
        {},
        `product-photos-${id}`,
        this.cacheTTL
      );
      
      if (!data.success) {
        console.warn(`Failed to fetch product photos: ${data.error || 'Unknown error'}`);
        return [];
      }
      
      return (data.data || []).map((p: any) => ({
        url: p.url,
        alt: p.alt,
        caption: p.caption,
        position: p.position ?? 0,
      }));
    } catch (error) {
      console.warn(`Failed to fetch product photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Get product photos from product data or fetch from API
   */
  async getProductPhotos(productData: any): Promise<Photo[]> {
    try {
      // Handle EnhancedProduct format (from mv_global_discovery)
      if (productData.image_urls && Array.isArray(productData.image_urls) && productData.image_urls.length > 0) {
        return productData.image_urls.map((url: string, index: number) => ({
          url,
          alt: productData.product_title || null,
          caption: null,
          position: index,
        }));
      }
      
      // Use images from the product data (already fetched from /public/products/:id)
      if (productData.images && Array.isArray(productData.images)) {
        return productData.images.map((img: any) => ({
          url: img.url,
          alt: img.alt || null,
          caption: null,
          position: img.position ?? 0,
        }));
      }
      
      // Single image fallback
      if (productData.image_url) {
        return [{
          url: productData.image_url,
          alt: productData.product_title || productData.title || null,
          caption: null,
          position: 0,
        }];
      }
      
      // Fallback: try photos endpoint (for backward compatibility)
      const id = productData.inventory_item_id || productData.id;
      if (id) {
        return await this.fetchProductPhotos(id);
      }
      
      return [];
    } catch (error) {
      console.warn('Error fetching product photos:', error);
      return [];
    }
  }
}

// Export singleton instance
export const productPhotosService = ProductPhotosService.getInstance();
export default ProductPhotosService;
