import { NextRequest, NextResponse } from 'next/server';

async function handleProfileRequest(req: NextRequest, method: 'POST' | 'PATCH') {
  try {
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const body = await req.json();
    const res = await fetch(`${base}/tenant/profile`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('authorization') || '',
      },
      body: JSON.stringify(body),
    });
    
    const contentType = res.headers.get('content-type');
    
    // Check if response is HTML (404 or error page)
    if (contentType?.includes('text/html')) {
      console.error('[API Proxy] Backend returned HTML instead of JSON. Status:', res.status);
      return NextResponse.json(
        { error: 'backend_endpoint_not_found', message: 'The backend API endpoint may not be deployed yet.' },
        { status: 503 }
      );
    }
    
    if (!res.ok) {
      const errorData = await res.json();
      return NextResponse.json(errorData, { status: res.status });
    }
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error(`[API Proxy] ${method} /tenant/profile error:`, e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleProfileRequest(req, 'POST');
}

export async function PATCH(req: NextRequest) {
  return handleProfileRequest(req, 'PATCH');
}

export async function GET(req: NextRequest) {
  try {
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id') || url.searchParams.get('tenantId');
    const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
    const res = await fetch(`${base}/tenant/profile${qs}`, {
      method: 'GET',
      headers: {
        'Authorization': req.headers.get('authorization') || '',
      },
    });

    const contentType = res.headers.get('content-type');
    if (contentType?.includes('text/html')) {
      console.error('[API Proxy] Backend returned HTML instead of JSON. Status:', res.status);
      return NextResponse.json(
        { error: 'backend_endpoint_not_found', message: 'The backend API endpoint may not be deployed yet.' },
        { status: 503 }
      );
    }

    if (!res.ok) {
      const errorData = await res.json();
      return NextResponse.json(errorData, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] GET /tenant/profile error:', e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
