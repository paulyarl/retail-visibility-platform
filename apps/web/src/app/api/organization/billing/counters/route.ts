import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const url = new URL(req.url);
    const queryString = url.searchParams.toString();
    
    const res = await fetch(`${base}/organization/billing/counters?${queryString}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] GET /organization/billing/counters error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
