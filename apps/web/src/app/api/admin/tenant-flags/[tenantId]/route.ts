import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params
    
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const res = await authenticatedFetch(`/api/admin/tenant-flags/${encodeURIComponent(tenantId)}`, accessToken, {
      method: 'GET',
    });
    
    const ct = res.headers.get('content-type') || '';
    
    if (!ct.includes('application/json')) {
      const text = await res.text();
      return NextResponse.json({ success: false, error: text || `HTTP ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'proxy_failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const body = await req.json();
    
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const res = await authenticatedFetch(`/api/admin/tenant-flags/${encodeURIComponent(tenantId)}/${encodeURIComponent((body?.flag) || '')}`, accessToken, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text();
      return NextResponse.json({ success: false, error: text || `HTTP ${res.status}` }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'proxy_failed' }, { status: 500 });
  }
}
