import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    
    // Forward Authorization header
    const authHeader = req.headers.get('authorization');
    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const res = await fetch(`${base}/tenants/${encodeURIComponent(id)}`, { headers });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (_e) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    
    // Forward Authorization header
    const authHeader = req.headers.get('authorization');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const res = await fetch(`${base}/tenants/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (_e) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    console.log('[PATCH /api/tenants/:id] Proxying to:', `${base}/tenants/${id}`);
    console.log('[PATCH /api/tenants/:id] Body:', body);
    
    // Forward Authorization header
    const authHeader = req.headers.get('authorization');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const res = await fetch(`${base}/tenants/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    
    console.log('[PATCH /api/tenants/:id] Response status:', res.status);
    
    // Handle non-JSON responses (like HTML error pages)
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('[PATCH /api/tenants/:id] Non-JSON response:', contentType);
      return NextResponse.json(
        { error: 'backend_error', message: 'Backend returned non-JSON response', status: res.status },
        { status: res.status }
      );
    }
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[PATCH /api/tenants/:id] Error:', e);
    return NextResponse.json({ error: 'proxy_failed', details: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    
    // Forward Authorization header
    const authHeader = req.headers.get('authorization');
    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    const res = await fetch(`${base}/tenants/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    if (res.status === 204) return new NextResponse(null, { status: 204 });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (_e) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
