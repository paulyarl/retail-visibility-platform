/**
 * Public Download Service - Singleton
 * 
 * Customer-facing service for accessing download pages and downloading files
 * Uses PublicApiSingleton for public operations
 * Handles access token validation, download tracking, and license key activation
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { ResponseType } from '@/providers/base/FlexibleApiSingleton';

// Types
export interface PublicDownloadPage {
  id: string;
  slug: string;
  title: string;
  description?: string;
  
  // Branding
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
  accessExpires: boolean;
  accessDurationDays?: number;
  downloadLimit?: number;
  allowMultipleDownloads: boolean;
  
  // Item Info
  item: {
    id: string;
    name: string;
    productType: string;
    digitalDeliveryMethod: string;
  };
  
  // Assets (filtered based on access)
  assets: PublicDigitalAsset[];
}

export interface PublicDigitalAsset {
  id: string;
  assetName: string;
  assetType: 'file' | 'link' | 'license_key' | 'access_grant';
  fileSize?: number;
  externalUrl?: string;
  downloadMethod: 'direct' | 'email' | 'license_key' | 'external';
  requiresLicenseKey: boolean;
  displayOrder: number;
  isPrimary: boolean;
  
  // Access info (if available)
  accessType?: 'standard' | 'time_limited' | 'limited_downloads';
  maxDownloads?: number;
  expiryDays?: number;
}

export interface AccessGrantValidation {
  isValid: boolean;
  grantId: string;
  customerEmail: string;
  itemId: string;
  downloadPageId: string;
  
  // Access details
  status: 'active' | 'expired' | 'revoked' | 'exhausted';
  accessGrantedAt: string;
  accessExpiresAt?: string;
  maxDownloads?: number;
  downloadCount: number;
  remainingDownloads?: number;
  
  // License key info
  licenseKey?: string;
  licenseKeyActivatedAt?: string;
  
  // Download page info
  downloadPage: PublicDownloadPage;
}

export interface DownloadRequest {
  accessToken: string;
  assetId: string;
  customerEmail?: string;
}

export interface DownloadResponse {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  expiresIn?: number; // URL expiration in seconds
  error?: string;
}

export interface LicenseKeyActivationRequest {
  accessToken: string;
  licenseKey: string;
  customerEmail: string;
}

export interface LicenseKeyActivationResponse {
  success: boolean;
  grantId?: string;
  activatedAt?: string;
  error?: string;
}

export interface DownloadLogEntry {
  id: string;
  accessedAt: string;
  assetId: string;
  assetName: string;
  downloadSuccessful: boolean;
  downloadSize?: number;
  errorMessage?: string;
}

class PublicDownloadService extends PublicApiSingleton {
  private static instance: PublicDownloadService;

  private constructor() {
    super('public-download-service', {
      ttl: 5 * 60 * 1000, // 5 minutes for download data
    });
  }

  static getInstance(): PublicDownloadService {
    if (!PublicDownloadService.instance) {
      PublicDownloadService.instance = new PublicDownloadService();
    }
    return PublicDownloadService.instance;
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
  // Access Validation
  // =====================

  /**
   * Validate access token and get grant details
   */
  async validateAccessToken(accessToken: string): Promise<AccessGrantValidation> {
    const response = await this.makeDefaultRequest<AccessGrantValidation>(
      `/api/downloads/validate/${accessToken}`,
      {},
      `access-validation-${accessToken}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to validate access token'));
    }

    return response.data;
  }

  /**
   * Check if access token is valid (lightweight check)
   */
  async checkAccess(accessToken: string): Promise<{
    isValid: boolean;
    status: 'active' | 'expired' | 'revoked' | 'exhausted';
  }> {
    const response = await this.makeDefaultRequest<{
      isValid: boolean;
      status: 'active' | 'expired' | 'revoked' | 'exhausted';
    }>(
      `/api/downloads/check/${accessToken}`,
      {},
      `access-check-${accessToken}`
    );

    if (!response.success || !response.data) {
      return { isValid: false, status: 'revoked' };
    }

    return response.data;
  }

  /**
   * Validate access for tenant-scoped download page
   */
  async validateAccess(tenantId: string, slug: string, token: string): Promise<{
    granted: boolean;
    reason?: string;
    accessGrant?: {
      downloadCount: number;
      maxDownloads: number | null;
      expiresAt: string | null;
    };
  }> {
    const response = await this.makeDefaultRequest<{
      granted: boolean;
      reason?: string;
      accessGrant?: {
        downloadCount: number;
        maxDownloads: number | null;
        expiresAt: string | null;
      };
    }>(
      `/api/downloads/${tenantId}/${slug}/validate?token=${token}`,
      {},
      `access-validate-${tenantId}-${slug}-${token}`
    );

    return response.data || { granted: false, reason: 'VALIDATION_FAILED' };
  }

  /**
   * Record and initiate download for tenant-scoped download page
   */
  async recordDownload(tenantId: string, slug: string, token: string, assetId: string): Promise<{
    success: boolean;
    downloadUrl?: string;
    licenseKey?: string;
    error?: string;
  }> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      downloadUrl?: string;
      licenseKey?: string;
      error?: string;
    }>(
      `/api/downloads/${tenantId}/${slug}/download`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, assetId }),
      }
    );

    return response.data || { success: false, error: 'Download failed' };
  }

  // =====================
  // Download Page Access
  // =====================

  /**
   * Get download page by tenant and slug (tenant-scoped public access)
   */
  async getDownloadPage(tenantId: string, slug: string): Promise<{ success: boolean; data: PublicDownloadPage; error?: string }> {
    const response = await this.makeDefaultRequest<{ success: boolean; data: PublicDownloadPage; error?: string }>(
      `/api/downloads/${tenantId}/${slug}`,
      {},
      `download-page-${tenantId}-${slug}`
    );

    return response.data || { success: false, data: null as any, error: 'Failed to fetch download page' };
  }

  /**
   * Get download page by slug (public access)
   */
  async getDownloadPageBySlug(slug: string): Promise<PublicDownloadPage> {
    const response = await this.makeDefaultRequest<PublicDownloadPage>(
      `/api/downloads/page/${slug}`,
      {},
      `download-page-${slug}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch download page'));
    }

    return response.data;
  }

  /**
   * Get download page with access token
   */
  async getDownloadPageWithAccess(
    accessToken: string
  ): Promise<PublicDownloadPage> {
    const response = await this.makeDefaultRequest<PublicDownloadPage>(
      `/api/downloads/page/${accessToken}/details`,
      {},
      `download-page-access-${accessToken}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch download page'));
    }

    return response.data;
  }

  // =====================
  // File Downloads
  // =====================

  /**
   * Request file download
   */
  async requestDownload(request: DownloadRequest): Promise<DownloadResponse> {
    const response = await this.makeDefaultRequest<DownloadResponse>(
      `/api/downloads/request`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error: this.getErrorMessage(response.error, 'Failed to request download'),
      };
    }

    return response.data;
  }

  /**
   * Get download URL for asset
   */
  async getDownloadUrl(
    accessToken: string,
    assetId: string
  ): Promise<string> {
    const response = await this.requestDownload({
      accessToken,
      assetId,
    });

    if (!response.success || !response.downloadUrl) {
      throw new Error(response.error || 'Failed to get download URL');
    }

    return response.downloadUrl;
  }

  /**
   * Download file directly (returns blob)
   */
  async downloadFile(
    accessToken: string,
    assetId: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const downloadUrl = await this.getDownloadUrl(accessToken, assetId);
    
    // Fetch the file with progress tracking
    const response = await fetch(downloadUrl, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Stream the response for progress tracking
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedBytes += value.length;
      
      if (onProgress && totalBytes > 0) {
        onProgress((receivedBytes / totalBytes) * 100);
      }
    }

    // Combine chunks into blob
    const blob = new Blob(chunks as BlobPart[]);
    return blob;
  }

  /**
   * Download file with streaming response for progress tracking
   * Uses ResponseType.STREAM for platform architecture alignment
   */
  async downloadFileWithProgress(
    downloadUrl: string,
    onProgress?: (progress: number, loadedBytes: number, totalBytes: number) => void
  ): Promise<Blob> {
    // Use service request with STREAM response type
    const response = await this.makeDefaultRequest<ReadableStream<Uint8Array>>(
      downloadUrl,
      {
        method: 'GET',
      },
      `download-stream-${Date.now()}`,
      0, // No cache for downloads
      {
        responseType: ResponseType.STREAM,
      }
    );

    if (!response.success || !response.data) {
      throw new Error('Failed to initiate download stream');
    }

    const stream = response.data;
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    let totalBytes = 0;

    // Try to get content-length from metadata if available
    const contentLength = response.status ? undefined : 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      receivedBytes += value.length;
      
      if (onProgress) {
        // Calculate progress (we may not know total, so pass both values)
        const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;
        onProgress(progress, receivedBytes, totalBytes);
      }
    }

    // Combine chunks into blob
    const blob = new Blob(chunks as BlobPart[]);
    return blob;
  }

  /**
   * Download from URL with access token and progress tracking
   * Used by DownloadProgress component for binary file downloads
   */
  async downloadFromUrl(
    url: string,
    accessToken: string,
    options?: {
      onProgress?: (progress: number, loadedBytes: number, totalBytes: number) => void;
      expectedSize?: number;
    }
  ): Promise<{ blob: Blob; totalSize: number }> {
    // Build URL with token
    const urlWithToken = url.includes('?') 
      ? `${url}&token=${accessToken}` 
      : `${url}?token=${accessToken}`;

    // Use service request with STREAM response type
    const response = await this.makeDefaultRequest<ReadableStream<Uint8Array>>(
      urlWithToken,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      },
      `download-${Date.now()}`,
      0, // No cache for downloads
      {
        responseType: ResponseType.STREAM,
      }
    );

    if (!response.success) {
      const status = response.status;
      if (status === 403) {
        throw new Error('Access denied. Your download link may have expired.');
      } else if (status === 404) {
        throw new Error('File not found.');
      }
      throw new Error('Download failed. Please try again.');
    }

    if (!response.data) {
      throw new Error('Unable to read response stream');
    }

    const stream = response.data;
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    const totalBytes = options?.expectedSize || 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      chunks.push(value);
      receivedBytes += value.length;

      if (options?.onProgress) {
        const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;
        options.onProgress(progress, receivedBytes, totalBytes);
      }
    }

    // Combine chunks into blob
    const blob = new Blob(chunks as BlobPart[]);
    return { blob, totalSize: receivedBytes };
  }

  /**
   * Trigger browser download
   */
  async triggerDownload(
    accessToken: string,
    assetId: string,
    fileName?: string
  ): Promise<void> {
    const blob = await this.downloadFile(accessToken, assetId);
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // =====================
  // License Key Management
  // =====================

  /**
   * Activate license key
   */
  async activateLicenseKey(
    request: LicenseKeyActivationRequest
  ): Promise<LicenseKeyActivationResponse> {
    const response = await this.makeDefaultRequest<LicenseKeyActivationResponse>(
      `/api/downloads/license/activate`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        error: this.getErrorMessage(response.error, 'Failed to activate license key'),
      };
    }

    return response.data;
  }

  /**
   * Validate license key
   */
  async validateLicenseKey(
    licenseKey: string,
    itemId?: string
  ): Promise<{
    isValid: boolean;
    productId?: string;
    productName?: string;
    expiresAt?: string;
  }> {
    const params = new URLSearchParams();
    if (itemId) params.append('itemId', itemId);

    const response = await this.makeDefaultRequest<{
      isValid: boolean;
      productId?: string;
      productName?: string;
      expiresAt?: string;
    }>(
      `/api/downloads/license/validate/${licenseKey}?${params.toString()}`,
      {},
      `license-validate-${licenseKey}`
    );

    if (!response.success || !response.data) {
      return { isValid: false };
    }

    return response.data;
  }

  // =====================
  // Download History
  // =====================

  /**
   * Get download history for access token
   */
  async getDownloadHistory(
    accessToken: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    logs: DownloadLogEntry[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const response = await this.makeDefaultRequest<{
      logs: DownloadLogEntry[];
      total: number;
    }>(
      `/api/downloads/history/${accessToken}?${params.toString()}`,
      {},
      `download-history-${accessToken}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch download history'));
    }

    return response.data;
  }

  /**
   * Get download statistics
   */
  async getDownloadStats(accessToken: string): Promise<{
    totalDownloads: number;
    remainingDownloads?: number;
    lastDownloadAt?: string;
    accessExpiresAt?: string;
    daysRemaining?: number;
  }> {
    const response = await this.makeDefaultRequest<{
      totalDownloads: number;
      remainingDownloads?: number;
      lastDownloadAt?: string;
      accessExpiresAt?: string;
      daysRemaining?: number;
    }>(
      `/api/downloads/stats/${accessToken}`,
      {},
      `download-stats-${accessToken}`
    );

    if (!response.success || !response.data) {
      throw new Error(this.getErrorMessage(response.error, 'Failed to fetch download stats'));
    }

    return response.data;
  }

  // =====================
  // Utility Methods
  // =====================

  /**
   * Check if download is available
   */
  async isDownloadAvailable(
    accessToken: string,
    assetId: string
  ): Promise<boolean> {
    try {
      const validation = await this.validateAccessToken(accessToken);
      
      if (validation.status !== 'active') {
        return false;
      }

      // Check if asset exists in download page
      const asset = validation.downloadPage.assets.find(a => a.id === assetId);
      return !!asset;
    } catch {
      return false;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Calculate time remaining until expiration
   */
  getTimeRemaining(expiresAt: string): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } {
    const now = new Date().getTime();
    const expiration = new Date(expiresAt).getTime();
    const diff = expiration - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, isExpired: false };
  }
}

