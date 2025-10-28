import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const base = process.env.API_BASE_URL || 'http://localhost:4000';
  console.log('[API Proxy] Fetching tenants from:', `${base}/tenants`);
  
  // Forward Authorization header from client to backend
  const authHeader = req.headers.get('authorization');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  const res = await fetch(`${base}/tenants`, { headers });
  
  console.log('[API Proxy] Response status:', res.status);
  
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
    
    const res = await fetch(`${base}/tenants`, {
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
