import { NextResponse } from 'next/server';
import { proxyGet, proxyPost, proxyPut } from '@/lib/api-proxy';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = `/permissions${url.search}`;
  
  try {
    const res = await proxyGet(req, path);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /permissions] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const path = `/permissions${url.pathname.replace('/api/permissions', '')}${url.search}`;
  
  try {
    const body = await req.json();
    const res = await proxyPost(req, path, body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /permissions POST] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to update permissions' },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const path = `/permissions${url.pathname.replace('/api/permissions', '')}${url.search}`;
  
  try {
    const body = await req.json();
    const res = await proxyPut(req, path, body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /permissions PUT] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to update permission' },
      { status: 500 }
    );
  }
}
