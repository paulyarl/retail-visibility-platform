/**
 * Digital Asset Service
 * Manages digital product assets including file uploads, signed URLs, and access control
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface DigitalAsset {
  id: string;
  name: string;
  type: 'file' | 'link' | 'license_key';
  storage_method: 'platform' | 'external';
  file_path?: string;        // For platform-hosted files
  external_url?: string;     // For external links
  file_size_bytes?: number;
  mime_type?: string;
  description?: string;
  version?: string;
  created_at: string;
}

export interface UploadResult {
  asset: DigitalAsset;
  upload_url?: string;  // For direct uploads
}

export class DigitalAssetService {
  private supabase: SupabaseClient;
  private bucketName = 'digital-products';

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Generate a unique asset ID
   */
  private generateAssetId(): string {
    return `asset_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate a secure access token for downloads
   */
  generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Upload a file to Supabase Storage
   * @param tenantId - Tenant ID
   * @param productId - Product ID
   * @param file - File buffer
   * @param fileName - Original file name
   * @param mimeType - MIME type
   */
  async uploadFile(
    tenantId: string,
    productId: string,
    file: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<DigitalAsset> {
    const assetId = this.generateAssetId();
    const fileExtension = fileName.split('.').pop() || '';
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${tenantId}/${productId}/${assetId}_${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      console.error('[DigitalAsset] Upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    const asset: DigitalAsset = {
      id: assetId,
      name: fileName,
      type: 'file',
      storage_method: 'platform',
      file_path: filePath,
      file_size_bytes: file.length,
      mime_type: mimeType,
      created_at: new Date().toISOString(),
    };

    return asset;
  }

  /**
   * Create an external link asset (Dropbox, Google Drive, etc.)
   */
  createExternalLinkAsset(
    url: string,
    name: string,
    description?: string
  ): DigitalAsset {
    const assetId = this.generateAssetId();

    return {
      id: assetId,
      name,
      type: 'link',
      storage_method: 'external',
      external_url: url,
      description,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Create a license key asset
   */
  createLicenseKeyAsset(
    name: string,
    description?: string
  ): DigitalAsset {
    const assetId = this.generateAssetId();

    return {
      id: assetId,
      name,
      type: 'license_key',
      storage_method: 'platform',
      description,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Generate a signed URL for downloading a file
   * @param filePath - Path to file in storage
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   */
  async generateSignedUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('[DigitalAsset] Signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    if (!data?.signedUrl) {
      throw new Error('No signed URL returned from Supabase');
    }

    return data.signedUrl;
  }

  /**
   * Validate that an asset exists
   */
  async validateAsset(filePath: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(filePath.split('/').slice(0, -1).join('/'));

      if (error) {
        console.error('[DigitalAsset] Validation error:', error);
        return false;
      }

      const fileName = filePath.split('/').pop();
      return data?.some(file => file.name === fileName) || false;
    } catch (error) {
      console.error('[DigitalAsset] Validation error:', error);
      return false;
    }
  }

  /**
   * Delete an asset from storage
   */
  async deleteAsset(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([filePath]);

    if (error) {
      console.error('[DigitalAsset] Delete error:', error);
      throw new Error(`Failed to delete asset: ${error.message}`);
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath: string): Promise<{
    size: number;
    mimeType: string;
    lastModified: string;
  } | null> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(filePath.split('/').slice(0, -1).join('/'));

      if (error) {
        console.error('[DigitalAsset] Metadata error:', error);
        return null;
      }

      const fileName = filePath.split('/').pop();
      const file = data?.find(f => f.name === fileName);

      if (!file) return null;

      return {
        size: file.metadata?.size || 0,
        mimeType: file.metadata?.mimetype || 'application/octet-stream',
        lastModified: file.updated_at || file.created_at,
      };
    } catch (error) {
      console.error('[DigitalAsset] Metadata error:', error);
      return null;
    }
  }

  /**
   * Generate a unique license key
   */
  generateLicenseKey(prefix: string = 'LIC'): string {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return `${prefix}-${segments.join('-')}`;
  }

  /**
   * Check if storage bucket exists and is accessible
   */
  async checkBucketAccess(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list('', { limit: 1 });

      return !error;
    } catch (error) {
      console.error('[DigitalAsset] Bucket access check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const digitalAssetService = new DigitalAssetService();
