import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/organizations/${id}/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] POST /organizations/:id/tenants error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
