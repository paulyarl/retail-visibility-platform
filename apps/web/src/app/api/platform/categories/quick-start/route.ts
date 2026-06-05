import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Get optional Auth0 session
    const auth = await getAuth0Session(req);
    const accessToken = auth?.accessToken || null;
    
    // Call the platform categories quick-start endpoint
    const res = await authenticatedFetch('/api/platform/categories/quick-start', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] POST /platform/categories/quick-start error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
