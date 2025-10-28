import { NextRequest, NextResponse } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_required' }, { status: 400 });
  }
  
  const res = await proxyGet(req, `/items?tenantId=${encodeURIComponent(tenantId)}`);
  const data = await res.json();
  
  // If backend returns error, ensure we return empty array to client
  if (!res.ok || !Array.isArray(data)) {
    console.error('[items API] Backend error:', data);
    return NextResponse.json([], { status: res.ok ? 200 : res.status });
  }
  
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await proxyPost(req, '/items', body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
