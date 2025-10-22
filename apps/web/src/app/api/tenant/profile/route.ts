import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tenant/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      return NextResponse.json(errorData, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] POST /tenant/profile error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
