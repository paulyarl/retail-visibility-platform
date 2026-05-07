import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(req: NextRequest) {
  try {
    // Get optional Auth0 session (categories can be public or authenticated)
    const auth = await getAuth0Session(req);
    const accessToken = auth?.accessToken || null;
    
    // Make request to backend (with or without auth)
    const res = await authenticatedFetch('/api/categories', accessToken, {
      method: 'GET',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] GET /categories error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Get optional Auth0 session
    const auth = await getAuth0Session(req);
    const accessToken = auth?.accessToken || null;
    
    // Make request to backend
    const res = await authenticatedFetch('/api/categories', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] POST /categories error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
