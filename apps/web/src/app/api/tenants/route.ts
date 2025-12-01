import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const base = process.env.API_BASE_URL || 'http://localhost:4000';

  // Preserve query parameters (e.g. includeArchived, status) when proxying to the API
  const url = new URL(req.url);
  const query = url.searchParams.toString();
  const upstreamUrl = `${base}/api/tenants${query ? `?${query}` : ''}`;
  
  // Forward Authorization header from client to backend
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  const res = await fetch(upstreamUrl, { headers });
  
  if (!res.ok) {
    const text = await res.text();
    console.error('[API Proxy] Error response:', text);
    return NextResponse.json({ error: 'upstream_failed', status: res.status, body: text }, { status: res.status });
  }
  
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    
    // Forward Authorization header from client to backend
    const authHeader = req.headers.get('authorization');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const res = await fetch(`${base}/api/tenants`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (_e) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
