import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

/**
 * Proxy for /api/admin/tier-system/tiers
 * Forwards requests to the API server with auth token from cookies
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Debug: Log all cookies
    const allCookies = cookieStore.getAll();
    console.log('[Tier Proxy] All cookies:', allCookies.map(c => c.name));
    
    const authToken = cookieStore.get('auth_token')?.value;
    console.log('[Tier Proxy] Auth token present:', !!authToken);

    if (!authToken) {
      console.log('[Tier Proxy] No auth token found in cookies');
      return NextResponse.json({ error: 'Unauthorized - No auth token' }, { status: 401 });
    }

    const url = new URL(request.url);
    const queryParams = url.searchParams.toString();
    const apiUrl = `${API_BASE_URL}/api/admin/tier-system/tiers${queryParams ? `?${queryParams}` : ''}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
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
