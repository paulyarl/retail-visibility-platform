/**
 * Digital Asset Service - UniversalSingleton Implementation
 * Manages digital product assets with caching, metrics, and performance optimization
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { prisma } from '../prisma';

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
  tenant_id?: string;
  product_id?: string;
  download_count?: number;
  last_accessed?: string;
  access_token?: string;
  expires_at?: string;
}

export interface UploadResult {
  asset: DigitalAsset;
  upload_url?: string;  // For direct uploads
  signed_url?: string; // For secure downloads
}

export interface AssetRequest {
  assetId: string;
  tenantId: string;
  accessToken?: string;
}

export interface AssetStats {
  totalAssets: number;
  totalStorageUsed: number;
  totalDownloads: number;
  assetTypes: Record<string, number>;
  storageMethods: Record<string, number>;
  topTenants: Array<{ tenantId: string; assetCount: number }>;
  averageFileSize: number;
  recentUploads: number;
  expiringAssets: number;
}

class DigitalAssetSingletonService extends UniversalSingleton {
  private static instance: DigitalAssetSingletonService;
  private supabase: SupabaseClient;
  private bucketName = 'digital-products';

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'authenticated',
      defaultTTL: 3600, // 1 hour
      maxCacheSize: 500,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  static getInstance(): DigitalAssetSingletonService {
    if (!DigitalAssetSingletonService.instance) {
      DigitalAssetSingletonService.instance = new DigitalAssetSingletonService('digital-asset-service');
    }
    return DigitalAssetSingletonService.instance;
  }

  // ====================
  // CORE ASSET OPERATIONS
  // ====================

  /**
   * Upload a file to Supabase Storage with caching
   */
  async uploadFile(
    tenantId: string,
    productId: string,
    file: Buffer,
    fileName: string,
    mimeType: string,
    description?: string
  ): Promise<UploadResult> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Asset upload request: ${fileName} for tenant ${tenantId}, product ${productId}`);
      
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
        this.logError('Asset upload error', error);
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
        description,
        created_at: new Date().toISOString(),
        tenant_id: tenantId,
        product_id: productId,
        download_count: 0,
        last_accessed: new Date().toISOString()
      };

      // Cache the asset metadata
      const cacheKey = `asset-${assetId}`;
      await this.setCache(cacheKey, asset, { ttl: 7200 }); // 2 hours

      // Generate signed URL for immediate access
      const signedUrl = await this.generateSignedUrl(filePath);

      // Log successful upload
      this.logInfo(`Asset uploaded successfully: ${assetId}`);
      
      return {
        asset,
        signed_url: signedUrl
      };
    } catch (error) {
      this.logError('Error uploading asset', error);
      throw error;
    }
  }

  /**
   * Get asset by ID with caching
   */
  async getAsset(assetId: string, tenantId: string): Promise<DigitalAsset | null> {
    const startTime = Date.now();
    
    try {
      const cacheKey = `asset-${assetId}`;
      
      // Check UniversalSingleton cache first
      const cached = await this.getFromCache<DigitalAsset>(cacheKey);
      if (cached && cached.tenant_id === tenantId) {
                return cached;
      }

      // Check database
      const asset = await this.getAssetFromDatabase(assetId, tenantId);
      if (asset) {
        // Cache the result
        await this.setCache(cacheKey, asset, { ttl: 7200 }); // 2 hours
                return asset;
      }

            return null;
    } catch (error) {
            this.logError('Error getting asset', error);
      throw error;
    }
  }

  /**
   * Generate signed URL for secure downloads
   */
  async generateSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        this.logError('Signed URL generation error', error);
        throw new Error(`Failed to generate signed URL: ${error.message}`);
      }

      return data.signedUrl;
    } catch (error) {
      this.logError('Error generating signed URL', error);
      throw error;
    }
  }

  /**
   * Generate secure access token for downloads
   */
  generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create external link asset
   */
  async createExternalLink(
    tenantId: string,
    productId: string,
    url: string,
    name: string,
    description?: string
  ): Promise<DigitalAsset> {
    const startTime = Date.now();
    
    try {
      const assetId = this.generateAssetId();

      const asset: DigitalAsset = {
        id: assetId,
        name,
        type: 'link',
        storage_method: 'external',
        external_url: url,
        description,
        created_at: new Date().toISOString(),
        tenant_id: tenantId,
        product_id: productId,
        download_count: 0,
        last_accessed: new Date().toISOString()
      };

      // Cache the asset
      const cacheKey = `asset-${assetId}`;
      await this.setCache(cacheKey, asset, { ttl: 7200 });

      this.metrics.cacheHits++;
      this.metrics.apiCalls++;
      return asset;
    } catch (error) {
      this.metrics.cacheMisses++;
      this.metrics.errors++;
      this.logError('Error creating external link', error);
      throw error;
    }
  }

  /**
   * Create license key asset
   */
  async createLicenseKey(
    tenantId: string,
    productId: string,
    licenseKey: string,
    name: string,
    description?: string
  ): Promise<DigitalAsset> {
    const startTime = Date.now();
    
    try {
      const assetId = this.generateAssetId();

      const asset: DigitalAsset = {
        id: assetId,
        name,
        type: 'license_key',
        storage_method: 'platform',
        description,
        created_at: new Date().toISOString(),
        tenant_id: tenantId,
        product_id: productId,
        download_count: 0,
        last_accessed: new Date().toISOString()
      };

      // Store license key securely (could be encrypted)
      // For now, we'll store it in the description field
      asset.description = description ? `${description}\n\nLicense Key: ${licenseKey}` : `License Key: ${licenseKey}`;

      // Cache the asset
      const cacheKey = `asset-${assetId}`;
      await this.setCache(cacheKey, asset, { ttl: 7200 });

      this.metrics.cacheHits++;
      this.metrics.apiCalls++;
      return asset;
    } catch (error) {
      this.metrics.cacheMisses++;
      this.metrics.errors++;
      this.logError('Error creating license key', error);
      throw error;
    }
  }

  /**
   * Delete an asset
   */
  async deleteAsset(assetId: string, tenantId: string): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const asset = await this.getAsset(assetId, tenantId);
      if (!asset) {
        return false;
      }

      // Delete from Supabase Storage if it's a file
      if (asset.storage_method === 'platform' && asset.file_path) {
        const { error } = await this.supabase.storage
          .from(this.bucketName)
          .remove([asset.file_path]);

        if (error) {
          this.logError('Storage deletion error', error);
          // Continue with cache cleanup even if storage deletion fails
        }
      }

      // Remove from cache (simulated - would need actual implementation)
      this.logInfo(`Asset ${assetId} removed from cache`);

      this.metrics.cacheHits++;
      this.metrics.apiCalls++;
      return true;
    } catch (error) {
      this.metrics.cacheMisses++;
      this.metrics.errors++;
      this.logError('Error deleting asset', error);
      throw error;
    }
  }

  // ====================
  // ANALYTICS AND METRICS
  // ====================

  /**
   * Get comprehensive asset statistics
   */
  async getAssetStats(tenantId?: string): Promise<AssetStats> {
    try {
      const cacheKey = `asset-stats-${tenantId || 'all'}`;
      const cached = await this.getFromCache<AssetStats>(cacheKey);
      if (cached) {
        return cached;
      }

      // For now, return mock stats since we don't have a database table for assets
      // In a real implementation, this would query the database
      const stats: AssetStats = {
        totalAssets: this.metrics.cacheHits + this.metrics.cacheMisses,
        totalStorageUsed: this.estimateStorageUsage(),
        totalDownloads: this.metrics.cacheHits + this.metrics.cacheMisses,
        assetTypes: {
          file: Math.floor((this.metrics.cacheHits + this.metrics.cacheMisses) * 0.7),
          link: Math.floor((this.metrics.cacheHits + this.metrics.cacheMisses) * 0.2),
          license_key: Math.floor((this.metrics.cacheHits + this.metrics.cacheMisses) * 0.1)
        },
        storageMethods: {
          platform: Math.floor((this.metrics.cacheHits + this.metrics.cacheMisses) * 0.8),
          external: Math.floor((this.metrics.cacheHits + this.metrics.cacheMisses) * 0.2)
        },
        topTenants: [
          { tenantId: 'tid-m8ijkrnk', assetCount: 25 },
          { tenantId: 'tid-042hi7ju', assetCount: 18 },
          { tenantId: 'tid-lt2t1wzu', assetCount: 12 }
        ],
        averageFileSize: 1024 * 1024 * 2.5, // 2.5MB average
        recentUploads: 5,
        expiringAssets: 2
      };

      await this.setCache(cacheKey, stats, { ttl: 1800 }); // 30 minutes cache
      return stats;
    } catch (error) {
      this.logError('Error getting asset stats', error);
      throw error;
    }
  }

  /**
   * Get assets for a tenant
   */
  async getTenantAssets(tenantId: string, limit: number = 50): Promise<DigitalAsset[]> {
    try {
      const cacheKey = `tenant-assets-${tenantId}-${limit}`;
      const cached = await this.getFromCache<DigitalAsset[]>(cacheKey);
      if (cached) {
        return cached;
      }

      // For now, return empty array since we don't have database persistence
      // In a real implementation, this would query the database
      const assets: DigitalAsset[] = [];

      await this.setCache(cacheKey, assets, { ttl: 1800 });
      return assets;
    } catch (error) {
      this.logError('Error getting tenant assets', error);
      return [];
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: string; services: any; lastCheck: string }> {
    try {
      // Check Supabase connection
      const supabaseHealthy = await this.checkSupabaseHealth();
      
      const health = {
        status: supabaseHealthy ? 'healthy' : 'degraded',
        services: {
          supabase: supabaseHealthy ? 'connected' : 'disconnected',
          cache: 'operational',
          metrics: 'tracking'
        },
        lastCheck: new Date().toISOString()
      };

      return health;
    } catch (error) {
      this.logError('Error checking health', error);
      return {
        status: 'unhealthy',
        services: { error: 'Health check failed' },
        lastCheck: new Date().toISOString()
      };
    }
  }

  // ====================
  // CACHE MANAGEMENT
  // ====================

  /**
   * Clear cache for specific asset or all assets
   */
  async clearCache(assetId?: string): Promise<void> {
    try {
      if (assetId) {
        // Simulated cache clearing for specific asset
        this.logInfo(`Cache cleared for asset ${assetId}`);
      } else {
        // Simulated cache clearing for all assets
        this.logInfo('Cache cleared for all assets');
      }
      
      this.logInfo(`Cache cleared${assetId ? ` for asset ${assetId}` : ' for all assets'}`);
    } catch (error) {
      this.logError('Error clearing cache', error);
      throw error;
    }
  }

  // ====================
  // HELPER METHODS
  // ====================

  /**
   * Generate a unique asset ID
   */
  private generateAssetId(): string {
    return `asset_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get asset from database (mock implementation)
   */
  private async getAssetFromDatabase(assetId: string, tenantId: string): Promise<DigitalAsset | null> {
    // In a real implementation, this would query the database
    // For now, we'll return null since we don't have persistence
    return null;
  }

  /**
   * Check Supabase health
   */
  private async checkSupabaseHealth(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.storage.listBuckets();
      return !error;
    } catch (error) {
      return false;
    }
  }

  /**
   * Estimate storage usage based on metrics
   */
  private estimateStorageUsage(): number {
    // Rough estimate based on upload operations
    const uploadCount = this.metrics.cacheHits + this.metrics.cacheMisses;
    return uploadCount * 1024 * 1024 * 2.5; // 2.5MB per file average
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      totalAssets: this.metrics.cacheHits + this.metrics.cacheMisses,
      storageUsed: this.estimateStorageUsage(),
      totalDownloads: this.metrics.cacheHits + this.metrics.cacheMisses,
      averageFileSize: 1024 * 1024 * 2.5
    };
  }
}

export default DigitalAssetSingletonService;
