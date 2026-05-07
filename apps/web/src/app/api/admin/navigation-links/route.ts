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

    const response = await authenticatedFetch('/api/admin/navigation-links', accessToken, {
      method: 'GET',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Navigation Links Proxy] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch navigation links' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const response = await authenticatedFetch('/api/admin/navigation-links', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Navigation Links Proxy] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save navigation links' },
      { status: 500 }
    );
  }
}
