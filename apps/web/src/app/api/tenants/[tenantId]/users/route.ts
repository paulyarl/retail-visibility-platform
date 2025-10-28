import { NextResponse } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const res = await proxyGet(req, `/tenants/${resolvedParams.tenantId}/users`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /tenants/:tenantId/users GET] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to fetch tenant users' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> | { tenantId: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const body = await req.json();
    const res = await proxyPost(req, `/tenants/${resolvedParams.tenantId}/users`, body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /tenants/:tenantId/users POST] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to add user to tenant' },
      { status: 500 }
    );
  }
}
