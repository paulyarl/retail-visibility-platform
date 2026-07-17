/**
 * Digital Downloads Routes
 * Handles secure download access, validation, and tracking
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { digitalAccessService } from '../services/digital-assets/DigitalAccessService';
import { digitalAssetService } from '../services/digital-assets/DigitalAssetService';
import { logger } from '../logger';

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
      logger.error('[DigitalDownload] Item not found:', undefined, { error: { name: 'Error', message: String(grant.inventoryItemId) } });
      return res.status(404).json({
        success: false,
        error: 'item_not_found',
        message: 'Digital product not found',
      });
    }

    const assets = item.digital_assets as any[];
    if (!assets || assets.length === 0) {
      logger.error('[DigitalDownload] No assets found for item:', undefined, { error: { name: 'Error', message: String(item.id) } });
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
        logger.error('[DigitalDownload] Failed to generate signed URL:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[DigitalDownload] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[DigitalDownload] Info error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[DigitalDownload] Order downloads error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'fetch_error',
      message: 'Failed to get order downloads',
    });
  }
});

/**
 * GET /api/download/:tenantId/:slug
 * Public download page endpoint for preview access
 */
router.get('/:tenantId/:slug', async (req: Request, res: Response) => {
  try {
    const { tenantId, slug } = req.params;
    const token = req.query.token as string;

    console.log('[DigitalDownload] Page access:', { tenantId, slug, hasToken: !!token });

    // Get download page by slug
    const page = await prisma.digital_download_pages.findFirst({
      where: {
        slug: slug,
        tenant_id: tenantId,
        status: 'published' // Only show published pages publicly
      },
      include: {
        // Include the associated item
        inventory_items_digital_download_pages_item_idToinventory_items: {
          select: {
            id: true,
            name: true,
            product_type: true,
            digital_delivery_method: true
          }
        }
      }
    });

    if (!page) {
      console.log('[DigitalDownload] Page not found:', { tenantId, slug });
      return res.status(404).json({
        success: false,
        error: 'page_not_found',
        message: 'Download page not found'
      });
    }

    // Validate access token if provided
    let accessGranted = !page.require_authentication; // Default to granted if no auth required
    let variantId: string | null = null;
    
    if (token && page.require_authentication) {
      // Look up the access grant
      const accessGrant = await prisma.digital_access_grants.findUnique({
        where: { access_token: token },
        include: {
          order_items: {
            select: {
              variant_id: true,
              variant_name: true,
              variant_attributes: true
            }
          }
        }
      });

      if (!accessGrant) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'Invalid access token'
        });
      }

      // Check if access is still valid
      if (accessGrant.revoked_at || 
          (accessGrant.access_expires_at && accessGrant.access_expires_at < new Date())) {
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'Access expired or revoked'
        });
      }

      accessGranted = true;
      variantId = accessGrant.order_items?.variant_id || null;
    }

    // Get digital assets for this page, filtered by variant if applicable
    const assetsWhere: any = {
      download_page_id: page.id,
      tenant_id: tenantId
    };

    // Filter by variant if we have one
    if (variantId) {
      assetsWhere.variant_id = variantId;
    } else {
      // If no variant, get assets that don't have a variant_id
      assetsWhere.variant_id = null;
    }

    const assets = await prisma.digital_downloads.findMany({
      where: assetsWhere,
      orderBy: { display_order: 'asc' },
      include: {
        product_variants: {
          select: {
            id: true,
            variant_name: true,
            attributes: true
          }
        }
      }
    });

    // Format response
    const responseData = {
      id: page.id,
      slug: page.slug,
      title: page.title,
      description: page.description,
      logoUrl: page.logo_url,
      bannerUrl: page.banner_url,
      brandColor: page.brand_color,
      instructions: page.instructions,
      thankYouMessage: page.thank_you_message,
      supportEmail: page.support_email,
      supportUrl: page.support_url,
      requireAuthentication: page.require_authentication,
      accessExpires: page.access_expires,
      accessDurationDays: page.access_duration_days,
      downloadLimit: page.download_limit,
      allowMultipleDownloads: page.allow_multiple_downloads,
      item: page.inventory_items_digital_download_pages_item_idToinventory_items ? {
        id: page.inventory_items_digital_download_pages_item_idToinventory_items.id,
        name: page.inventory_items_digital_download_pages_item_idToinventory_items.name,
        productType: page.inventory_items_digital_download_pages_item_idToinventory_items.product_type,
        digitalDeliveryMethod: page.inventory_items_digital_download_pages_item_idToinventory_items.digital_delivery_method
      } : null,
      assets: assets.map(asset => ({
        id: asset.id,
        assetName: asset.asset_name,
        assetType: asset.asset_type,
        fileSize: asset.file_size,
        fileMimeType: asset.file_mime_type,
        externalUrl: asset.external_url,
        downloadMethod: asset.download_method,
        requiresLicenseKey: asset.requires_license_key,
        isPrimary: asset.is_primary,
        displayOrder: asset.display_order,
        variantId: asset.variant_id,
        variant: asset.product_variants ? {
          id: asset.product_variants.id,
          name: asset.product_variants.variant_name,
          attributes: asset.product_variants.attributes
        } : null
      }))
    };

    if (!accessGranted) {
      return res.status(403).json({
        success: false,
        error: 'access_denied',
        message: 'Authentication required'
      });
    }

    res.json({
      success: true,
      data: responseData
    });

  } catch (error: any) {
    logger.error('[DigitalDownload] Page access error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to load download page'
    });
  }
});

export default router;
