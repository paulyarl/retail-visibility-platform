/**
 * Download Page Service - Singleton
 * 
 * Tenant-facing service for managing download pages
 * Uses AuthenticatedApiSingleton for secure tenant operations
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';

// Types
export interface DownloadPage {
  id: string;
  tenantId: string;
  itemId: string;
  slug: string;
  title: string;
  description?: string;
  
  // Page Configuration
  pageType: 'standard' | 'premium' | 'branded';
  customCss?: string;
  customJs?: string;
  logoUrl?: string;
  bannerUrl?: string;
  brandColor?: string;
  
  // Content
  instructions?: string;
  thankYouMessage?: string;
  supportEmail?: string;
  supportUrl?: string;
  
  // Access Control
  requireAuthentication: boolean;
  requirePurchaseVerification: boolean;
  accessExpires: boolean;
  accessDurationDays?: number;
  
  // Download Settings
  allowMultipleDownloads: boolean;
  downloadLimit?: number;
  downloadTracking: boolean;
  
  // Custom Access Control Overrides
  customDownloadLimit?: number;
  customAccessDurationDays?: number;
  
  // SEO & Metadata
  seoTitle?: string;
  seoDescription?: string;
  
  // Status
  status: 'draft' | 'active' | 'archived';
  publishedAt?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  
  // Relations
  item?: {
    id: string;
    name: string;
    sku: string;
    productType: string;
  };
  assets?: DigitalAsset[];
}

export interface DigitalAsset {
  id: string;
  tenantId: string;
  downloadPageId: string;
  itemId: string;
  
  // Asset Information
  assetName: string;
  assetType: 'file' | 'link' | 'license_key' | 'access_grant';
  filePath?: string;
  fileSize?: number;
  fileMimeType?: string;
  externalUrl?: string;
  licenseKeyTemplate?: string;
  
  // Download Configuration
  downloadMethod: 'direct' | 'email' | 'license_key' | 'external';
  requiresLicenseKey: boolean;
  licenseKeyGenerator?: string;
  
  // Access Control
  accessType: 'standard' | 'time_limited' | 'limited_downloads';
  maxDownloads?: number;
  expiryDays?: number;
  
  // Display
  displayOrder: number;
  isPrimary: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface CreateDownloadPageRequest {
  itemId: string;
  slug?: string;
  title: string;
  description?: string;
  pageType?: 'standard' | 'premium' | 'branded';
  customCss?: string;
  customJs?: string;
  logoUrl?: string;
  bannerUrl?: string;
  brandColor?: string;
  instructions?: string;
  thankYouMessage?: string;
  supportEmail?: string;
  supportUrl?: string;
  requireAuthentication?: boolean;
  requirePurchaseVerification?: boolean;
  accessExpires?: boolean;
  accessDurationDays?: number;
  allowMultipleDownloads?: boolean;
  downloadLimit?: number;
  downloadTracking?: boolean;
  customDownloadLimit?: number;
  customAccessDurationDays?: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface UpdateDownloadPageRequest extends Partial<CreateDownloadPageRequest> {
  status?: 'draft' | 'active' | 'archived';
}

export interface CreateDigitalAssetRequest {
  downloadPageId: string;
  assetName: string;
  assetType: 'file' | 'link' | 'license_key' | 'access_grant';
  filePath?: string;
  fileSize?: number;
  fileMimeType?: string;
  externalUrl?: string;
  licenseKeyTemplate?: string;
  downloadMethod?: 'direct' | 'email' | 'license_key' | 'external';
  requiresLicenseKey?: boolean;
  licenseKeyGenerator?: string;
  accessType?: 'standard' | 'time_limited' | 'limited_downloads';
  maxDownloads?: number;
  expiryDays?: number;
  displayOrder?: number;
  isPrimary?: boolean;
}

export interface UpdateDigitalAssetRequest extends Partial<CreateDigitalAssetRequest> {}

export interface DownloadPageListResponse {
  pages: DownloadPage[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DownloadPageStats {
  totalAccessGrants: number;
  activeAccessGrants: number;
  expiredAccessGrants: number;
  revokedAccessGrants: number;
  totalDownloadAttempts: number;
  successfulDownloads: number;
  failedDownloads: number;
  totalBytesDownloaded: number;
}

class DownloadPageService extends AuthenticatedApiSingleton {
  private static instance: DownloadPageService;

  private constructor() {
    super('download-page-service', {
      ttl: 10 * 60 * 1000, // 10 minutes
    });
  }

  static getInstance(): DownloadPageService {
    if (!DownloadPageService.instance) {
      DownloadPageService.instance = new DownloadPageService();
    }
    return DownloadPageService.instance;
  }

  /**
   * Extract error message from API response
   */
  private getErrorMessage(error: { status: number; message: string; code: string } | string | undefined, fallback: string): string {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    return error.message || fallback;
  }

  // =====================
  // Download Page CRUD
  // =====================

  /**
   * Create a new download page
   */
  async createDownloadPage(
    tenantId: string,
    data: CreateDownloadPageRequest
  ): Promise<DownloadPage> {
    const response = await this.makeAuthenticatedRequest<DownloadPage>(
      `/api/tenants/${tenantId}/download-pages`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      `download-page-create-${tenantId}-${data.itemId}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to create download page'));
    }

    // Invalidate list cache
    await this.invalidateCache(`download-pages-list-${tenantId}`);
    
    return response.data;
  }

  /**
   * Get download page by ID
   */
  async getDownloadPage(
    tenantId: string,
    pageId: string
  ): Promise<DownloadPage> {
    const response = await this.makeAuthenticatedRequest<DownloadPage>(
      `/api/tenants/${tenantId}/download-pages/${pageId}`,
      {},
      `download-page-${pageId}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch download page'));
    }

    return response.data;
  }

  /**
   * Get download page by item ID
   */
  async getDownloadPageByItem(
    tenantId: string,
    itemId: string
  ): Promise<DownloadPage | null> {
    const response = await this.makeAuthenticatedRequest<DownloadPage>(
      `/api/tenants/${tenantId}/download-pages/item/${itemId}`,
      {},
      `download-page-item-${itemId}`
    );

    if (!response.success) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch download page'));
    }

    return response.data || null;
  }

  /**
   * Get download page by slug
   */
  async getDownloadPageBySlug(
    tenantId: string,
    slug: string
  ): Promise<DownloadPage | null> {
    const response = await this.makeAuthenticatedRequest<DownloadPage>(
      `/api/tenants/${tenantId}/download-pages/slug/${slug}`,
      {},
      `download-page-slug-${slug}`
    );

    if (!response.success) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch download page'));
    }

    return response.data || null;
  }

  /**
   * List download pages
   */
  async listDownloadPages(
    tenantId: string,
    options?: {
      page?: number;
      pageSize?: number;
      status?: 'draft' | 'active' | 'archived';
      search?: string;
    }
  ): Promise<DownloadPageListResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options?.status) params.append('status', options.status);
    if (options?.search) params.append('search', options.search);

    const queryString = params.toString();
    const cacheKey = `download-pages-list-${tenantId}${queryString ? `-${queryString}` : ''}`;

    const response = await this.makeAuthenticatedRequest<DownloadPageListResponse>(
      `/api/tenants/${tenantId}/download-pages?${queryString}`,
      {},
      cacheKey
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch download pages'));
    }

    return response.data;
  }

  /**
   * Update download page
   */
  async updateDownloadPage(
    tenantId: string,
    pageId: string,
    data: UpdateDownloadPageRequest
  ): Promise<DownloadPage> {
    const response = await this.makeAuthenticatedRequest<DownloadPage>(
      `/api/tenants/${tenantId}/download-pages/${pageId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      `download-page-update-${pageId}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to update download page'));
    }

    // Invalidate caches
    await this.invalidateCache(`download-page-${pageId}`);
    await this.invalidateCache(`download-pages-list-${tenantId}`);
    
    return response.data;
  }

  /**
   * Delete download page
   */
  async deleteDownloadPage(
    tenantId: string,
    pageId: string
  ): Promise<void> {
    const response = await this.makeAuthenticatedRequest<void>(
      `/api/tenants/${tenantId}/download-pages/${pageId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.success) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to delete download page'));
    }

    // Invalidate caches
    await this.invalidateCache(`download-page-${pageId}`);
    await this.invalidateCache(`download-pages-list-${tenantId}`);
  }

  /**
   * Publish download page
   */
  async publishDownloadPage(
    tenantId: string,
    pageId: string
  ): Promise<DownloadPage> {
    return this.updateDownloadPage(tenantId, pageId, { status: 'active' });
  }

  /**
   * Unpublish download page
   */
  async unpublishDownloadPage(
    tenantId: string,
    pageId: string
  ): Promise<DownloadPage> {
    return this.updateDownloadPage(tenantId, pageId, { status: 'draft' });
  }

  /**
   * Get download page statistics
   */
  async getDownloadPageStats(
    tenantId: string,
    pageId: string
  ): Promise<DownloadPageStats> {
    const response = await this.makeAuthenticatedRequest<DownloadPageStats>(
      `/api/tenants/${tenantId}/download-pages/${pageId}/stats`,
      {},
      `download-page-stats-${pageId}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch download page stats'));
    }

    return response.data;
  }

  // =====================
  // Digital Assets CRUD
  // =====================

  /**
   * Create digital asset
   */
  async createDigitalAsset(
    tenantId: string,
    data: CreateDigitalAssetRequest
  ): Promise<DigitalAsset> {
    const response = await this.makeAuthenticatedRequest<DigitalAsset>(
      `/api/tenants/${tenantId}/digital-assets`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      `digital-asset-create-${data.downloadPageId}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to create digital asset'));
    }

    // Invalidate download page cache
    await this.invalidateCache(`download-page-${data.downloadPageId}`);
    
    return response.data;
  }

  /**
   * Get digital asset
   */
  async getDigitalAsset(
    tenantId: string,
    assetId: string
  ): Promise<DigitalAsset> {
    const response = await this.makeAuthenticatedRequest<DigitalAsset>(
      `/api/tenants/${tenantId}/digital-assets/${assetId}`,
      {},
      `digital-asset-${assetId}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch digital asset'));
    }

    return response.data;
  }

  /**
   * List digital assets for download page
   */
  async listDigitalAssets(
    tenantId: string,
    downloadPageId: string
  ): Promise<DigitalAsset[]> {
    const response = await this.makeAuthenticatedRequest<DigitalAsset[]>(
      `/api/tenants/${tenantId}/download-pages/${downloadPageId}/assets`,
      {},
      `digital-assets-${downloadPageId}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch digital assets'));
    }

    return response.data;
  }

  /**
   * Update digital asset
   */
  async updateDigitalAsset(
    tenantId: string,
    assetId: string,
    data: UpdateDigitalAssetRequest
  ): Promise<DigitalAsset> {
    const response = await this.makeAuthenticatedRequest<DigitalAsset>(
      `/api/tenants/${tenantId}/digital-assets/${assetId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      `digital-asset-update-${assetId}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to update digital asset'));
    }

    // Invalidate caches
    await this.invalidateCache(`digital-asset-${assetId}`);
    if (data.downloadPageId) {
      await this.invalidateCache(`digital-assets-${data.downloadPageId}`);
      await this.invalidateCache(`download-page-${data.downloadPageId}`);
    }
    
    return response.data;
  }

  /**
   * Delete digital asset
   */
  async deleteDigitalAsset(
    tenantId: string,
    assetId: string,
    downloadPageId: string
  ): Promise<void> {
    const response = await this.makeAuthenticatedRequest<void>(
      `/api/tenants/${tenantId}/digital-assets/${assetId}`,
      {
        method: 'DELETE',
      }
    );

    if (!response.success) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to delete digital asset'));
    }

    // Invalidate caches
    await this.invalidateCache(`digital-asset-${assetId}`);
    await this.invalidateCache(`digital-assets-${downloadPageId}`);
    await this.invalidateCache(`download-page-${downloadPageId}`);
  }

  /**
   * Reorder digital assets
   */
  async reorderDigitalAssets(
    tenantId: string,
    downloadPageId: string,
    assetIds: string[]
  ): Promise<DigitalAsset[]> {
    const response = await this.makeAuthenticatedRequest<DigitalAsset[]>(
      `/api/tenants/${tenantId}/download-pages/${downloadPageId}/assets/reorder`,
      {
        method: 'POST',
        body: JSON.stringify({ assetIds }),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to reorder digital assets'));
    }

    // Invalidate caches
    await this.invalidateCache(`digital-assets-${downloadPageId}`);
    await this.invalidateCache(`download-page-${downloadPageId}`);
    
    return response.data;
  }

  // =====================
  // File Upload Helpers
  // =====================

  /**
   * Generate upload URL for file asset
   */
  async generateUploadUrl(
    tenantId: string,
    fileName: string,
    mimeType: string
  ): Promise<{ uploadUrl: string; filePath: string }> {
    const response = await this.makeAuthenticatedRequest<{ uploadUrl: string; filePath: string }>(
      `/api/tenants/${tenantId}/digital-assets/upload-url`,
      {
        method: 'POST',
        body: JSON.stringify({ fileName, mimeType }),
      }
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to generate upload URL'));
    }

    return response.data;
  }

  /**
   * Confirm file upload completion
   */
  async confirmFileUpload(
    tenantId: string,
    filePath: string,
    fileSize: number
  ): Promise<void> {
    const response = await this.makeAuthenticatedRequest<void>(
      `/api/tenants/${tenantId}/digital-assets/confirm-upload`,
      {
        method: 'POST',
        body: JSON.stringify({ filePath, fileSize }),
      }
    );

    if (!response.success) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to confirm file upload'));
    }
  }

  // =====================
  // Utility Methods
  // =====================

  /**
   * Check if item has download page
   */
  async hasDownloadPage(tenantId: string, itemId: string): Promise<boolean> {
    const page = await this.getDownloadPageByItem(tenantId, itemId);
    return page !== null;
  }

  /**
   * Generate unique slug for download page
   */
  async generateUniqueSlug(
    tenantId: string,
    baseSlug: string
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await this.getDownloadPageBySlug(tenantId, slug);
      if (!existing) {
        return slug;
      }
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  /**
   * Validate download page data
   */
  validateDownloadPageData(data: CreateDownloadPageRequest): string[] {
    const errors: string[] = [];

    if (!data.itemId) {
      errors.push('Item ID is required');
    }

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (data.title && data.title.length > 255) {
      errors.push('Title must be less than 255 characters');
    }

    if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) {
      errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
    }

    if (data.accessExpires && !data.accessDurationDays) {
      errors.push('Access duration days is required when access expires is enabled');
    }

    if (data.downloadLimit !== undefined && data.downloadLimit < 1) {
      errors.push('Download limit must be at least 1');
    }

    return errors;
  }
}

// Export singleton instance
export const downloadPageService = DownloadPageService.getInstance();

// React hook for download page functionality
import { useState, useEffect } from 'react';

export function useDownloadPage(tenantId: string, pageId?: string) {
  const [page, setPage] = useState<DownloadPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPage = async () => {
      if (!pageId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await downloadPageService.getDownloadPage(tenantId, pageId);
        setPage(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load download page');
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [tenantId, pageId]);

  const createPage = async (data: CreateDownloadPageRequest) => {
    const newPage = await downloadPageService.createDownloadPage(tenantId, data);
    setPage(newPage);
    return newPage;
  };

  const updatePage = async (data: UpdateDownloadPageRequest) => {
    if (!page) throw new Error('No page to update');
    const updatedPage = await downloadPageService.updateDownloadPage(tenantId, page.id, data);
    setPage(updatedPage);
    return updatedPage;
  };

  const deletePage = async () => {
    if (!page) throw new Error('No page to delete');
    await downloadPageService.deleteDownloadPage(tenantId, page.id);
    setPage(null);
  };

  return {
    page,
    loading,
    error,
    createPage,
    updatePage,
    deletePage,
  };
}

export function useDigitalAssets(tenantId: string, downloadPageId?: string) {
  const [assets, setAssets] = useState<DigitalAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAssets = async () => {
      if (!downloadPageId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await downloadPageService.listDigitalAssets(tenantId, downloadPageId);
        setAssets(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load digital assets');
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, [tenantId, downloadPageId]);

  const createAsset = async (data: CreateDigitalAssetRequest) => {
    const newAsset = await downloadPageService.createDigitalAsset(tenantId, data);
    setAssets(prev => [...prev, newAsset]);
    return newAsset;
  };

  const updateAsset = async (assetId: string, data: UpdateDigitalAssetRequest) => {
    const updatedAsset = await downloadPageService.updateDigitalAsset(tenantId, assetId, data);
    setAssets(prev => prev.map(a => a.id === assetId ? updatedAsset : a));
    return updatedAsset;
  };

  const deleteAsset = async (assetId: string) => {
    if (!downloadPageId) throw new Error('No download page ID');
    await downloadPageService.deleteDigitalAsset(tenantId, assetId, downloadPageId);
    setAssets(prev => prev.filter(a => a.id !== assetId));
  };

  const reorderAssets = async (assetIds: string[]) => {
    if (!downloadPageId) throw new Error('No download page ID');
    const reorderedAssets = await downloadPageService.reorderDigitalAssets(tenantId, downloadPageId, assetIds);
    setAssets(reorderedAssets);
    return reorderedAssets;
  };

  return {
    assets,
    loading,
    error,
    createAsset,
    updateAsset,
    deleteAsset,
    reorderAssets,
  };
}

export default DownloadPageService;
