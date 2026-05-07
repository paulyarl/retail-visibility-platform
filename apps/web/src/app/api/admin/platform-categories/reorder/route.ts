import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const response = await authenticatedFetch('/api/admin/platform-categories/reorder', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Platform Categories Proxy] Reorder error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reorder categories' },
      { status: 500 }
    );
  }
}
