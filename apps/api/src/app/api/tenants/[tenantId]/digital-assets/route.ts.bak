import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { generateDigitalAssetId } from '../../../../../lib/id-generator';

const prisma = new PrismaClient();

/**
 * POST /api/tenants/[tenantId]/digital-assets
 * 
 * Create a new digital asset
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;
    const body = await request.json() as {
      downloadPageId?: string;
      assetName?: string;
      assetType?: string;
      filePath?: string;
      fileSize?: bigint;
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
    };

    // Validate required fields
    if (!body.downloadPageId) {
      return NextResponse.json(
        { success: false, error: 'Download page ID is required' },
        { status: 400 }
      );
    }

    if (!body.assetName || body.assetName.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Asset name is required' },
        { status: 400 }
      );
    }

    if (!body.assetType) {
      return NextResponse.json(
        { success: false, error: 'Asset type is required' },
        { status: 400 }
      );
    }

    // Verify download page exists and belongs to tenant
    const downloadPage = await prisma.digital_download_pages.findFirst({
      where: {
        id: body.downloadPageId,
        tenant_id: tenantId,
      },
    });

    if (!downloadPage) {
      return NextResponse.json(
        { success: false, error: 'Download page not found or does not belong to tenant' },
        { status: 404 }
      );
    }

    // Get the next display order
    const maxOrder = await prisma.digital_downloads.aggregate({
      where: { download_page_id: body.downloadPageId },
      _max: { display_order: true },
    });
    
    const displayOrder = body.displayOrder ?? (maxOrder._max.display_order ?? -1) + 1;

    // Create digital asset
    const asset = await prisma.digital_downloads.create({
      data: {
        id: generateDigitalAssetId(tenantId),
        tenant_id: tenantId,
        download_page_id: body.downloadPageId,
        item_id: downloadPage.item_id,
        asset_name: body.assetName,
        asset_type: body.assetType,
        file_path: body.filePath,
        file_size: body.fileSize,
        file_mime_type: body.fileMimeType,
        external_url: body.externalUrl,
        license_key_template: body.licenseKeyTemplate,
        download_method: body.downloadMethod || 'direct',
        requires_license_key: body.requiresLicenseKey ?? false,
        license_key_generator: body.licenseKeyGenerator,
        access_type: body.accessType || 'standard',
        max_downloads: body.maxDownloads,
        expiry_days: body.expiryDays,
        display_order: displayOrder,
        is_primary: body.isPrimary ?? false,
      },
    });

    // If this is set as primary, unset other primaries
    if (body.isPrimary) {
      await prisma.digital_downloads.updateMany({
        where: {
          download_page_id: body.downloadPageId,
          NOT: { id: asset.id },
        },
        data: { is_primary: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: transformAsset(asset),
    });
  } catch (error) {
    console.error('Error creating digital asset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create digital asset' },
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
  };
}
