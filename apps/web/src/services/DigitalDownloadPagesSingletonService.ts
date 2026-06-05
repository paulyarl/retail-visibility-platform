/**
 * Digital Download Pages Singleton Service
 * 
 * Tenant-scoped service for managing digital download pages
 * Extends TenantApiSingleton for automatic authentication and caching
 * 
 * Features:
 * - CRUD operations for download pages
 * - Asset management and reordering
 * - Preview token generation
 * - Template application
 * - Automatic caching and invalidation
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientTenantContextManager } from '@/lib/clientTenantContext';
import { ResponseType } from '@/providers/base/FlexibleApiSingleton';

// Type definitions
export interface DownloadPage {
  id: string;
  tenant_id: string;
  item_id: string;
  slug: string;
  title: string;
  description?: string;
  page_type: string;
  custom_css?: string;
  custom_js?: string;
  logo_url?: string;
  banner_url?: string;
  brand_color?: string;
  instructions?: string;
  thank_you_message?: string;
  support_email?: string;
  support_url?: string;
  require_authentication: boolean;
  require_purchase_verification: boolean;
  access_expires: boolean;
  access_duration_days?: number;
  allow_multiple_downloads: boolean;
  download_limit?: number;
  download_tracking: boolean;
  custom_download_limit?: number;
  custom_access_duration_days?: number;
  seo_title?: string;
  seo_description?: string;
  status: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Variant information
  variant_id?: string;
  variant_name?: string;
  variant_attributes?: Record<string, any>;
  // Joined data
  item?: {
    id: string;
    name: string;
    product_type: string;
  };
  // Joined item data
  inventory_items?: {
    id: string;
    name: string;
    product_type: string;
  };
}

export interface DownloadPageAsset {
  id: string;
  tenant_id: string;
  download_page_id: string;
  item_id: string;
  asset_name: string;
  asset_type: string;
  file_path?: string;
  file_size?: bigint;
  file_mime_type?: string;
  external_url?: string;
  license_key_template?: string;
  download_method: string;
  requires_license_key: boolean;
  license_key_generator?: string;
  access_type: string;
  max_downloads?: number;
  expiry_days?: number;
  display_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDownloadPageDto {
  itemId: string;
  title: string;
  description?: string;
  instructions?: string;
  thankYouMessage?: string;
  supportEmail?: string;
  supportUrl?: string;
  brandColor?: string;
  requireAuthentication?: boolean;
  accessExpires?: boolean;
  accessDurationDays?: number;
  downloadLimit?: number;
  allowMultipleDownloads?: boolean;
  status?: 'draft' | 'published';
}

export interface UpdateDownloadPageDto extends Partial<CreateDownloadPageDto> {
  slug?: string;
  logoUrl?: string;
  bannerUrl?: string;
  customCss?: string;
  customJs?: string;
  pageType?: string;
  requirePurchaseVerification?: boolean;
  downloadTracking?: boolean;
  customDownloadLimit?: number;
  customAccessDurationDays?: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface GetPagesParams {
  page?: number;
  limit?: number;
  status?: 'all' | 'draft' | 'published' | 'archived';
  search?: string;
}

export interface GetPagesResult {
  pages: DownloadPage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats: {
    total: number;
    draft: number;
    published: number;
    archived: number;
  };
}

export interface PreviewTokenResult {
  previewToken: string;
  previewUrl: string;
  expiresAt: string;
}

export interface UploadAssetResult {
  asset: DownloadPageAsset;
  uploadUrl?: string;
}

class DigitalDownloadPagesSingletonService extends TenantApiSingleton {
  private static instance: DigitalDownloadPagesSingletonService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'digital-download-pages*',
      'download-page-*',
      'download-page-assets-*',
      'tenant-download-pages-*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('digital-download-pages*');
    await this.invalidateCachePattern('digital-items*');
    if (tenantId) {
      await this.invalidateCachePattern(`tenant-download-pages-${tenantId}*`);
      await this.invalidateCachePattern(`digital-items-${tenantId}`);
    }
  }

  private constructor() {
    super('digital-download-pages-singleton', {
      ttl: 15 * 60 * 1000 // 15 minutes for download pages data
    });
  }

  /**
   * Get all download pages for a tenant
   */
  public async getDownloadPages(
    tenantId: string,
    params: GetPagesParams = {}
  ): Promise<GetPagesResult> {
    // Build query string
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.status) queryParams.append('status', params.status);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const cacheKey = typeof window !== 'undefined' 
      ? clientTenantContextManager.getTenantAwareCacheKey(`download_pages_${queryString}`)
      : `download_pages_${queryString}`;

    const endpoint = `/api/tenants/${tenantId}/digital-download-pages${queryString ? `?${queryString}` : ''}`;
    
    const result = await this.makeDefaultRequest<GetPagesResult>(endpoint, {}, cacheKey);

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch download pages');
    }

    const responseData = result.data as any;
    return (responseData?.data ?? responseData) as GetPagesResult;
  }

  /**
   * Get a specific download page
   */
  public async getDownloadPage(tenantId: string, pageId: string): Promise<DownloadPage | null> {
    const cacheKey = `download-page-${pageId}`;
    
    const result = await this.makeDefaultRequest<DownloadPage>(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}`,
      {},
      cacheKey
    );

    if (!result.success) {
      const errorMsg = typeof result.error === 'string' ? result.error : 'Failed to fetch download page';
      if (errorMsg.includes('not found')) {
        return null;
      }
      throw new Error(errorMsg);
    }

    const responseData = result.data as any;
    console.log(`[DigitalDownloadPagesSingletonService] getDownloadPage response:`, responseData);
    return (responseData?.data ?? responseData) as DownloadPage;
  }

  /**
   * Create a new download page
   */
  public async createDownloadPage(
    tenantId: string,
    data: CreateDownloadPageDto
  ): Promise<DownloadPage> {
    // Invalidate relevant caches
    await this.invalidateServiceCaches(tenantId);

    const result = await this.makeDefaultRequest<DownloadPage>(
      `/api/tenants/${tenantId}/digital-download-pages`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      }
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create download page');
    }

    const responseData = result.data as any;
    console.log(`[DigitalDownloadPagesSingletonService] createDownloadPage response:`, responseData);
    return (responseData?.data ?? responseData) as DownloadPage;
  }

  /**
   * Update a download page
   */
  public async updateDownloadPage(
    tenantId: string,
    pageId: string,
    data: UpdateDownloadPageDto
  ): Promise<DownloadPage> {
    // Invalidate relevant caches
    await this.invalidateServiceCaches(tenantId);
    await this.invalidateCache(`download-page-${pageId}`);

    const result = await this.makeDefaultRequest<DownloadPage>(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      }
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update download page');
    }

    const responseData = result.data as any;
    return (responseData?.data ?? responseData) as DownloadPage;
  }

  /**
   * Delete a download page
   */
  public async deleteDownloadPage(tenantId: string, pageId: string): Promise<void> {
    // Invalidate relevant caches
    await this.invalidateServiceCaches(tenantId);
    await this.invalidateCache(`download-page-${pageId}`);

    const result = await this.makeDefaultRequest(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}`,
      {
        method: 'DELETE'
      }
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete download page');
    }
  }

  /**
   * Generate a preview token for testing
   */
  public async generatePreviewToken(
    tenantId: string,
    pageId: string,
    expiresInHours: number = 2
  ): Promise<PreviewTokenResult> {
    const result = await this.makeDefaultRequest<PreviewTokenResult>(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}/preview-token`,
      {
        method: 'POST',
        body: JSON.stringify({ expiresInHours })
      }
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to generate preview token');
    }

    const responseData = result.data as any;
    return (responseData?.data ?? responseData) as PreviewTokenResult;
  }

  /**
   * Get all assets for a download page
   */
  public async getPageAssets(tenantId: string, pageId: string): Promise<DownloadPageAsset[]> {
    const result = await this.makeDefaultRequest<DownloadPageAsset[]>(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}/assets?_t=${Date.now()}`,
      {},
      `page-assets-${pageId}`
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch page assets');
    }

    return result.data || [];
  }

  /**
   * Add an asset to a download page
   */
  public async addPageAsset(tenantId: string, pageId: string, data: {
    assetName: string;
    assetType: string;
    filePath?: string;
    fileSize?: number;
    fileMimeType?: string;
    externalUrl?: string;
    downloadMethod?: string;
    requiresLicenseKey?: boolean;
    variantId?: string;
  }): Promise<DownloadPageAsset> {
    const result = await this.makeDefaultRequest<DownloadPageAsset>(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}/assets`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      },
      `page-assets-${pageId}`
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to add page asset');
    }

    // Invalidate cache
    this.invalidateServiceCaches();

    return result.data!;
  }

  /**
   * Update an asset
   */
  public async updatePageAsset(tenantId: string, pageId: string, assetId: string, data: Partial<{
    assetName: string;
    assetType: string;
    filePath?: string;
    fileSize?: number;
    fileMimeType?: string;
    externalUrl?: string;
    downloadMethod?: string;
    requiresLicenseKey?: boolean;
    variantId?: string;
  }>): Promise<DownloadPageAsset> {
    const result = await this.makeDefaultRequest<DownloadPageAsset>(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}/assets/${assetId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      },
      `page-assets-${pageId}`
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update page asset');
    }

    // Invalidate cache
    this.invalidateServiceCaches();

    return result.data!;
  }

  /**
   * Delete an asset
   */
  public async deletePageAsset(tenantId: string, pageId: string, assetId: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}/assets/${assetId}`,
      {
        method: 'DELETE'
      },
      `page-assets-${pageId}`
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete page asset');
    }

    // Invalidate cache
    this.invalidateServiceCaches();
  }

  /**
   * Reorder assets on a download page
   */
  public async reorderPageAssets(
    tenantId: string,
    pageId: string,
    assetIds: string[]
  ): Promise<void> {
    // Invalidate assets cache
    await this.invalidateCache(`download-page-assets-${pageId}`);

    const result = await this.makeDefaultRequest(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}/assets/reorder`,
      {
        method: 'PUT',
        body: JSON.stringify({ assetIds })
      }
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to reorder assets');
    }
  }

  /**
   * Get download page by item ID
   */
  public async getDownloadPageByItem(tenantId: string, itemId: string): Promise<DownloadPage | null> {
    // First try to get from cache
    const cacheKey = `download-page-by-item-${itemId}`;
    
    const result = await this.getDownloadPages(tenantId, { 
      status: 'all', 
      limit: 100 // Reasonable limit for search
    });
    
    const page = result.pages.find(p => p.item_id === itemId);
    
    if (page) {
      // Cache the found page
      await this.setCache(cacheKey, page, { ttl: 300000 }); // 5 minutes
      return page;
    }
    
    return null;
  }

  /**
   * Upload an asset to a download page
   */
  public async uploadAsset(
    tenantId: string,
    pageId: string,
    file: File
  ): Promise<UploadAssetResult> {
    // Invalidate assets cache
    await this.invalidateCache(`download-page-assets-${pageId}`);

    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pageId', pageId);

    const result = await this.makeDefaultRequest<UploadAssetResult>(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}/assets`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to upload asset');
    }

    return result.data;
  }

  /**
   * Add an external link asset
   */
  public async addExternalLinkAsset(
    tenantId: string,
    pageId: string,
    name: string,
    url: string,
    description?: string
  ): Promise<DownloadPageAsset> {
    // Invalidate assets cache
    await this.invalidateCache(`download-page-assets-${pageId}`);

    const result = await this.makeDefaultRequest<DownloadPageAsset>(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}/assets`,
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          url,
          description,
          type: 'external_link'
        })
      }
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to add external link asset');
    }

    return result.data;
  }

  /**
   * Delete an asset
   */
  public async deleteAsset(tenantId: string, pageId: string, assetId: string): Promise<void> {
    // Invalidate assets cache
    await this.invalidateCache(`download-page-assets-${pageId}`);

    const result = await this.makeDefaultRequest(
      `/api/tenants/${tenantId}/digital-download-pages/${pageId}/assets/${assetId}`,
      {
        method: 'DELETE'
      }
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to delete asset');
    }
  }

  /**
   * Apply default template to a download page
   */
  public async applyDefaultTemplate(tenantId: string, pageId: string): Promise<DownloadPage> {
    // Get tenant info for template
    const tenant = await clientTenantContextManager.getCurrentTenantId();
    
    const template = {
      instructions: `Thank you for your purchase! Your digital files are ready for download below. If you have any issues accessing your files, please don't hesitate to contact our support team.`,
      thankYouMessage: `Enjoy your digital purchase! We hope you love your new files.`,
      supportEmail: 'support@example.com',
      brandColor: '#3B82F6',
      requireAuthentication: true,
      requirePurchaseVerification: true,
      allowMultipleDownloads: true,
      downloadTracking: true
    };

    return this.updateDownloadPage(tenantId, pageId, template);
  }

  /**
   * Duplicate a download page (useful for similar products)
   */
  public async duplicateDownloadPage(
    tenantId: string,
    pageId: string,
    newTitle: string,
    newItemId: string
  ): Promise<DownloadPage> {
    const originalPage = await this.getDownloadPage(tenantId, pageId);
    if (!originalPage) {
      throw new Error('Original page not found');
    }

    const duplicateData: CreateDownloadPageDto = {
      itemId: newItemId,
      title: newTitle,
      description: originalPage.description,
      instructions: originalPage.instructions,
      thankYouMessage: originalPage.thank_you_message,
      supportEmail: originalPage.support_email,
      supportUrl: originalPage.support_url,
      brandColor: originalPage.brand_color,
      requireAuthentication: originalPage.require_authentication,
      accessExpires: originalPage.access_expires,
      accessDurationDays: originalPage.access_duration_days,
      allowMultipleDownloads: originalPage.allow_multiple_downloads,
      downloadLimit: originalPage.download_limit,
      status: 'draft' // Always start as draft
    };

    const newPage = await this.createDownloadPage(tenantId, duplicateData);

    // Copy assets if needed
    const assets = await this.getPageAssets(tenantId, pageId);
    for (const asset of assets) {
      if (asset.asset_type === 'external_link' && asset.external_url) {
        await this.addExternalLinkAsset(
          tenantId,
          newPage.id,
          asset.asset_name,
          asset.external_url,
          asset.asset_name
        );
      }
      // Note: File assets would need to be copied separately as they involve actual file storage
    }

    return newPage;
  }

  /**
   * Get download page statistics
   */
  public async getDownloadPageStats(tenantId: string, pageId: string): Promise<{
    totalDownloads: number;
    uniqueVisitors: number;
    conversionRate: number;
    popularAssets: Array<{
      assetId: string;
      assetName: string;
      downloadCount: number;
    }>;
  }> {
    const result = await this.makeDefaultRequest<{
      totalDownloads: number;
      uniqueVisitors: number;
      conversionRate: number;
      popularAssets: Array<{
        assetId: string;
        assetName: string;
        downloadCount: number;
      }>;
    }>(
      `/tenants/${tenantId}/digital-download-pages/${pageId}/stats`,
      {}
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch download page stats');
    }

    return result.data;
  }

  /**
   * Get digital items for a tenant (used when creating download pages)
   */
  public async getDigitalItems(tenantId: string): Promise<Array<{ id: string; name: string; product_type?: string }>> {
    const result = await this.makeDefaultRequest<Array<{ id: string; name: string; product_type?: string }>>(
      `/api/tenants/${tenantId}/digital-download-pages/digital-items?_t=${Date.now()}`,
      {},
      `digital-items-${tenantId}`
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch digital items');
    }

    const responseData = result.data as any;
    return (responseData?.data ?? responseData) as Array<{ id: string; name: string; product_type?: string }>;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DigitalDownloadPagesSingletonService {
    if (!DigitalDownloadPagesSingletonService.instance) {
      DigitalDownloadPagesSingletonService.instance = new DigitalDownloadPagesSingletonService();
    }
    return DigitalDownloadPagesSingletonService.instance;
  }
}

// Export singleton instance
export const digitalDownloadPagesService = DigitalDownloadPagesSingletonService.getInstance();
