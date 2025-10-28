import { NextResponse } from 'next/server';
import { proxyPut, proxyDelete } from '@/lib/api-proxy';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; userId: string }> | { tenantId: string; userId: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const body = await req.json();
    const res = await proxyPut(req, `/tenants/${resolvedParams.tenantId}/users/${resolvedParams.userId}`, body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /tenants/:tenantId/users/:userId PUT] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to update user role' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ tenantId: string; userId: string }> | { tenantId: string; userId: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const res = await proxyDelete(req, `/tenants/${resolvedParams.tenantId}/users/${resolvedParams.userId}`);
    
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /tenants/:tenantId/users/:userId DELETE] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to remove user from tenant' },
      { status: 500 }
    );
  }
}
