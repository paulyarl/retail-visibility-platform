import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const queryString = url.searchParams.toString();
    
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;
    
    const res = await authenticatedFetch(`/organization/billing/counters?${queryString}`, accessToken, {
      method: 'GET',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] GET /organization/billing/counters error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
