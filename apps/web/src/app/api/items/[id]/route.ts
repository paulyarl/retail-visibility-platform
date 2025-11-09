import { NextRequest, NextResponse } from 'next/server';
import { proxyGet, proxyPut, proxyPatch, proxyDelete } from '@/lib/api-proxy';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await proxyGet(req, `/items/${id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] GET /items/:id error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const res = await proxyPut(req, `/items/${id}`, body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] PUT /items/:id error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const url = new URL(req.url);
    const queryString = url.searchParams.toString();
    const path = `/items/${id}${queryString ? `?${queryString}` : ''}`;
    const res = await proxyPatch(req, path, body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] PATCH /items/:id error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const res = await proxyDelete(req, `/items/${id}`);
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] DELETE /items/:id error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
