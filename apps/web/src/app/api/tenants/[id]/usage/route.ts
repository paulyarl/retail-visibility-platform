import { NextRequest, NextResponse } from 'next/server';
import { tenantUsageService } from '@/services/TenantUsageService';

/**
 * GET /api/tenants/[id]/usage
 * Proxy to backend usage endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    
    const usage = await tenantUsageService.getUsage(tenantId);
    return NextResponse.json(usage);
  } catch (error) {
    console.error('[Usage API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
