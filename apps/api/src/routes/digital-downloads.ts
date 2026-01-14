/**
 * Digital Downloads Routes
 * Handles secure download access, validation, and tracking
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { digitalAccessService } from '../services/digital-assets/DigitalAccessService';
import { digitalAssetService } from '../services/digital-assets/DigitalAssetService';

const router = Router();

/**
 * GET /api/download/:accessToken
 * Secure download endpoint - validates access and generates signed URL
 */
router.get('/:accessToken', async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.params;

    console.log('[DigitalDownload] Access attempt:', { accessToken: accessToken.substring(0, 8) + '...' });

    // Validate access
    const validation = await digitalAccessService.validateAccess(accessToken);
    
    if (!validation.valid) {
      console.log('[DigitalDownload] Access denied:', validation.reason);
      return res.status(403).json({
        success: false,
        error: 'access_denied',
        message: validation.reason,
      });
    }

    const grant = validation.grant!;

    // Get inventory item with digital assets
    const item = await prisma.inventory_items.findUnique({
      where: { id: grant.inventoryItemId },
      select: {
        id: true,
        name: true,
        digital_assets: true,
        digital_delivery_method: true,
      },
    });

    if (!item) {
      console.error('[DigitalDownload] Item not found:', grant.inventoryItemId);
      return res.status(404).json({
        success: false,
        error: 'item_not_found',
        message: 'Digital product not found',
      });
    }

    const assets = item.digital_assets as any[];
    if (!assets || assets.length === 0) {
      console.error('[DigitalDownload] No assets found for item:', item.id);
      return res.status(404).json({
        success: false,
        error: 'no_assets',
        message: 'No digital assets available for this product',
      });
    }

    // Get the first asset (support for multiple assets in future)
    const asset = assets[0];

    // Handle different delivery methods
    if (asset.storage_method === 'external') {
      // External link - redirect directly
      console.log('[DigitalDownload] Redirecting to external link');
      await digitalAccessService.recordDownload(accessToken);
      
      return res.redirect(asset.external_url);
    }

    if (asset.storage_method === 'platform') {
      // Platform-hosted file - generate signed URL
      console.log('[DigitalDownload] Generating signed URL for:', asset.file_path);
      
      try {
        const signedUrl = await digitalAssetService.generateSignedUrl(
          asset.file_path,
          3600 // 1 hour expiration
        );

        // Record download
        await digitalAccessService.recordDownload(accessToken);

        console.log('[DigitalDownload] Download successful');
        
        // Redirect to signed URL
        return res.redirect(signedUrl);
      } catch (error: any) {
        console.error('[DigitalDownload] Failed to generate signed URL:', error);
        return res.status(500).json({
          success: false,
          error: 'download_failed',
          message: 'Failed to generate download link',
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: 'invalid_storage_method',
      message: 'Invalid storage method for digital asset',
    });

  } catch (error: any) {
    console.error('[DigitalDownload] Error:', error);
    res.status(500).json({
      success: false,
      error: 'download_error',
      message: 'Failed to process download request',
    });
  }
});

/**
 * GET /api/download/:accessToken/info
 * Get download information without triggering a download
 */
router.get('/:accessToken/info', async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.params;

    // Validate access
    const validation = await digitalAccessService.validateAccess(accessToken);
    
    if (!validation.valid) {
      return res.status(403).json({
        success: false,
        error: 'access_denied',
        message: validation.reason,
      });
    }

    const grant = validation.grant!;

    // Get inventory item
    const item = await prisma.inventory_items.findUnique({
      where: { id: grant.inventoryItemId },
      select: {
        id: true,
        name: true,
        digital_assets: true,
        digital_delivery_method: true,
        license_type: true,
      },
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'item_not_found',
        message: 'Digital product not found',
      });
    }

    const assets = item.digital_assets as any[];
    const asset = assets?.[0];

    res.json({
      success: true,
      data: {
        productName: item.name,
        deliveryMethod: item.digital_delivery_method,
        licenseType: item.license_type,
        downloadCount: grant.downloadCount,
        downloadLimit: grant.downloadLimit,
        downloadsRemaining: grant.downloadLimit 
          ? grant.downloadLimit - grant.downloadCount 
          : null,
        expiresAt: grant.expiresAt,
        firstAccessedAt: grant.firstAccessedAt,
        lastAccessedAt: grant.lastAccessedAt,
        asset: asset ? {
          name: asset.name,
          type: asset.type,
          fileSize: asset.file_size_bytes,
          mimeType: asset.mime_type,
        } : null,
      },
    });

  } catch (error: any) {
    console.error('[DigitalDownload] Info error:', error);
    res.status(500).json({
      success: false,
      error: 'info_error',
      message: 'Failed to get download information',
    });
  }
});

/**
 * GET /api/orders/:orderId/downloads
 * Get all digital downloads for an order
 */
router.get('/orders/:orderId/downloads', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const grants = await digitalAccessService.getAccessGrantsByOrder(orderId);

    // Get item details for each grant
    const grantsWithDetails = await Promise.all(
      grants.map(async (grant) => {
        const item = await prisma.inventory_items.findUnique({
          where: { id: grant.inventoryItemId },
          select: {
            id: true,
            name: true,
            digital_assets: true,
            digital_delivery_method: true,
            license_type: true,
          },
        });

        const assets = item?.digital_assets as any[];
        const asset = assets?.[0];

        return {
          accessToken: grant.accessToken,
          productName: item?.name,
          deliveryMethod: item?.digital_delivery_method,
          licenseType: item?.license_type,
          downloadCount: grant.downloadCount,
          downloadLimit: grant.downloadLimit,
          downloadsRemaining: grant.downloadLimit 
            ? grant.downloadLimit - grant.downloadCount 
            : null,
          expiresAt: grant.expiresAt,
          isExpired: grant.expiresAt ? grant.expiresAt < new Date() : false,
          isRevoked: !!grant.revokedAt,
          asset: asset ? {
            name: asset.name,
            fileSize: asset.file_size_bytes,
          } : null,
        };
      })
    );

    res.json({
      success: true,
      downloads: grantsWithDetails,
    });

  } catch (error: any) {
    console.error('[DigitalDownload] Order downloads error:', error);
    res.status(500).json({
      success: false,
      error: 'fetch_error',
      message: 'Failed to get order downloads',
    });
  }
});

export default router;
