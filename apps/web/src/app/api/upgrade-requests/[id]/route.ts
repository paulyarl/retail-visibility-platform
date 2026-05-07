import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticatedFetch } from '@/utils/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const { id } = await context.params;
    const res = await authenticatedFetch(`/upgrade-requests/${id}`, accessToken, {
      method: 'GET',
    });
    const data = await res.json();
    
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Error fetching upgrade request:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const { id } = await context.params;
    const body = await req.json();
    
    const res = await authenticatedFetch(`/upgrade-requests/${id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Error updating upgrade request:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const { id } = await context.params;
    const res = await authenticatedFetch(`/upgrade-requests/${id}`, accessToken, {
      method: 'DELETE',
    });
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting upgrade request:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}