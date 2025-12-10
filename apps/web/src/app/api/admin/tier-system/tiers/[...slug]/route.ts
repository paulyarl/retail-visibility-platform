import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

/**
 * Proxy for /api/admin/tier-system/tiers/*
 * Forwards requests to the API server with auth token from cookies
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization');
    const authToken = authHeader?.replace('Bearer ', '');
    console.log('[Tier Proxy Dynamic] Auth token present:', !!authToken);

    if (!authToken) {
      console.log('[Tier Proxy Dynamic] No auth token found in Authorization header');
      return NextResponse.json({ error: 'Unauthorized - No auth token' }, { status: 401 });
    }

    const url = new URL(request.url);
    // Extract the full path after /api/admin/tier-system/tiers
    const pathSegments = url.pathname.split('/api/admin/tier-system/tiers')[1] || '';
    const queryParams = url.searchParams.toString();
    const apiUrl = `${API_BASE_URL}/api/admin/tier-system/tiers${pathSegments}${queryParams ? `?${queryParams}` : ''}`;

    console.log('[Tier Proxy Dynamic] Request URL:', url.pathname);
    console.log('[Tier Proxy Dynamic] Path segments:', pathSegments);
    console.log('[Tier Proxy Dynamic] Final API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Tier System Proxy Dynamic] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tiers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[Tier Proxy Dynamic POST] Function called!');
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization');
    const authToken = authHeader?.replace('Bearer ', '');

    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized - No auth token' }, { status: 401 });
    }

    const url = new URL(request.url);
    // Extract the full path after /api/admin/tier-system/tiers
    const pathSegments = url.pathname.split('/api/admin/tier-system/tiers')[1] || '';
    const queryParams = url.searchParams.toString();
    const apiUrl = `${API_BASE_URL}/api/admin/tier-system/tiers${pathSegments}${queryParams ? `?${queryParams}` : ''}`;

    console.log('[Tier Proxy Dynamic POST] Request URL:', url.pathname);
    console.log('[Tier Proxy Dynamic POST] Path segments:', pathSegments);
    console.log('[Tier Proxy Dynamic POST] Final API URL:', apiUrl);

    const requestBody = await request.json();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Tier System Proxy Dynamic POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
