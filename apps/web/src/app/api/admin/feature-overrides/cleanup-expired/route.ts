import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function POST(request: NextRequest) {
  try {
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const response = await authenticatedFetch('/api/admin/feature-overrides/cleanup-expired', accessToken, {
      method: 'POST',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[API Proxy] Cleanup expired overrides error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup expired overrides', details: error.message },
      { status: 500 }
    );
  }
}
