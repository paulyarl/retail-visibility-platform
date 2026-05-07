import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const queryString = url.search;
    
    // Get optional Auth0 session
    const auth = await getAuth0Session(req);
    const accessToken = auth?.accessToken || null;
    
    const res = await authenticatedFetch(`/api/taxonomy/search${queryString}`, accessToken, {
      method: 'GET',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] GET /taxonomy/search error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
