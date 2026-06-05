/**
 * Google Account Status Endpoint (Frontend Proxy)
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

    const status = await googleIntegrationService.getStatus(tenantId);
    return NextResponse.json(status);
  } catch (error) {
    console.error('[API Proxy] Google status error:', error);
    return NextResponse.json(
      { error: 'internal_server_error' },
      { status: 500 }
    );
  }
}
