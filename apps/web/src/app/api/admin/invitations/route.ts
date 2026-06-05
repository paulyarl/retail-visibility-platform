import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(req: NextRequest) {
  try {
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;
    
    // Make authenticated request to backend
    const res = await authenticatedFetch('/api/admin/invitations', accessToken, {
      method: 'GET',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] GET /api/admin/invitations error:', e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
