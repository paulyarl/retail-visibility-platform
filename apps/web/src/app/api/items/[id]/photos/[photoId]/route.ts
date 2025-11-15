import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    console.log('[Next.js Proxy] PUT request received');
    const { id, photoId } = await params;
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const url = `${base}/items/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`;
    console.log('[Next.js Proxy] Target URL:', url);

    // Create headers object, excluding problematic headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add Authorization if present
    const auth = req.headers.get('authorization');
    if (auth) headers['Authorization'] = auth;

    // Add other safe headers but exclude traceparent and other problematic ones
    const excludeHeaders = ['traceparent', 'tracestate', 'x-trace-id', 'x-span-id', 'x-b3-traceid', 'x-b3-spanid', 'x-b3-parentspanid', 'x-b3-sampled', 'x-b3-flags'];
    req.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (key.startsWith('x-') || key.startsWith('trace') || excludeHeaders.includes(lowerKey)) {
        console.log(`[Next.js Proxy] Filtering out header: ${key}`);
        return; // Skip tracing and custom headers
      }
      if (!headers[key]) {
        headers[key] = value;
      }
    });

    console.log('[Next.js Proxy] Final headers being sent:', Object.keys(headers));

    // Read the request body as JSON
    console.log('[Next.js Proxy] Reading request body...');
    const body = await req.json();
    console.log('[Next.js Proxy] Request body parsed:', JSON.stringify(body));
    console.log('[Next.js Proxy] Body stringified for backend:', JSON.stringify(body));

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      const text = await res.text();
      console.error('Non-JSON response from API:', text.substring(0, 200));
      return NextResponse.json({ error: 'api_returned_non_json', status: res.status }, { status: 500 });
    }

    const data = await res.json();
    console.log('Backend response status:', res.status, 'data:', data);

    // Handle specific traceparent error from backend
    if (res.status === 500 && data.error === 'invalid traceparent header') {
      console.warn('Backend rejected traceparent header, retrying without it');
      // Retry without any tracing headers
      const cleanHeaders = {
        'Content-Type': 'application/json',
        'Authorization': headers['Authorization'] || '',
      };

      const retryRes = await fetch(url, {
        method: 'PUT',
        headers: cleanHeaders,
        body: JSON.stringify(body),
      });

      const retryContentType = retryRes.headers.get('content-type');
      if (retryContentType?.includes('application/json')) {
        const retryData = await retryRes.json();
        console.log('Retry response:', retryRes.status, retryData);
        return NextResponse.json(retryData, { status: retryRes.status });
      }

      // If retry also fails, return original error
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('PUT photo proxy error', e);
    return NextResponse.json({ error: 'proxy_failed', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await params;
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const url = `${base}/items/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`;

    const res = await fetch(url, {
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
