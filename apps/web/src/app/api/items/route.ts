import { NextRequest, NextResponse } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  // Forward all query params to backend
  const queryString = searchParams.toString();
  // DEBUG: Log the forwarded query string (redact obvious secrets if any)
  console.log('[API /items] Forwarding to backend with query:', queryString || '<empty>');
  
  const res = await proxyGet(req, `/items?${queryString}`);
  const data = await res.json();
  // DEBUG: Log response shape without dumping large payloads
  try {
    const shape = Array.isArray(data)
      ? { type: 'array', length: data.length }
      : (data && typeof data === 'object')
        ? { type: 'object', keys: Object.keys(data).slice(0, 8), itemsLen: Array.isArray((data as any).items) ? (data as any).items.length : undefined }
        : { type: typeof data };
    console.log('[API /items] Backend response:', { status: res.status, shape });
  } catch {}
  
  // Handle both old (array) and new (paginated object) response formats
  if (!res.ok) {
    console.error('[items API] Backend error:', data);
    return NextResponse.json({ error: data.error || 'failed_to_fetch' }, { status: res.status });
  }
  
  // Return the data as-is (supports both formats)
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await proxyPost(req, '/items', body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
