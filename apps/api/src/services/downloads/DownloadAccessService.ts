/**
 * Download Access Service
 * 
 * Handles access control validation for digital product downloads.
 * Validates access tokens, purchase verification, download limits, and expiration.
 */

import { PrismaClient } from '@prisma/client';
import { generateDownloadLogId, generateLicenseKey } from '../../lib/id-generator';

const prisma = new PrismaClient();

export interface AccessValidationResult {
  granted: boolean;
  reason?: string;
  accessGrant?: {
    id: string;
    accessToken: string;
    downloadCount: number;
    maxDownloads: number | null;
    expiresAt: Date | null;
    customerEmail: string;
    licenseKey?: string | null;
  };
  downloadPage?: {
    id: string;
    title: string;
    requireAuthentication: boolean;
    requirePurchaseVerification: boolean;
    accessExpires: boolean;
    accessDurationDays: number | null;
    allowMultipleDownloads: boolean;
    downloadLimit: number | null;
    customDownloadLimit: number | null;
    customAccessDurationDays: number | null;
  };
  item?: {
    id: string;
    name: string;
    productType: string;
    digitalDeliveryMethod: string;
    accessDurationDays: number | null;
    downloadLimit: number | null;
  };
}

export interface DownloadRequest {
  tenantId: string;
  accessToken: string;
  assetId: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
}

export interface LicenseKeyValidationResult {
  valid: boolean;
  reason?: string;
  licenseKey?: {
    id: string;
    key: string;
    status: string;
    activatedAt: Date | null;
    expiresAt: Date | null;
  };
}

/**
 * Validate access token and check if download is allowed
 */
