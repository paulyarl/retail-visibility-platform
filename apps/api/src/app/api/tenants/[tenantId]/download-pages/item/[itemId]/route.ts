import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../../../../../logger';

const prisma = new PrismaClient();

/**
 * GET /api/tenants/[tenantId]/download-pages/item/[itemId]
 * 
 * Get download page by item ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string; itemId: string } }
) {
  try {
    const { tenantId, itemId } = params;

    const page = await prisma.digital_download_pages.findFirst({
      where: {
        tenant_id: tenantId,
        item_id: itemId,
      },
      include: {
        inventory_items_digital_download_pages_item_idToinventory_items: {
          select: {
            id: true,
            name: true,
            sku: true,
            product_type: true,
            digital_delivery_method: true,
            access_duration_days: true,
            download_limit: true,
            license_type: true,
          },
        },
        digital_downloads: {
          orderBy: { display_order: 'asc' },
        },
      },
    });

    if (!page) {
      return NextResponse.json(
        { success: false, error: 'Download page not found for this item' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformDownloadPage(page),
    });
  } catch (error) {
    logger.error('Error fetching download page by item:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch download page' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to transform download page data
 */
function transformDownloadPage(page: any) {
  return {
    id: page.id,
    tenantId: page.tenant_id,
    itemId: page.item_id,
    slug: page.slug,
    title: page.title,
    description: page.description,
    pageType: page.page_type,
    customCss: page.custom_css,
    customJs: page.custom_js,
    logoUrl: page.logo_url,
    bannerUrl: page.banner_url,
    brandColor: page.brand_color,
    instructions: page.instructions,
    thankYouMessage: page.thank_you_message,
    supportEmail: page.support_email,
    supportUrl: page.support_url,
    requireAuthentication: page.require_authentication,
    requirePurchaseVerification: page.require_purchase_verification,
    accessExpires: page.access_expires,
    accessDurationDays: page.access_duration_days,
    allowMultipleDownloads: page.allow_multiple_downloads,
    downloadLimit: page.download_limit,
    downloadTracking: page.download_tracking,
    customDownloadLimit: page.custom_download_limit,
    customAccessDurationDays: page.custom_access_duration_days,
    seoTitle: page.seo_title,
    seoDescription: page.seo_description,
    status: page.status,
    publishedAt: page.published_at,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    createdBy: page.created_by,
    item: page.inventory_items,
    assets: page.digital_downloads?.map((asset: any) => ({
      id: asset.id,
      tenantId: asset.tenant_id,
      downloadPageId: asset.download_page_id,
      itemId: asset.item_id,
      assetName: asset.asset_name,
      assetType: asset.asset_type,
      filePath: asset.file_path,
      fileSize: asset.file_size,
      fileMimeType: asset.file_mime_type,
      externalUrl: asset.external_url,
      licenseKeyTemplate: asset.license_key_template,
      downloadMethod: asset.download_method,
      requiresLicenseKey: asset.requires_license_key,
      licenseKeyGenerator: asset.license_key_generator,
      accessType: asset.access_type,
      maxDownloads: asset.max_downloads,
      expiryDays: asset.expiry_days,
      displayOrder: asset.display_order,
      isPrimary: asset.is_primary,
      createdAt: asset.created_at,
      updatedAt: asset.updated_at,
    })),
  };
}
