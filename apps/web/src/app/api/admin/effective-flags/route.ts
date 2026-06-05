import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(req: NextRequest) {
  try {
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;
    
    const res = await authenticatedFetch('/api/admin/effective-flags', accessToken, {
      method: 'GET',
    });
    
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      return NextResponse.json({ success: false, error: text || `HTTP ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'proxy_failed' }, { status: 500 });
  }
}
