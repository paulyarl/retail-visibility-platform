import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/tenants/[tenantId]/download-pages/[pageId]
 * 
 * Get download page by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string; pageId: string } }
) {
  try {
    const { tenantId, pageId } = params;

    const page = await prisma.digital_download_pages.findFirst({
      where: {
        id: pageId,
        tenant_id: tenantId,
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
        { success: false, error: 'Download page not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformDownloadPage(page),
    });
  } catch (error) {
    console.error('Error fetching download page:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch download page' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tenants/[tenantId]/download-pages/[pageId]
 * 
 * Update download page
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string; pageId: string } }
) {
  try {
    const { tenantId, pageId } = params;
    const body = await request.json() as {
      slug?: string;
      title?: string;
      description?: string;
      pageType?: string;
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
      status?: string;
    };

    // Check if page exists
    const existingPage = await prisma.digital_download_pages.findFirst({
      where: {
        id: pageId,
        tenant_id: tenantId,
      },
    });

    if (!existingPage) {
      return NextResponse.json(
        { success: false, error: 'Download page not found' },
        { status: 404 }
      );
    }

    // If slug is being updated, check for uniqueness
    if (body.slug && body.slug !== existingPage.slug) {
      const slugExists = await prisma.digital_download_pages.findFirst({
        where: {
          tenant_id: tenantId,
          slug: body.slug,
          NOT: { id: pageId },
        },
      });

      if (slugExists) {
        return NextResponse.json(
          { success: false, error: 'Slug already exists' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};
    
    // Only update fields that are provided
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.pageType !== undefined) updateData.page_type = body.pageType;
    if (body.customCss !== undefined) updateData.custom_css = body.customCss;
    if (body.customJs !== undefined) updateData.custom_js = body.customJs;
    if (body.logoUrl !== undefined) updateData.logo_url = body.logoUrl;
    if (body.bannerUrl !== undefined) updateData.banner_url = body.bannerUrl;
    if (body.brandColor !== undefined) updateData.brand_color = body.brandColor;
    if (body.instructions !== undefined) updateData.instructions = body.instructions;
    if (body.thankYouMessage !== undefined) updateData.thank_you_message = body.thankYouMessage;
    if (body.supportEmail !== undefined) updateData.support_email = body.supportEmail;
    if (body.supportUrl !== undefined) updateData.support_url = body.supportUrl;
    if (body.requireAuthentication !== undefined) updateData.require_authentication = body.requireAuthentication;
    if (body.requirePurchaseVerification !== undefined) updateData.require_purchase_verification = body.requirePurchaseVerification;
    if (body.accessExpires !== undefined) updateData.access_expires = body.accessExpires;
    if (body.accessDurationDays !== undefined) updateData.access_duration_days = body.accessDurationDays;
    if (body.allowMultipleDownloads !== undefined) updateData.allow_multiple_downloads = body.allowMultipleDownloads;
    if (body.downloadLimit !== undefined) updateData.download_limit = body.downloadLimit;
    if (body.downloadTracking !== undefined) updateData.download_tracking = body.downloadTracking;
    if (body.customDownloadLimit !== undefined) updateData.custom_download_limit = body.customDownloadLimit;
    if (body.customAccessDurationDays !== undefined) updateData.custom_access_duration_days = body.customAccessDurationDays;
    if (body.seoTitle !== undefined) updateData.seo_title = body.seoTitle;
    if (body.seoDescription !== undefined) updateData.seo_description = body.seoDescription;
    
    // Handle status updates
    if (body.status !== undefined) {
      updateData.status = body.status;
      
      // If publishing, set published_at
      if (body.status === 'active' && existingPage.status !== 'active') {
        updateData.published_at = new Date();
      }
    }

    // Update download page
    const updatedPage = await prisma.digital_download_pages.update({
      where: { id: pageId },
      data: updateData,
      include: {
        inventory_items_digital_download_pages_item_idToinventory_items: {
          select: {
            id: true,
            name: true,
            sku: true,
            product_type: true,
          },
        },
        digital_downloads: {
          orderBy: { display_order: 'asc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: transformDownloadPage(updatedPage),
    });
  } catch (error) {
    console.error('Error updating download page:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update download page' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenants/[tenantId]/download-pages/[pageId]
 * 
 * Delete download page
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tenantId: string; pageId: string } }
) {
  try {
    const { tenantId, pageId } = params;

    // Check if page exists
    const existingPage = await prisma.digital_download_pages.findFirst({
      where: {
        id: pageId,
        tenant_id: tenantId,
      },
    });

    if (!existingPage) {
      return NextResponse.json(
        { success: false, error: 'Download page not found' },
        { status: 404 }
      );
    }

    // Remove download_page_id reference from inventory_items
    await prisma.inventory_items.updateMany({
      where: { download_page_id: pageId },
      data: { download_page_id: null },
    });

    // Delete download page (cascade will delete assets and logs)
    await prisma.digital_download_pages.delete({
      where: { id: pageId },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Download page deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting download page:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete download page' },
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
