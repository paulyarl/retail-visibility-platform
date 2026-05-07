import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(request: NextRequest) {
  try {
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    // Forward query params
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const endpoint = `/api/admin/feature-overrides${queryString ? `?${queryString}` : ''}`;

    const response = await authenticatedFetch(endpoint, accessToken, {
      method: 'GET',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[API Proxy] Feature overrides GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature overrides', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const body = await request.json();

    const response = await authenticatedFetch('/api/admin/feature-overrides', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[API Proxy] Feature overrides POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create feature override', details: error.message },
      { status: 500 }
    );
  }
}
