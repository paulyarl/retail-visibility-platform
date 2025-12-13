import { NextRequest, NextResponse } from 'next/server';

function buildAuthHeaders(req: Request): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  const cookie = req.headers.get('cookie') || ''
  let auth = req.headers.get('authorization') || undefined
  if (!auth) {
    const jar = Object.fromEntries(cookie.split(';').map(p => p.trim()).filter(Boolean).map(kv => {
      const i = kv.indexOf('=')
      return i === -1 ? [kv, ''] : [kv.slice(0, i), decodeURIComponent(kv.slice(1 + i))]
    })) as Record<string, string>
    const token = jar['ACCESS_TOKEN'] || jar['access_token'] || jar['token'] || jar['auth_token']
    if (token) auth = `Bearer ${token}`
  }
  if (auth) headers['Authorization'] = auth
  if (cookie) headers['Cookie'] = cookie
  return headers
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = searchParams.get('limit') || '50';
    
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const headers = buildAuthHeaders(req);
    
    // Call the Google taxonomy search endpoint
    const res = await fetch(`${base}/api/google/taxonomy/search?q=${encodeURIComponent(query)}&limit=${limit}`, {
      headers,
      cache: 'no-store',
    });
    
    const data = await res.json();
    
    // Transform response to expected format (results array)
    const results = data.categories?.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      path: cat.path || cat.fullPath?.split(' > ') || []
    })) || [];
    
    return NextResponse.json({ results }, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] GET /categories/search error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
