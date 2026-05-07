import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticatedFetch } from '@/utils/apiAuth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await params;
    
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    // Read and parse the request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[Photo Update Proxy] Failed to parse request body:', parseError);
      return NextResponse.json({ 
        error: 'body_parse_failed', 
        details: parseError instanceof Error ? parseError.message : String(parseError) 
      }, { status: 400 });
    }

    const res = await authenticatedFetch(`/items/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`, accessToken, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await res.text();
      console.error('Non-JSON response from API:', text.substring(0, 200));
      return NextResponse.json({ error: 'api_returned_non_json', status: res.status }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[Photo Update Proxy] Error:', e);
    return NextResponse.json({ 
      error: 'proxy_failed', 
      details: e instanceof Error ? e.message : String(e) 
    }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await params;
    
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const res = await authenticatedFetch(`/items/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`, accessToken, {
      method: 'DELETE',
    });

    // DELETE returns 204 No Content, so no JSON to parse
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    // If not 204, try to parse JSON (error response)
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    return new NextResponse(null, { status: res.status });
  } catch (e) {
    console.error('DELETE photo proxy error', e);
    return NextResponse.json({ error: 'proxy_failed', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
