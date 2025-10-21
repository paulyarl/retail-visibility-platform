import { NextResponse } from 'next/server';

export async function GET() {
  // Note: Authentication is handled by the backend API and the Protected component on pages
  // API routes in Next.js 15 don't reliably have access to Supabase sessions
  
  const base = process.env.API_BASE_URL || 'http://localhost:4000';
  console.log('[API Proxy] Fetching tenants from:', `${base}/tenants`);
  
  // Backend will handle user filtering based on its own authentication
  const res = await fetch(`${base}/tenants`);
  
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
    const res = await fetch(`${base}/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (_e) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
