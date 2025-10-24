import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; tenantId: string }> }) {
  try {
    const { id, tenantId } = await params;
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/organizations/${id}/tenants/${tenantId}`, {
      method: 'DELETE',
    });
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] DELETE /organizations/:id/tenants/:tenantId error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
