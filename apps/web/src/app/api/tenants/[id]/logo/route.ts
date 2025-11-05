import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await context.params;
    const body = await req.json();
    
    // Get auth token from cookies
    const token = req.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized', message: 'Authentication required' }, { status: 401 });
    }
    
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tenant/${encodeURIComponent(tenantId)}/logo`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
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
    console.error(`[API Proxy] POST /tenants/${(await context.params).id}/logo error:`, e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
