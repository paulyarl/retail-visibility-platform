import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticatedFetch } from '@/utils/apiAuth';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await context.params;
    const body = await req.json();
    
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;
    
    const res = await authenticatedFetch(`/api/tenant/${encodeURIComponent(tenantId)}/banner`, accessToken, {
      method: 'POST',
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
    console.error(`[API Proxy] POST /tenants/${(await context.params).id}/banner error:`, e);
    return NextResponse.json({ error: 'proxy_failed', message: String(e) }, { status: 500 });
  }
}
