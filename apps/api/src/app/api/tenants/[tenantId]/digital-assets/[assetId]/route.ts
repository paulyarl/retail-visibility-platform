import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../../../../logger';

const prisma = new PrismaClient();

/**
 * GET /api/tenants/[tenantId]/digital-assets/[assetId]
 * 
 * Get digital asset by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string; assetId: string } }
) {
  try {
    const { tenantId, assetId } = params;

    const asset = await prisma.digital_downloads.findFirst({
      where: {
        id: assetId,
        tenant_id: tenantId,
      },
      include: {
        digital_download_pages: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Digital asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transformAsset(asset),
    });
  } catch (error) {
    logger.error('Error fetching digital asset:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch digital asset' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tenants/[tenantId]/digital-assets/[assetId]
 * 
 * Update digital asset
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tenantId: string; assetId: string } }
) {
  try {
    const { tenantId, assetId } = params;
    const body = await request.json() as {
      assetName?: string;
      assetType?: string;
      filePath?: string;
      fileSize?: number;
      fileMimeType?: string;
      externalUrl?: string;
      licenseKeyTemplate?: string;
      downloadMethod?: string;
      requiresLicenseKey?: boolean;
      licenseKeyGenerator?: string;
      accessType?: string;
      maxDownloads?: number;
      expiryDays?: number;
      displayOrder?: number;
      isPrimary?: boolean;
      downloadPageId?: string;
    };

    // Check if asset exists
    const existingAsset = await prisma.digital_downloads.findFirst({
      where: {
        id: assetId,
        tenant_id: tenantId,
      },
    });

    if (!existingAsset) {
      return NextResponse.json(
        { success: false, error: 'Digital asset not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};
    
    if (body.assetName !== undefined) updateData.asset_name = body.assetName;
    if (body.assetType !== undefined) updateData.asset_type = body.assetType;
    if (body.filePath !== undefined) updateData.file_path = body.filePath;
    if (body.fileSize !== undefined) updateData.file_size = body.fileSize;
    if (body.fileMimeType !== undefined) updateData.file_mime_type = body.fileMimeType;
    if (body.externalUrl !== undefined) updateData.external_url = body.externalUrl;
    if (body.licenseKeyTemplate !== undefined) updateData.license_key_template = body.licenseKeyTemplate;
    if (body.downloadMethod !== undefined) updateData.download_method = body.downloadMethod;
    if (body.requiresLicenseKey !== undefined) updateData.requires_license_key = body.requiresLicenseKey;
    if (body.licenseKeyGenerator !== undefined) updateData.license_key_generator = body.licenseKeyGenerator;
    if (body.accessType !== undefined) updateData.access_type = body.accessType;
    if (body.maxDownloads !== undefined) updateData.max_downloads = body.maxDownloads;
    if (body.expiryDays !== undefined) updateData.expiry_days = body.expiryDays;
    if (body.displayOrder !== undefined) updateData.display_order = body.displayOrder;
    if (body.isPrimary !== undefined) updateData.is_primary = body.isPrimary;

    // Update asset
    const updatedAsset = await prisma.digital_downloads.update({
      where: { id: assetId },
      data: updateData,
    });

    // If this is set as primary, unset other primaries
    if (body.isPrimary) {
      await prisma.digital_downloads.updateMany({
        where: {
          download_page_id: existingAsset.download_page_id,
          NOT: { id: assetId },
        },
        data: { is_primary: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: transformAsset(updatedAsset),
    });
  } catch (error) {
    logger.error('Error updating digital asset:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { success: false, error: 'Failed to update digital asset' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tenants/[tenantId]/digital-assets/[assetId]
 * 
 * Delete digital asset
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tenantId: string; assetId: string } }
) {
  try {
    const { tenantId, assetId } = params;
    const { searchParams } = new URL(request.url);
    const downloadPageId = searchParams.get('downloadPageId');

    // Check if asset exists
    const existingAsset = await prisma.digital_downloads.findFirst({
      where: {
        id: assetId,
        tenant_id: tenantId,
      },
    });

    if (!existingAsset) {
      return NextResponse.json(
        { success: false, error: 'Digital asset not found' },
        { status: 404 }
      );
    }

    // Delete asset
    await prisma.digital_downloads.delete({
      where: { id: assetId },
    });

    // If this was primary, set another as primary
    if (existingAsset.is_primary && downloadPageId) {
      const nextPrimary = await prisma.digital_downloads.findFirst({
        where: {
          download_page_id: downloadPageId,
          NOT: { id: assetId },
        },
        orderBy: { display_order: 'asc' },
      });

      if (nextPrimary) {
        await prisma.digital_downloads.update({
          where: { id: nextPrimary.id },
          data: { is_primary: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { message: 'Digital asset deleted successfully' },
    });
  } catch (error) {
    logger.error('Error deleting digital asset:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { success: false, error: 'Failed to delete digital asset' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to transform asset data
 */
function transformAsset(asset: any) {
  return {
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
    downloadPage: asset.digital_download_pages ? {
      id: asset.digital_download_pages.id,
      title: asset.digital_download_pages.title,
      slug: asset.digital_download_pages.slug,
      status: asset.digital_download_pages.status,
    } : null,
  };
}
