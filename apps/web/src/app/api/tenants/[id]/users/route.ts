import { NextRequest, NextResponse } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const res = await proxyGet(req, `/tenants/${resolvedParams.id}/users`);
    return new Response(res.body, {
      status: res.status,
      headers: res.headers
    });
  } catch (error) {
    console.error('Error in tenant users GET:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant users' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const body = await req.json();
    const res = await proxyPost(req, `/tenants/${resolvedParams.id}/users`, body);
    return new Response(res.body, {
      status: res.status,
      headers: res.headers
    });
  } catch (error) {
    console.error('Error adding user to tenant:', error);
    return NextResponse.json(
      { error: 'Failed to add user to tenant' },
      { status: 500 }
    );
  }
}
