import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // Get optional Auth0 session
    const auth = await getAuth0Session(req);
    const accessToken = auth?.accessToken || null;
    
    const res = await authenticatedFetch(`/api/platform/categories/${id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] PATCH /platform/categories/[id] error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get optional Auth0 session
    const auth = await getAuth0Session(req);
    const accessToken = auth?.accessToken || null;
    
    const res = await authenticatedFetch(`/api/platform/categories/${id}`, accessToken, {
      method: 'DELETE',
    });
    
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] DELETE /platform/categories/[id] error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
