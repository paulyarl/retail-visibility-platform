/**
 * Digital Asset API Routes - UniversalSingleton Implementation
 * Integrates DigitalAssetSingletonService with Express API
 */

import { Router } from 'express';
import DigitalAssetSingletonService from '../services/DigitalAssetSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const digitalAssetService = DigitalAssetSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Upload a file to Supabase Storage
 * POST /api/digital-asset-singleton/upload
 */
router.post('/upload', async (req, res) => {
  try {
    const { tenantId, productId, fileName, mimeType, description } = req.body;
    const fileData = req.body.file; // Base64 or buffer data
    
    // Validate required fields
    if (!tenantId || !productId || !fileName || !mimeType || !fileData) {
      return res.status(400).json({
        success: false,
        message: 'tenantId, productId, fileName, mimeType, and file are required'
      });
    }

    // Check if user has permission to upload for this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    // Convert base64 to buffer if needed
    const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData, 'base64');
    
    const result = await digitalAssetService.uploadFile(
      tenantId,
      productId,
      buffer,
      fileName,
      mimeType,
      description
    );
    
    res.json({
      success: true,
      data: {
        asset: result.asset,
        signed_url: result.signed_url,
        timestamp: new Date().toISOString()
      },
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('[DIGITAL ASSET SINGLETON] Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: (error as Error).message
    });
  }
});

/**
 * Get asset by ID
 * GET /api/digital-asset-singleton/asset/:assetId
 */
router.get('/asset/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const { tenantId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'tenantId is required'
      });
    }

    // Check if user has permission to access this tenant's assets
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const asset = await digitalAssetService.getAsset(assetId, tenantId as string);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        asset,
        timestamp: new Date().toISOString()
      },
      message: 'Asset retrieved successfully'
    });
  } catch (error) {
    console.error('[DIGITAL ASSET SINGLETON] Get asset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve asset'
    });
  }
});

/**
 * Generate signed URL for asset download
 * POST /api/digital-asset-singleton/signed-url
 */
router.post('/signed-url', async (req, res) => {
  try {
    const { filePath, expiresIn } = req.body;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'filePath is required'
      });
    }
    
    const signedUrl = await digitalAssetService.generateSignedUrl(filePath, expiresIn);
    
    res.json({
      success: true,
      data: {
        signed_url: signedUrl,
        expires_in: expiresIn || 3600,
        timestamp: new Date().toISOString()
      },
      message: 'Signed URL generated successfully'
    });
  } catch (error) {
    console.error('[DIGITAL ASSET SINGLETON] Signed URL error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate signed URL'
    });
  }
});

/**
 * Create external link asset
 * POST /api/digital-asset-singleton/external-link
 */
router.post('/external-link', async (req, res) => {
  try {
    const { tenantId, productId, url, name, description } = req.body;
    
    // Validate required fields
    if (!tenantId || !productId || !url || !name) {
      return res.status(400).json({
        success: false,
        message: 'tenantId, productId, url, and name are required'
      });
    }

    // Check if user has permission to create assets for this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const asset = await digitalAssetService.createExternalLink(
      tenantId,
      productId,
      url,
      name,
      description
    );
    
    res.json({
      success: true,
      data: {
        asset,
        timestamp: new Date().toISOString()
      },
      message: 'External link created successfully'
    });
  } catch (error) {
    console.error('[DIGITAL ASSET SINGLETON] External link error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create external link'
    });
  }
});

/**
 * Create license key asset
 * POST /api/digital-asset-singleton/license-key
 */
router.post('/license-key', async (req, res) => {
  try {
    const { tenantId, productId, licenseKey, name, description } = req.body;
    
    // Validate required fields
    if (!tenantId || !productId || !licenseKey || !name) {
      return res.status(400).json({
        success: false,
        message: 'tenantId, productId, licenseKey, and name are required'
      });
    }

    // Check if user has permission to create assets for this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const asset = await digitalAssetService.createLicenseKey(
      tenantId,
      productId,
      licenseKey,
      name,
      description
    );
    
    res.json({
      success: true,
      data: {
        asset,
        timestamp: new Date().toISOString()
      },
      message: 'License key created successfully'
    });
  } catch (error) {
    console.error('[DIGITAL ASSET SINGLETON] License key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create license key'
    });
  }
});

/**
 * Delete an asset
 * DELETE /api/digital-asset-singleton/asset/:assetId
 */
router.delete('/asset/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const { tenantId } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'tenantId is required'
      });
    }

    // Check if user has permission to delete assets for this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const deleted = await digitalAssetService.deleteAsset(assetId, tenantId as string);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Asset not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    console.error('[DIGITAL ASSET SINGLETON] Delete asset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete asset'
    });
  }
});

/**
 * Get asset statistics
 * GET /api/digital-asset-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Check if user has permission to view stats for this tenant
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await digitalAssetService.getAssetStats(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Asset statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[DIGITAL ASSET SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch asset statistics'
    });
  }
});

/**
 * Get assets for a tenant
 * GET /api/digital-asset-singleton/tenant-assets
 */
router.get('/tenant-assets', async (req, res) => {
  try {
    const { tenantId, limit } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'tenantId is required'
      });
    }

    // Check if user has permission to access this tenant's assets
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const assets = await digitalAssetService.getTenantAssets(
      tenantId as string,
      limit ? parseInt(limit as string) : 50
    );
    
    res.json({
      success: true,
      data: {
        assets,
        count: assets.length,
        timestamp: new Date().toISOString()
      },
      message: 'Tenant assets retrieved successfully'
    });
  } catch (error) {
    console.error('[DIGITAL ASSET SINGLETON] Get tenant assets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tenant assets'
    });
  }
});

/**
 * Get service health status
 * GET /api/digital-asset-singleton/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await digitalAssetService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'Digital asset service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[DIGITAL ASSET SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache
 * DELETE /api/digital-asset-singleton/cache
 */
router.delete('/cache', async (req, res) => {
  try {
    const { assetId } = req.query;
    
    // Check if user has admin permissions for cache clearing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required'
      });
    }
    
    await digitalAssetService.clearCache(assetId as string);
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('[DIGITAL ASSET SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

export default router;
