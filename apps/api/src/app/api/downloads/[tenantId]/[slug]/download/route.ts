import { NextRequest, NextResponse } from 'next/server';
import { recordDownload, generateOrRetrieveLicenseKey } from '../../../../../../services/downloads/DownloadAccessService';

/**
 * POST /api/downloads/[tenantId]/[slug]/download
 * 
 * Process a download request and return download URL or license key
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string; slug: string } }
) {
  try {
    const { tenantId } = params;
    const body = await request.json() as { token?: string; assetId?: string };
    const { token, assetId } = body;

    if (!token || !assetId) {
      return NextResponse.json(
        { success: false, error: 'Token and asset ID are required' },
        { status: 400 }
      );
    }

    // Get request metadata
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const referrer = request.headers.get('referer') || '';

    // Record the download (validates access internally)
    const result = await recordDownload({
      tenantId,
      accessToken: token,
      assetId,
      ipAddress,
      userAgent,
      referrer,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 403 }
      );
    }

    // Get asset details to determine response type
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const asset = await prisma.digital_downloads.findFirst({
      where: {
        id: assetId,
        tenant_id: tenantId,
      },
    });

    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Handle different asset types
    if (asset.asset_type === 'link' && asset.external_url) {
      return NextResponse.json({
        success: true,
        downloadUrl: asset.external_url,
        assetType: 'link',
      });
    }

    if (asset.requires_license_key) {
      // Generate or retrieve license key
      const keyResult = await generateOrRetrieveLicenseKey(tenantId, token, assetId);
      
      if (keyResult.error) {
        return NextResponse.json(
          { success: false, error: keyResult.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        licenseKey: keyResult.key,
        assetType: 'license_key',
      });
    }

    // For file downloads, return a signed URL (would integrate with Supabase storage)
    // For now, return the file path for direct download
    if (asset.asset_type === 'file' && asset.file_path) {
      // In production, this would generate a signed URL from Supabase
      // For now, return a relative path that can be handled by a file server
      const downloadUrl = `/api/storage/download?path=${encodeURIComponent(asset.file_path)}`;
      
      return NextResponse.json({
        success: true,
        downloadUrl,
        assetType: 'file',
        fileName: asset.asset_name,
        fileSize: asset.file_size,
        mimeType: asset.file_mime_type,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unable to process download' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing download:', error);
    return NextResponse.json(
      { success: false, error: 'Download processing failed' },
      { status: 500 }
    );
  }
}
