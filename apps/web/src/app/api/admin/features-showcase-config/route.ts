import { NextResponse } from 'next/server';

function buildAuthHeaders(req: Request): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const cookie = req.headers.get('cookie') || '';
  let auth = req.headers.get('authorization') || undefined;
  if (!auth) {
    const jar = Object.fromEntries(cookie.split(';').map(p => p.trim()).filter(Boolean).map(kv => {
      const i = kv.indexOf('=');
      return i === -1 ? [kv, ''] : [kv.slice(0, i), decodeURIComponent(kv.slice(1 + i))];
    })) as Record<string, string>;
    const token = jar['ACCESS_TOKEN'] || jar['access_token'] || jar['token'] || jar['auth_token'];
    if (token) auth = `Bearer ${token}`;
  }
  if (auth) headers['Authorization'] = auth;
  if (cookie) headers['Cookie'] = cookie;
  return headers;
}

// GET - Fetch current showcase configuration
export async function GET(req: Request) {
  try {
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const headers = buildAuthHeaders(req);
    const res = await fetch(`${base}/api/admin/features-showcase-config`, { headers, cache: 'no-store' });
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

// POST - Update showcase configuration
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const headers = buildAuthHeaders(req);
    const res = await fetch(`${base}/api/admin/features-showcase-config`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
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
