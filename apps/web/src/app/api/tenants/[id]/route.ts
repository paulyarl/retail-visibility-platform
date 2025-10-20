import { NextRequest, NextResponse } from 'next/server';

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await _req.json();
    const res = await fetch(`http://localhost:4000/tenants/${encodeURIComponent(params.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (_e) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const res = await fetch(`http://localhost:4000/tenants/${encodeURIComponent(params.id)}`, {
      method: 'DELETE',
    });
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (_e) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
