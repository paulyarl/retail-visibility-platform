import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

/**
 * Proxy for /api/admin/tier-system/features
 * Forwards requests to the API server with Auth0 session authentication
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { accessToken } = authResult;

    const response = await authenticatedFetch('/api/admin/tier-system/features', accessToken, {
      method: 'GET',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Tier System Features Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tier system features' },
      { status: 500 }
    );
  }
}
