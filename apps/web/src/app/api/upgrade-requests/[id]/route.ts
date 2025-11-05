import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

export const dynamic = 'force-dynamic';

function getAuthToken(req: NextRequest): string | null {
  let token = req.cookies.get('access_token')?.value;
  
  if (!token) {
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/access_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }
  }
  
  return token || null;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
    }

    const { id } = await context.params;
    const res = await fetch(`${API_BASE_URL}/upgrade-requests/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    const token = getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    
    const res = await fetch(`${API_BASE_URL}/upgrade-requests/${id}`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
    const token = getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
    }

    const { id } = await context.params;
    const res = await fetch(`${API_BASE_URL}/upgrade-requests/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting upgrade request:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}