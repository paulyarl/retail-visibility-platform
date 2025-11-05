import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await context.params;
    
    // Get auth token from cookies
    const token = req.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'unknown_error' }));
      return NextResponse.json(errorData, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error(`[API Proxy] DELETE /api/admin/users/${(await context.params).id} error:`, e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