export async function validateDownloadAccess(
  tenantId: string,
  accessToken: string
): Promise<AccessValidationResult> {
  try {
    // Find the access grant by token
    const accessGrant = await prisma.digital_access_grants.findFirst({
      where: {
        access_token: accessToken,
        tenant_id: tenantId,
      },
      include: {
        digital_download_pages: {
          include: {
            inventory_items_digital_download_pages_item_idToinventory_items: true,
          },
        },
      },
    });

    if (!accessGrant) {
      return {
        granted: false,
        reason: 'INVALID_TOKEN',
      };
    }

    // Check if access has expired
    if (accessGrant.access_expires_at) {
      const now = new Date();
      if (now > accessGrant.access_expires_at) {
        return {
          granted: false,
          reason: 'ACCESS_EXPIRED',
          accessGrant: {
            id: accessGrant.id,
            accessToken: accessGrant.access_token || '',
            downloadCount: accessGrant.download_count || 0,
            maxDownloads: accessGrant.max_downloads,
            expiresAt: accessGrant.access_expires_at,
            customerEmail: accessGrant.customer_email || '',
          },
        };
      }
    }

    // Get download page settings
    const downloadPage = accessGrant.digital_download_pages;
    if (!downloadPage) {
      return {
        granted: false,
        reason: 'DOWNLOAD_PAGE_NOT_FOUND',
      };
    }

    const item = downloadPage.inventory_items_digital_download_pages_item_idToinventory_items;

    // Determine effective download limit (page override > item default)
    const effectiveDownloadLimit = 
      downloadPage.custom_download_limit ?? 
      downloadPage.download_limit ?? 
      item?.download_limit ?? 
      null;

    // Check download count against limit
    if (effectiveDownloadLimit !== null) {
      const currentCount = accessGrant.download_count || 0;
      if (currentCount >= effectiveDownloadLimit) {
        return {
          granted: false,
          reason: 'DOWNLOAD_LIMIT_REACHED',
          accessGrant: {
            id: accessGrant.id,
            accessToken: accessGrant.access_token || '',
            downloadCount: currentCount,
            maxDownloads: effectiveDownloadLimit,
            expiresAt: accessGrant.access_expires_at,
            customerEmail: accessGrant.customer_email || '',
          },
          downloadPage: {
            id: downloadPage.id,
            title: downloadPage.title || '',
            requireAuthentication: downloadPage.require_authentication ?? true,
            requirePurchaseVerification: downloadPage.require_purchase_verification ?? true,
            accessExpires: downloadPage.access_expires ?? false,
            accessDurationDays: downloadPage.access_duration_days,
            allowMultipleDownloads: downloadPage.allow_multiple_downloads ?? true,
            downloadLimit: downloadPage.download_limit,
            customDownloadLimit: downloadPage.custom_download_limit,
            customAccessDurationDays: downloadPage.custom_access_duration_days,
          },
          item: item ? {
            id: item.id,
            name: item.name,
            productType: item.product_type || 'physical',
            digitalDeliveryMethod: item.digital_delivery_method || '',
            accessDurationDays: item.access_duration_days,
            downloadLimit: item.download_limit,
          } : undefined,
        };
      }
    }

    // Access granted
    return {
      granted: true,
      accessGrant: {
        id: accessGrant.id,
        accessToken: accessGrant.access_token || '',
        downloadCount: accessGrant.download_count || 0,
        maxDownloads: effectiveDownloadLimit,
        expiresAt: accessGrant.access_expires_at,
        customerEmail: accessGrant.customer_email || '',
        licenseKey: accessGrant.license_key,
      },
      downloadPage: {
        id: downloadPage.id,
        title: downloadPage.title || '',
        requireAuthentication: downloadPage.require_authentication ?? true,
        requirePurchaseVerification: downloadPage.require_purchase_verification ?? true,
        accessExpires: downloadPage.access_expires ?? false,
        accessDurationDays: downloadPage.access_duration_days,
        allowMultipleDownloads: downloadPage.allow_multiple_downloads ?? true,
        downloadLimit: downloadPage.download_limit,
        customDownloadLimit: downloadPage.custom_download_limit,
        customAccessDurationDays: downloadPage.custom_access_duration_days,
      },
      item: item ? {
        id: item.id,
        name: item.name,
        productType: item.product_type || 'physical',
        digitalDeliveryMethod: item.digital_delivery_method || '',
        accessDurationDays: item.access_duration_days,
        downloadLimit: item.download_limit,
      } : undefined,
    };
  } catch (error) {
    console.error('Error validating download access:', error);
    return {
      granted: false,
      reason: 'VALIDATION_ERROR',
    };
  }
}

/**
 * Record a download attempt and increment download count
 */
export async function recordDownload(
  request: DownloadRequest
): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    // Validate access first
    const validation = await validateDownloadAccess(request.tenantId, request.accessToken);
    
    if (!validation.granted) {
      // Log failed attempt
      const logId = generateDownloadLogId(request.tenantId);
      await prisma.download_access_logs.create({
        data: {
          id: logId,
          tenant_id: request.tenantId,
          access_grant_id: validation.accessGrant?.id || '',
          download_id: request.assetId,
          accessed_at: new Date(),
          ip_address: request.ipAddress,
          user_agent: request.userAgent,
          referrer: request.referrer,
          download_successful: false,
          error_code: validation.reason,
          error_message: getErrorMessage(validation.reason),
        },
      });
      
      return { success: false, error: validation.reason };
    }

    // Get the access grant to find its ID
    const accessGrant = await prisma.digital_access_grants.findFirst({
      where: {
        tenant_id: request.tenantId,
        access_token: request.accessToken,
      },
    });

    if (!accessGrant) {
      return { success: false, error: 'ACCESS_GRANT_NOT_FOUND' };
    }

    // Increment download count
    await prisma.digital_access_grants.update({
      where: { id: accessGrant.id },
      data: {
        download_count: (accessGrant.download_count || 0) + 1,
        last_accessed_at: new Date(),
      },
    });

    // Log successful download
    const logId = generateDownloadLogId(request.tenantId);
    await prisma.download_access_logs.create({
      data: {
        id: logId,
        tenant_id: request.tenantId,
        access_grant_id: accessGrant.id,
        download_id: request.assetId,
        accessed_at: new Date(),
        ip_address: request.ipAddress,
        user_agent: request.userAgent,
        referrer: request.referrer,
        download_successful: true,
      },
    });

    return { success: true, logId };
  } catch (error) {
    console.error('Error recording download:', error);
    return { success: false, error: 'RECORD_ERROR' };
  }
}

