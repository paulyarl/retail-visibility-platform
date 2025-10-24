import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/categories`, {
      headers: { 'Content-Type': 'application/json' },
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
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] POST /categories error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
