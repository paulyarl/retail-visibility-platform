import { NextResponse } from 'next/server';
import { proxyGet, proxyPut, proxyDelete } from '@/lib/api-proxy';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const res = await proxyGet(req, `/users/${resolvedParams.id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /users/:id GET] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const body = await req.json();
    const res = await proxyPut(req, `/users/${resolvedParams.id}`, body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /users/:id PUT] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const res = await proxyDelete(req, `/users/${resolvedParams.id}`);
    
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /users/:id DELETE] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
