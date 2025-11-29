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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const headers = buildAuthHeaders(req);
    
    // Call the platform categories quick-start endpoint
    const res = await fetch(`${base}/api/platform/categories/quick-start`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] POST /platform/categories/quick-start error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
