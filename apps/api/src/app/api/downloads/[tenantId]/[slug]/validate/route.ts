import { NextRequest, NextResponse } from 'next/server';
import { validateDownloadAccess } from '../../../../../../services/downloads/DownloadAccessService';

/**
 * GET /api/downloads/[tenantId]/[slug]/validate
 * 
 * Validate access token for download access
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string; slug: string } }
) {
  try {
    const { tenantId } = params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({
        granted: false,
        reason: 'TOKEN_REQUIRED',
      });
    }

    const validation = await validateDownloadAccess(tenantId, token);

    return NextResponse.json(validation);
  } catch (error) {
    console.error('Error validating access:', error);
    return NextResponse.json(
      { granted: false, reason: 'VALIDATION_ERROR' },
      { status: 500 }
    );
  }
}
