/**
 * Items Singleton Service
 *
 * Extends AuthenticatedApiSingleton to provide cached items operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { platformDashboardService } from './PlatformDashboardSingletonService';
import { clientTenantContextManager } from '@/lib/clientTenantContext';
import { ResponseType } from '@/providers/base/FlexibleApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  mpn?: string; // Manufacturer Part Number
  condition?: 'new' | 'used' | 'refurbished' | 'brand_new';
  price: number | null;
  price_cents?: number; // Price in cents for internal calculations
  priceCents?: number; // CamelCase alias
  sale_price?: number | null; // Sale price in dollars for display
  sale_price_cents?: number; // Sale price in cents for internal calculations
  salePriceCents?: number; // CamelCase alias
  stock: number;
  status: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed';
  itemStatus?: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed'; // Backend field name
  item_status?: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed'; // Snake case version for backend
  visibility: 'public' | 'private';
  categoryPath?: string[];
  category_path?: string[]; // Snake case alias
  tenantCategoryId?: string | null;
  directory_category_id?: string | null; // Snake case alias
  tenantId?: string; // Tenant ID for the item
  tenantCategory?: {
    id: string;
    name: string;
    slug?: string;
    googleCategoryId?: string | null;
  };
  imageUrl?: string;
  image_url?: string; // Snake case alias
  images?: string[];
  imageGallery?: any[]; // Gallery images
  image_gallery?: any[]; // Snake case alias
  photoCount?: number; // Number of photos for this item
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
  // Marketing content fields
  marketing_description?: string;
  features?: string[];
  specifications?: Record<string, string>;
  videoUrl?: string;
  // Featured fields
  is_featured?: boolean;
  featured_priority?: number;
  featured_type?: string;
  // New fields for variants and digital products
  has_variants?: boolean;
  variants?: ProductVariant[]; // Variants array from complete endpoint
  product_variants?: ProductVariant[]; // Snake case alias
  default_variant_id?: string;
  product_type?: 'physical' | 'digital' | 'hybrid';
  digital_delivery_method?: 'direct_download' | 'external_link' | 'license_key' | 'access_grant';
  digital_assets?: any[];
  license_type?: 'personal' | 'commercial' | 'educational' | 'enterprise';
  access_duration_days?: number;
  download_limit?: number;
  payment_gateway_type?: string;
  payment_gateway_id?: string;
}

// Product variant interface (matches API response)
export interface ProductVariant {
  id: string;
  parent_item_id: string;
  tenant_id: string;
  variant_name: string;
  sku: string;
  price_cents: number;
  sale_price_cents?: number | null;
  stock: number;
  image_url?: string | null;
  attributes?: Record<string, string>;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemsStats {
  total: number;
  active: number;
  inactive: number;
  syncing: number;
  public: number;
  private: number;
  lowStock: number;
}

export interface ItemsPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ItemsCompleteResponse {
  items: Item[];
  stats: ItemsStats;
  pagination: ItemsPagination;
  _timestamp: string;
}

export interface ItemsCompleteParams {
  tenant_id: string;
  page?: number;
  limit?: number;
  q?: string;
  status?: 'all' | 'active' | 'inactive' | 'syncing' | 'draft' | 'archived' | 'trashed';
  visibility?: 'all' | 'public' | 'private';
  categoryId?: string;
  categoryFilter?: 'assigned' | 'unassigned';
}

class ItemsSingletonService extends TenantApiSingleton {
  private static instance: ItemsSingletonService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'items-singleton*',
      'inventory-items*',
      'item-details*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('items-singleton*');
    await this.invalidateCachePattern('inventory-items*');
    await this.invalidateCachePattern('item-details*');
  }

  private constructor() {
    super('items-singleton', {
      ttl: 15 * 60 * 1000 // 15 minutes for items data (moderate cache)
    });
  }

  public static getInstance(): ItemsSingletonService {
    if (!ItemsSingletonService.instance) {
      ItemsSingletonService.instance = new ItemsSingletonService();
    }
    return ItemsSingletonService.instance;
  }

  /**
   * Get complete items data with caching
   * Uses the /api/items/complete endpoint
   */
  async getItemsComplete(params: ItemsCompleteParams): Promise<ItemsCompleteResponse | null> {
    // Build query string
    const queryParams = new URLSearchParams();
    queryParams.append('tenant_id', params.tenant_id);
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.q) queryParams.append('q', params.q);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.visibility && params.visibility !== 'all') queryParams.append('visibility', params.visibility);
    if (params.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params.categoryFilter) queryParams.append('categoryFilter', params.categoryFilter);

    const queryString = queryParams.toString();
    // Use tenant-aware cache key on client-side, basic on server-side
    const cacheKey = typeof window !== 'undefined' 
      ? clientTenantContextManager.getTenantAwareCacheKey(`items_complete_${queryString}`)
      : `items_complete_${queryString}`;

    const endpoint = `/api/items/complete?${queryString}`;
    
    const result = await this.makeDefaultRequest<ItemsCompleteResponse>(endpoint, {}, cacheKey);

    if (!result.success) {
      clientLogger.error('[ItemsSingleton] Failed to get items complete:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Get items by ID with caching
   */
  async getItem(itemId: string): Promise<Item | null> {
    const result = await this.makeDefaultRequest<Item>(
      `/api/items/${itemId}`,
      {},
      `item-${itemId}`
    );

    if (!result.success) {
      clientLogger.error('[ItemsSingleton] Failed to get item:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Create new item
   * Note: This will invalidate relevant cache entries
   */
  async createItem(itemData: Partial<Item>, tenantId?: string): Promise<Item | null> {
    const result = await this.makeDefaultRequest<Item>(
      '/api/items',
      {
        method: 'POST',
        body: JSON.stringify(itemData),
      },
      'items-create'
    );

    if (!result.success) {
      clientLogger.error('[ItemsSingleton] Failed to create item:', { detail: result.error });
      return null;
    }

    // Invalidate items complete cache for this tenant
    const targetTenantId = tenantId || itemData.tenantCategoryId || 'unknown';
    await this.invalidateCache(`items_complete_tenant_${targetTenantId}*`);
    
    // Invalidate platform dashboard cache since items affect stats
    await platformDashboardService.invalidateStatsCache();
    
    // If this is a digital item, invalidate digital items cache
    if (itemData.product_type === 'digital' && targetTenantId !== 'unknown') {
      const { digitalDownloadPagesService } = await import('./DigitalDownloadPagesSingletonService');
      await digitalDownloadPagesService.invalidateServiceCaches(targetTenantId);
    }
    
    return result.data || null;
  }

  /**
   * Update existing item
   * Note: This will invalidate relevant cache entries
   */
  async updateItem(itemId: string, itemData: Partial<Item>, tenantId?: string): Promise<Item | null> {
    const result = await this.makeDefaultRequest<Item>(
      `/api/items/${itemId}`,
      {
        method: 'PUT',
        body: JSON.stringify(itemData),
      },
      `item-update-${itemId}`
    );

    if (!result.success) {
      clientLogger.error('[ItemsSingleton] Failed to update item:', { detail: result.error });
      return null;
    }

    // Invalidate items complete cache for this tenant
    const targetTenantId = tenantId || itemData.tenantCategoryId || 'unknown';
    await this.invalidateCache(`items_complete_tenant_${targetTenantId}*`);
    
    // Invalidate platform dashboard cache since items affect stats
    await platformDashboardService.invalidateStatsCache();
    
    return result.data || null;
  }

  /**
   * Upload a single photo for an item
   * Uses the /api/items/:itemId/photos endpoint
   */
  async uploadPhoto(itemId: string, photoData: {
    tenantId: string;
    dataUrl: string;
    contentType: string;
    variant_id?: string | null;
  }): Promise<any> {
    if (!itemId) {
      throw new Error('Item ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/items/${itemId}/photos`,
      {
        method: 'POST',
        body: JSON.stringify(photoData)
      },
      `item-upload-photo-${itemId}`
    );

    if (!result.success) {
      clientLogger.error('[ItemsSingleton] Failed to upload photo:', { detail: result.error });
      throw result.error;
    }

    return result.data;
  }

  /**
   * Upload a temporary photo to Supabase (not linked to an item yet)
   * Used during item creation wizard to avoid localStorage quota issues
   * Returns { id, url, path, contentType, bytes }
   */
  async uploadTempPhoto(photoData: {
    tenantId: string;
    dataUrl: string;
  }): Promise<{ id: string; url: string; path: string; contentType: string; bytes: number }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/items/photos/temp`,
      {
        method: 'POST',
        body: JSON.stringify(photoData)
      },
      `temp-photo-upload-${Date.now()}`
    );

    if (!result.success) {
      clientLogger.error('[ItemsSingleton] Failed to upload temp photo:', { detail: result.error });
      throw result.error;
    }

    return result.data;
  }

  /**
   * Upload a digital asset file for digital products
   * Uses the /api/digital-assets/upload endpoint
   * Returns { asset: { id, file_path, file_size_bytes, mime_type } }
   */
  async uploadDigitalAsset(params: {
    tenantId: string;
    itemId: string;
    fileName: string;
    mimeType: string;
    fileData: string; // Base64 encoded file data
  }): Promise<{
    success: boolean;
    asset?: {
      id: string;
      file_path: string;
      file_size_bytes?: number;
      mime_type?: string;
    };
    error?: string;
  }> {
    const result = await this.makeDefaultRequest<{
      success: boolean;
      asset?: {
        id: string;
        file_path: string;
        file_size_bytes?: number;
        mime_type?: string;
      };
      error?: string;
    }>(
      '/api/digital-assets/upload',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      `digital-asset-upload-${params.itemId}-${Date.now()}`,
      0 // No cache for uploads
    );

    return result.data || { success: false, error: 'Upload failed' };
  }

  /**
   * Search for stock images from Unsplash/Pexels
   * Uses the /api/v1/images/search endpoint
   */
  async searchImages(query: string): Promise<{
    images: Array<{
      id: string;
      url: string;
      thumbnail: string;
      description: string;
      photographer: string;
      photographerUrl: string;
      source: 'unsplash' | 'pexels';
      downloadUrl: string;
    }>;
  }> {
    const result = await this.makeDefaultRequest<{
      images: Array<{
        id: string;
        url: string;
        thumbnail: string;
        description: string;
        photographer: string;
        photographerUrl: string;
        source: 'unsplash' | 'pexels';
        downloadUrl: string;
      }>;
    }>(
      `/api/v1/images/search?query=${encodeURIComponent(query)}`,
      {
        method: 'GET',
      },
      `image-search-${query}`,
      5 * 60 * 1000 // 5 minute cache
    );

    return result.data || { images: [] };
  }

  /**
   * Attach an external image to an item
   * Uses the /api/v1/tenants/:tenantId/items/:itemId/attach-image endpoint
   */
  async attachImage(itemId: string, tenantId: string, imageData: {
    imageUrl: string;
    source: string;
    photographer: string;
    photographerUrl: string;
  }): Promise<{ success: boolean; error?: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; error?: string }>(
      `/api/v1/tenants/${tenantId}/items/${itemId}/attach-image`,
      {
        method: 'POST',
        body: JSON.stringify(imageData),
      },
      `attach-image-${itemId}`,
      0 // No cache for mutations
    );

    return result.data || { success: false, error: 'Failed to attach image' };
  }

  /**
   * Delete a temporary photo from Supabase storage
   * Used when user removes a photo during wizard before item creation
   * @param path - The exact path returned from uploadTempPhoto
   */
  async deleteTempPhoto(path: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<any>(
      `/api/items/photos/temp`,
      {
        method: 'DELETE',
        body: JSON.stringify({ path })
      },
      `temp-photo-delete-${Date.now()}`
    );

    if (!result.success) {
      clientLogger.error('[ItemsSingleton] Failed to delete temp photo:', { detail: result.error });
      return false;
    }

    return result.data?.success ?? true;
  }

  /**
   * Upload photos for an item
   * Note: This will invalidate relevant cache entries
   */
  async uploadPhotos(itemId: string, files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));

    const result = await this.makeDefaultRequest<any>(
      `/api/items/${itemId}/photos`,
      {
        method: 'POST',
        body: formData,
      },
      `item-upload-photos-${itemId}`
    );

    if (!result.success) {
      clientLogger.error('[ItemsSingleton] Failed to upload photos:', { detail: result.error });
      throw result.error;
    }

    // Invalidate items complete cache for this tenant
    await this.invalidateCache(`items_complete_*`);
    
    return result.data?.urls || [];
  }

  /**
   * Get photos for an item
   */
  async getPhotos(itemId: string): Promise<any> {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items/${itemId}/photos`,
        {},
        `item-photos-${itemId}`,
        15 * 60 * 1000 // 15 minutes
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to get photos:', { detail: result.error });
        throw result.error;
      }

      return result;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to get photos:', { detail: error });
      throw error;
    }
  }

  /**
   * Set primary photo for an item
   * Uses the /api/items/:itemId/photos/:photoId endpoint
   */
  async setPrimaryPhoto(itemId: string, photoId: string): Promise<any> {
    try {
      if (!itemId || !photoId) {
        throw new Error('Item ID and Photo ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items/${itemId}/photos/${photoId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ position: 0 })
        },
        `item-set-primary-photo-${itemId}-${photoId}`
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to set primary photo:', { detail: result.error });
        throw result.error;
      }

      return result;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to set primary photo:', { detail: error });
      throw error;
    }
  }

  /**
   * Delete photo for an item
   * Uses the /api/items/:itemId/photos/:photoId endpoint
   */
  async deletePhoto(itemId: string, photoId: string): Promise<any> {
    try {
      if (!itemId || !photoId) {
        throw new Error('Item ID and Photo ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items/${itemId}/photos/${photoId}`,
        {
          method: 'DELETE'
        },
        `item-delete-photo-${itemId}-${photoId}`
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to delete photo:', { detail: result.error });
        throw result.error;
      }

      return result;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to delete photo:', { detail: error });
      throw error;
    }
  }

  /**
   * Migrate legacy photos for an item
   * Uses the /api/items/:itemId/photos/migrate-legacy endpoint
   */
  async migrateLegacyPhotos(itemId: string): Promise<any> {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items/${itemId}/photos/migrate-legacy`,
        {
          method: 'POST',
          body: JSON.stringify({})
        },
        `item-migrate-photos-${itemId}`
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to migrate legacy photos:', { detail: result.error });
        throw result.error;
      }

      return result;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to migrate legacy photos:', { detail: error });
      throw error;
    }
  }

  /**
   * Update photo metadata
   * Uses the /api/items/:itemId/photos/:photoId endpoint
   */
  async updatePhoto(itemId: string, photoId: string, photoData: {
    alt?: string | null;
    caption?: string | null;
  }): Promise<any> {
    try {
      if (!itemId || !photoId) {
        throw new Error('Item ID and Photo ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items/${itemId}/photos/${photoId}`,
        {
          method: 'PUT',
          body: JSON.stringify(photoData)
        },
        `item-update-photo-${itemId}-${photoId}`
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to update photo:', { detail: result.error });
        throw result.error;
      }

      return result;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to update photo:', { detail: error });
      throw error;
    }
  }

  /**
   * Get trash capacity for a tenant
   */
  async getTrashCapacity(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/trash/capacity?tenantId=${tenantId}`,
        {},
        `items-trash-capacity-${tenantId}`,
        5 * 60 * 1000 // 5 minutes for capacity data
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to get trash capacity:', { detail: result.error });
        throw result.error;
      }

      return result;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to get trash capacity:', { detail: error });
      throw error;
    }
  }

  /**
   * Get trashed items for a tenant
   */
  async getTrashedItems(tenantId: string, limit: number = 100): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items?tenantId=${tenantId}&status=trashed&limit=${limit}`,
        {},
        `items-trashed-${tenantId}-${limit}`,
        5 * 60 * 1000 // 5 minutes for trash data
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to get trashed items:', { detail: result.error });
        throw result.error;
      }

      return result;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to get trashed items:', { detail: error });
      throw error;
    }
  }

  /**
   * Restore a trashed item
   */
  async restoreItem(itemId: string): Promise<void> {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const result = await this.makeDefaultRequest<void>(
        `/api/items/${itemId}/restore`,
        { method: 'PATCH' },
        `item-restore-${itemId}`
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to restore item:', { detail: result.error });
        throw result.error;
      }
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to restore item:', { detail: error });
      throw error;
    }
  }

  /**
   * Purge a trashed item
   */
  async purgeItem(itemId: string): Promise<void> {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const result = await this.makeDefaultRequest<void>(
        `/api/items/${itemId}/purge`,
        { method: 'DELETE' },
        `item-purge-${itemId}`
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to purge item:', { detail: result.error });
        throw result.error;
      }
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to purge item:', { detail: error });
      throw error;
    }
  }

  /**
   * Empty all trash
   */
  async emptyTrash(tenantId: string, itemIds: string[]): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const results = await Promise.all(itemIds.map(itemId => 
        this.makeDefaultRequest<void>(
          `/api/items/${itemId}/purge`,
          { method: 'DELETE' },
          `item-purge-${itemId}`
        )
      ));
      if (!results.every(result => result?.success)) {
        throw new Error('Failed to empty trash');
      }
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to empty trash:', { detail: error });
      throw error;
    }
  }

  /**
   * Get user's accessible tenants
   */
  async getUserTenants(): Promise<any> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/user/tenants',
        {},
        'user-tenants-list',
        10 * 60 * 1000 // 10 minutes
      );

      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to get user tenants:', { detail: result.error });
        throw result.error;
      }

      return result.data;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to get user tenants:', { detail: error });
      throw error;
    }
  }

  /**
   * Get my scan sessions for a tenant
   */
  async getMyScanSessions(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/scan/my-sessions?tenantId=${tenantId}`,
        {},
        `items-my-scan-sessions-${tenantId}`,
        10 * 60 * 1000 // 10 minutes for scan sessions
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to get my scan sessions:', { detail: result.error });
        throw result.error;
      }

      return result?.data;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to get my scan sessions:', { detail: error });
      throw error;
    }
  }

  /**
   * Start a new scan session
   */
  async startScanSession(tenantId: string, deviceType: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        '/api/scan/start',
        { 
          method: 'POST',
          body: JSON.stringify({
            tenantId,
            deviceType
          })
        },
        `items-start-scan-session-${tenantId}`
      );

      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to start scan session:', { detail: result.error });
        throw result.error;
      }

      return result.data;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to start scan session:', { detail: error });
      throw error;
    }
  }

  /**
   * Cancel a scan session
   */
  async cancelScanSession(sessionId: string): Promise<void> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const result = await this.makeDefaultRequest<void>(
        `/api/scan/${sessionId}`,
        { method: 'DELETE' },
        `items-cancel-scan-session-${sessionId}`
      );
      if (!result?.success){
        clientLogger.error('[ItemsSingleton] Failed to cancel scan session:', { detail: result.error });
        throw result.error;
      }
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to cancel scan session:', { detail: error });
      throw error;
    }
  }

  /**
   * Get a specific scan session
   */
  async getScanSession(sessionId: string): Promise<any> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/scan/${sessionId}`,
        {},
        `items-get-scan-session-${sessionId}`,
        10 * 60 * 1000 // 10 minutes
      );

      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to get scan session:', { detail: result.error });
        throw result.error;
      }

      return result; // Return full result, not just data
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to get scan session:', { detail: error });
      throw error;
    }
  }

  /**
   * Lookup barcode information
   */
  async lookupBarcode(sessionId: string, barcode: string): Promise<any> {
    try {
      if (!sessionId || !barcode) {
        throw new Error('Session ID and barcode are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/scan/${sessionId}/lookup-barcode`,
        { 
          method: 'POST',
          body: JSON.stringify({ barcode })
        },
        `items-lookup-barcode-${sessionId}-${barcode}`,
        5 * 60 * 1000 // 5 minutes
      );

      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to lookup barcode:', { detail: result.error });
        throw result.error;
      }

      return result;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to lookup barcode:', { detail: error });
      throw error;
    }
  }

  /**
   * Update scan result enrichment
   */
  async updateScanResult(sessionId: string, resultId: string, enrichment: any): Promise<any> {
    try {
      if (!sessionId || !resultId) {
        throw new Error('Session ID and Result ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/scan/${sessionId}/results/${resultId}/enrichment`,
        { 
          method: 'PATCH',
          body: JSON.stringify(enrichment)
        },
        `items-update-scan-result-${sessionId}-${resultId}`
      );

      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to update scan result:', { detail: result.error });
        throw result.error;
      }

      return result.data;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to update scan result:', { detail: error });
      throw error;
    }
  }

  /**
   * Remove scan result
   */
  async removeScanResult(sessionId: string, resultId: string): Promise<any> {
    try {
      if (!sessionId || !resultId) {
        throw new Error('Session ID and Result ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/scan/${sessionId}/results/${resultId}`,
        { method: 'DELETE' },
        `items-remove-scan-result-${sessionId}-${resultId}`
      );

      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to remove scan result:', { detail: result.error });
        throw result.error;
      }

      return result.data;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to remove scan result:', { detail: error });
      throw error;
    }
  }

  /**
   * Commit scan session
   */
  async commitScanSession(sessionId: string, skipValidation: boolean = false): Promise<any> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/scan/${sessionId}/commit`,
        { 
          method: 'POST',
          body: JSON.stringify({ skipValidation })
        },
        `items-commit-scan-session-${sessionId}`
      );

      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to commit scan session:', { detail: result.error });
        throw result.error;
      }

      return result.data;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to commit scan session:', { detail: error });
      throw error;
    }
  }

  /**
   * Cleanup my scan sessions
   */
  async cleanupMyScanSessions(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const results = await this.makeDefaultRequest<void>(
        '/api/scan/cleanup-my-sessions',
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        `items-cleanup-scan-sessions-${tenantId}`
      );
      if (!results?.success) {
        clientLogger.error('[ItemsSingleton] Failed to cleanup scan sessions:', { detail: results.error });
        throw results.error;
      }
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to cleanup scan sessions:', { detail: error });
      throw error;
    }
  }

  /**
   * Delete item
   * Note: This will invalidate relevant cache entries
   */
  async deleteItem(itemId: string, tenantId?: string): Promise<boolean> {
    try {
      // First get the item to determine its tenant for cache invalidation
      const item = await this.getItem(itemId);
      const targetTenantId = tenantId || item?.tenantCategoryId || 'unknown';

      const result = await this.makeDefaultRequest<{ success: boolean }>(
        `/api/items/${itemId}`,
        {
          method: 'DELETE',
        },
        `item-delete-${itemId}`
      );
      if (!result?.success) {
        clientLogger.error('[ItemsSingleton] Failed to delete item:', { detail: result.error });
        throw result.error;
      }

      // Invalidate items complete cache for this tenant
      await this.invalidateCache(`items_complete_tenant_${targetTenantId}*`);
      
      // Invalidate platform dashboard cache since items affect stats
      await platformDashboardService.invalidateStatsCache();

      return result.success || false;
    } catch (error) {
      clientLogger.error('[ItemsSingleton] Failed to delete item:', { detail: error });
      return false;
    }
  }

  /**
   * Invalidate items complete cache by tenant
   */
  public async invalidateItemsCompleteCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`items_complete_tenant_${tenantId}*`);
  }

}

// Export the class for extension
export { ItemsSingletonService };

// Export singleton instance
export const itemsSingletonService = ItemsSingletonService.getInstance();

// Export alias for backward compatibility
export const itemsService = itemsSingletonService;

// Export cache invalidation helper for external use
export const invalidateItemsCache = async (tenantId: string): Promise<void> => {
  const service = ItemsSingletonService.getInstance();
  await service.invalidateCache(`items_complete_tenant_${tenantId}*`);
};