/**
 * Generate or retrieve a license key for an asset
 */
export async function generateOrRetrieveLicenseKey(
  tenantId: string,
  accessToken: string,
  assetId: string
): Promise<{ key?: string; error?: string }> {
  try {
    // Validate access
    const validation = await validateDownloadAccess(tenantId, accessToken);
    
    if (!validation.granted) {
      return { error: validation.reason };
    }

    const accessGrant = validation.accessGrant;
    if (!accessGrant) {
      return { error: 'ACCESS_GRANT_NOT_FOUND' };
    }

    // Check if asset requires license key
    const asset = await prisma.digital_downloads.findFirst({
      where: {
        id: assetId,
        tenant_id: tenantId,
      },
    });

    if (!asset) {
      return { error: 'ASSET_NOT_FOUND' };
    }

    if (!asset.requires_license_key) {
      return { error: 'ASSET_DOES_NOT_REQUIRE_LICENSE_KEY' };
    }

    // Check if access grant already has a license key
    if (accessGrant.licenseKey) {
      return { key: accessGrant.licenseKey };
    }

    // Generate new license key
    const newKey = asset.license_key_template 
      ? generateLicenseKeyFromTemplate(asset.license_key_template)
      : generateLicenseKey();

    // Store the license key on the access grant
    await prisma.digital_access_grants.update({
      where: { id: accessGrant.id },
      data: { license_key: newKey },
    });

    return { key: newKey };
  } catch (error) {
    console.error('Error generating license key:', error);
    return { error: 'LICENSE_KEY_GENERATION_ERROR' };
  }
}

/**
 * Validate a license key
 */
export async function validateLicenseKey(
  tenantId: string,
  licenseKey: string
): Promise<LicenseKeyValidationResult> {
  try {
    // Find the access grant with this license key
    const grant = await prisma.digital_access_grants.findFirst({
      where: {
        tenant_id: tenantId,
        license_key: licenseKey,
      },
    });

    if (!grant) {
      return {
        valid: false,
        reason: 'INVALID_LICENSE_KEY',
      };
    }

    // Check if already activated
    if (grant.license_key_activated_at) {
      return {
        valid: false,
        reason: 'LICENSE_KEY_ALREADY_ACTIVATED',
        licenseKey: {
          id: grant.id,
          key: grant.license_key || '',
          status: 'activated',
          activatedAt: grant.license_key_activated_at,
          expiresAt: grant.access_expires_at,
        },
      };
    }

    // Check if expired
    if (grant.access_expires_at && new Date() > grant.access_expires_at) {
      return {
        valid: false,
        reason: 'LICENSE_KEY_EXPIRED',
        licenseKey: {
          id: grant.id,
          key: grant.license_key || '',
          status: grant.status,
          activatedAt: grant.license_key_activated_at,
          expiresAt: grant.access_expires_at,
        },
      };
    }

    return {
      valid: true,
      licenseKey: {
        id: grant.id,
        key: grant.license_key || '',
        status: grant.status,
        activatedAt: grant.license_key_activated_at,
        expiresAt: grant.access_expires_at,
      },
    };
  } catch (error) {
    console.error('Error validating license key:', error);
    return {
      valid: false,
      reason: 'VALIDATION_ERROR',
    };
  }
}

/**
 * Activate a license key
 */
