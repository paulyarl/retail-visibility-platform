import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticatedFetch } from '@/utils/apiAuth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const res = await authenticatedFetch(`/items/${encodeURIComponent(id)}/photos/reorder`, accessToken, {
      method: 'PUT',
      body: req.body,
      // @ts-expect-error - duplex is a new fetch feature
      duplex: 'half',
    });

    // Reorder returns 204 No Content on success
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    // If not 204, try to parse JSON (error response)
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    return new NextResponse(null, { status: res.status });
  } catch (e) {
    console.error('Reorder photos proxy error', e);
    return NextResponse.json({ error: 'proxy_failed', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
