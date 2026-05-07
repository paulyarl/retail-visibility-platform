import { NextRequest, NextResponse } from 'next/server';
import { authenticatedFetch } from '@/utils/apiAuth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json();
    
    // Public endpoint - no authentication required for accepting invitation
    const res = await authenticatedFetch(`/api/admin/invitations/${token}/accept`, null, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] POST /api/admin/invitations/[token]/accept error:', e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
