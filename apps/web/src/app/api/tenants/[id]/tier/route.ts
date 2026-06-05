import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/tenants/[id]/tier
 * Proxy to backend tier endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    
    // Get tenant tier using the singleton service
    const data = await platformHomeService.getTenantTier(tenantId);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Tier API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