// Export singleton instance
export const publicDownloadService = PublicDownloadService.getInstance();

// React hook for download page functionality
import { useState, useEffect } from 'react';

export function usePublicDownloadPage(slug?: string) {
  const [page, setPage] = useState<PublicDownloadPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPage = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await publicDownloadService.getDownloadPageBySlug(slug);
        setPage(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load download page');
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [slug]);

  return { page, loading, error };
}

export function useAccessValidation(accessToken?: string) {
  const [validation, setValidation] = useState<AccessGrantValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validate = async () => {
      if (!accessToken) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await publicDownloadService.validateAccessToken(accessToken);
        setValidation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to validate access');
      } finally {
        setLoading(false);
      }
    };

    validate();
  }, [accessToken]);

  const refresh = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      const data = await publicDownloadService.validateAccessToken(accessToken);
      setValidation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate access');
    } finally {
      setLoading(false);
    }
  };

  return { validation, loading, error, refresh };
}

export function useDownload() {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const download = async (accessToken: string, assetId: string, fileName?: string) => {
    setDownloading(true);
    setProgress(0);
    setError(null);

    try {
      await publicDownloadService.triggerDownload(accessToken, assetId, fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      throw err;
    } finally {
      setDownloading(false);
      setProgress(100);
    }
  };

  const downloadWithProgress = async (
    accessToken: string,
    assetId: string,
    fileName?: string
  ) => {
    setDownloading(true);
    setProgress(0);
    setError(null);

    try {
      const blob = await publicDownloadService.downloadFile(
        accessToken,
        assetId,
        (p) => setProgress(p)
      );

      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
      throw err;
    } finally {
      setDownloading(false);
    }
  };

  return {
    download,
    downloadWithProgress,
    downloading,
    progress,
    error,
  };
}

export function useLicenseKeyActivation() {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activate = async (
    accessToken: string,
    licenseKey: string,
    customerEmail: string
  ): Promise<LicenseKeyActivationResponse> => {
    setActivating(true);
    setError(null);

    try {
      const result = await publicDownloadService.activateLicenseKey({
        accessToken,
        licenseKey,
        customerEmail,
      });

      if (!result.success) {
        setError(result.error || 'Activation failed');
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Activation failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setActivating(false);
    }
  };

  return { activate, activating, error };
}

export default PublicDownloadService;