export async function activateLicenseKey(
  tenantId: string,
  licenseKey: string,
  customerId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const validation = await validateLicenseKey(tenantId, licenseKey);
    
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // Update access grant with activation info
    await prisma.digital_access_grants.update({
      where: { id: validation.licenseKey?.id },
      data: {
        license_key_activated_at: new Date(),
        license_key_activated_by: customerId,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error activating license key:', error);
    return { success: false, error: 'ACTIVATION_ERROR' };
  }
}

/**
 * Create access grant for a purchase
 */
export async function createAccessGrant(params: {
  tenantId: string;
  orderId: string;
  orderItemId: string;
  itemId: string;
  downloadPageId: string;
  customerEmail: string;
  customerId?: string;
  accessDurationDays?: number;
  downloadLimit?: number;
}): Promise<{ id: string; accessToken: string } | null> {
  try {
    const { generateAccessGrantId, generateAccessToken } = await import('../../lib/id-generator');
    
    const id = generateAccessGrantId(params.tenantId);
    const accessToken = generateAccessToken();
    
    // Calculate expiration if duration is set
    const expiresAt = params.accessDurationDays
      ? new Date(Date.now() + params.accessDurationDays * 24 * 60 * 60 * 1000)
      : null;

    const grant = await prisma.digital_access_grants.create({
      data: {
        id,
        tenant_id: params.tenantId,
        order_id: params.orderId,
        order_item_id: params.orderItemId,
        inventory_item_id: params.itemId,
        download_page_id: params.downloadPageId,
        customer_email: params.customerEmail,
        customer_id: params.customerId,
        access_token: accessToken,
        access_expires_at: expiresAt,
        max_downloads: params.downloadLimit,
        download_count: 0,
      },
    });

    return {
      id: grant.id,
      accessToken: grant.access_token || '',
    };
  } catch (error) {
    console.error('Error creating access grant:', error);
    return null;
  }
}

/**
 * Helper: Get human-readable error message
 */
function getErrorMessage(reason?: string): string {
  const messages: Record<string, string> = {
    INVALID_TOKEN: 'The access token is invalid or has been revoked.',
    ACCESS_EXPIRED: 'Your download access has expired.',
    DOWNLOAD_LIMIT_REACHED: 'You have reached the maximum number of downloads allowed.',
    DOWNLOAD_PAGE_NOT_FOUND: 'The download page could not be found.',
    VALIDATION_ERROR: 'An error occurred while validating your access.',
    ASSET_NOT_FOUND: 'The requested asset could not be found.',
    ASSET_DOES_NOT_REQUIRE_LICENSE_KEY: 'This asset does not require a license key.',
    LICENSE_KEY_GENERATION_ERROR: 'Failed to generate license key.',
    INVALID_LICENSE_KEY: 'The license key is invalid.',
    LICENSE_KEY_ALREADY_ACTIVATED: 'This license key has already been activated.',
    LICENSE_KEY_EXPIRED: 'This license key has expired.',
    ACTIVATION_ERROR: 'Failed to activate license key.',
  };

  return messages[reason || ''] || 'An unknown error occurred.';
}

/**
 * Helper: Generate license key from template
 */
function generateLicenseKeyFromTemplate(template: string): string {
  // Simple template replacement
  // Template format: {PREFIX}-{RANDOM4}-{RANDOM4}-{RANDOM4}
  let key = template;
  
  // Replace {RANDOM4} placeholders with random 4-char strings
  const nanoid = require('nanoid').customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);
  key = key.replace(/{RANDOM4}/g, () => nanoid());
  
  // Replace {RANDOM8} placeholders with random 8-char strings
  const nanoid8 = require('nanoid').customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
  key = key.replace(/{RANDOM8}/g, () => nanoid8());
  
  // Replace {UUID} with a short UUID
  key = key.replace(/{UUID}/g, () => require('crypto').randomUUID().split('-')[0].toUpperCase());
  
  return key;
}

export default {
  validateDownloadAccess,
  recordDownload,
  generateOrRetrieveLicenseKey,
  validateLicenseKey,
  activateLicenseKey,
  createAccessGrant,
};
