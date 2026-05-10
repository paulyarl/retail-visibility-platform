import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/downloads/[tenantId]/[slug]
 * 
 * Public endpoint to fetch download page data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string; slug: string } }
) {
  try {
    const { tenantId, slug } = params;

    // Find the download page by tenant and slug
    const downloadPage = await prisma.digital_download_pages.findFirst({
      where: {
        tenant_id: tenantId,
        slug: slug,
        status: 'published',
      },
      include: {
        inventory_items_digital_download_pages_item_idToinventory_items: {
          select: {
            id: true,
            name: true,
            product_type: true,
            digital_delivery_method: true,
          },
        },
        digital_downloads: {
          select: {
            id: true,
            asset_name: true,
            asset_type: true,
            file_size: true,
            file_mime_type: true,
            external_url: true,
            download_method: true,
            requires_license_key: true,
            is_primary: true,
            display_order: true,
          },
          orderBy: { display_order: 'asc' },
        },
      },
    });

    if (!downloadPage) {
      return NextResponse.json(
        { success: false, error: 'Download page not found' },
        { status: 404 }
      );
    }

    // Transform data for public consumption
    const item = downloadPage.inventory_items_digital_download_pages_item_idToinventory_items;
    const publicData = {
      id: downloadPage.id,
      title: downloadPage.title,
      description: downloadPage.description,
      logoUrl: downloadPage.logo_url,
      bannerUrl: downloadPage.banner_url,
      brandColor: downloadPage.brand_color,
      instructions: downloadPage.instructions,
      thankYouMessage: downloadPage.thank_you_message,
      supportEmail: downloadPage.support_email,
      supportUrl: downloadPage.support_url,
      requireAuthentication: downloadPage.require_authentication ?? true,
      requirePurchaseVerification: downloadPage.require_purchase_verification ?? true,
      accessExpires: downloadPage.access_expires ?? false,
      accessDurationDays: downloadPage.access_duration_days,
      downloadLimit: downloadPage.download_limit,
      customDownloadLimit: downloadPage.custom_download_limit,
      customAccessDurationDays: downloadPage.custom_access_duration_days,
      allowMultipleDownloads: downloadPage.allow_multiple_downloads ?? true,
      item: item ? {
        id: item.id,
        name: item.name,
        productType: item.product_type || 'physical',
        digitalDeliveryMethod: item.digital_delivery_method || '',
      } : null,
      assets: downloadPage.digital_downloads.map((asset) => ({
        id: asset.id,
        assetName: asset.asset_name,
        assetType: asset.asset_type,
        fileSize: asset.file_size ? Number(asset.file_size) : null,
        fileMimeType: asset.file_mime_type,
        externalUrl: asset.external_url,
        downloadMethod: asset.download_method,
        requiresLicenseKey: asset.requires_license_key ?? false,
        isPrimary: asset.is_primary ?? false,
        displayOrder: asset.display_order,
      })),
    };

    return NextResponse.json({
      success: true,
      data: publicData,
    });
  } catch (error) {
    console.error('Error fetching download page:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch download page' },
      { status: 500 }
    );
  }
}
