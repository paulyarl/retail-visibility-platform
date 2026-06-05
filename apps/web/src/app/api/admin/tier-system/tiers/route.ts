import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

// Debug: Log when this file is loaded
console.log('[Route File] Tier system route.ts loaded');

/**
 * Proxy for /api/admin/tier-system/tiers
 * Forwards requests to the API server with Auth0 session authentication
 */
export async function GET(request: NextRequest) {
  try {
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const url = new URL(request.url);
    // Extract the path after /api/admin/tier-system/tiers
    const pathSegments = url.pathname.split('/api/admin/tier-system/tiers')[1] || '';
    const queryParams = url.searchParams.toString();
    const endpoint = `/api/admin/tier-system/tiers${pathSegments}${queryParams ? `?${queryParams}` : ''}`;

    const response = await authenticatedFetch(endpoint, accessToken, {
      method: 'GET',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Tier System Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tiers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[Tier Proxy POST] Function called!');
  try {
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const url = new URL(request.url);
    // Extract the path after /api/admin/tier-system/tiers
    const pathSegments = url.pathname.split('/api/admin/tier-system/tiers')[1] || '';
    const queryParams = url.searchParams.toString();
    const endpoint = `/api/admin/tier-system/tiers${pathSegments}${queryParams ? `?${queryParams}` : ''}`;
    
    console.log('[Tier Proxy POST] Request URL:', url.pathname);
    console.log('[Tier Proxy POST] Path segments:', pathSegments);
    console.log('[Tier Proxy POST] Final endpoint:', endpoint);

    const requestBody = await request.json();

    const response = await authenticatedFetch(endpoint, accessToken, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Tier System Proxy POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
