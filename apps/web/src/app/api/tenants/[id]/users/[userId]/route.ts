import { NextRequest, NextResponse } from 'next/server';
import { proxyPut, proxyDelete } from '@/lib/api-proxy';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> | { id: string; userId: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const body = await req.json();
    const res = await proxyPut(req, `/tenants/${resolvedParams.id}/users/${resolvedParams.userId}`, body);
    return new Response(res.body, {
      status: res.status,
      headers: res.headers
    });
  } catch (error) {
    console.error('Error updating tenant user role:', error);
    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> | { id: string; userId: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const res = await proxyDelete(req, `/tenants/${resolvedParams.id}/users/${resolvedParams.userId}`);
    return new Response(res.body, {
      status: res.status,
      headers: res.headers
    });
  } catch (error) {
    console.error('Error removing user from tenant:', error);
    return NextResponse.json(
      { error: 'Failed to remove user from tenant' },
      { status: 500 }
    );
  }
}
