import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await params;
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const url = `${base}/items/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.body,
      // @ts-expect-error - duplex is a new fetch feature
      duplex: 'half',
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
