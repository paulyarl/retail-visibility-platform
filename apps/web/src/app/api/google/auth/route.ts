/**
 * Google OAuth Authorization Endpoint (Frontend Proxy)
 * ENH-2026-043 + ENH-2026-044
 */

import { NextRequest, NextResponse } from 'next/server';
import { googleIntegrationService } from '@/services/GoogleIntegrationService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenant_id_required' },
        { status: 400 }
      );
    }

    const authData = await googleIntegrationService.getAuthUrl(tenantId);
    return NextResponse.json(authData);
  } catch (error) {
    console.error('[API Proxy] Google auth error:', error);
    return NextResponse.json(
      { error: 'internal_server_error' },
      { status: 500 }
    );
  }
}
