import { NextRequest, NextResponse } from 'next/server';
import { authenticatedFetch } from '@/utils/apiAuth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    
    // Public endpoint - no authentication required for invitation lookup
    const res = await authenticatedFetch(`/api/admin/invitations/${token}`, null, {
      method: 'GET',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] GET /api/admin/invitations/[token] error:', e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
