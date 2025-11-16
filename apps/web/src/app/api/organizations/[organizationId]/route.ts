import { NextRequest, NextResponse } from 'next/server';

function buildAuthHeaders(req: Request): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  const cookie = req.headers.get('cookie') || ''
  let auth = req.headers.get('authorization') || undefined
  if (!auth) {
    const jar = Object.fromEntries(cookie.split(';').map(p => p.trim()).filter(Boolean).map(kv => {
      const i = kv.indexOf('=')
      return i === -1 ? [kv, ''] : [kv.slice(0, i), decodeURIComponent(kv.slice(1 + i))]
    })) as Record<string, string>
    const token = jar['ACCESS_TOKEN'] || jar['access_token'] || jar['token'] || jar['auth_token']
    if (token) auth = `Bearer ${token}`
  }
  if (auth) headers['Authorization'] = auth
  if (cookie) headers['Cookie'] = cookie
  return headers
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params;

  try {
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const headers = buildAuthHeaders(req);
    const response = await fetch(`${base}/api/organizations/${organizationId}`, {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json(errorData, { status: response.status });
      } catch {
        return NextResponse.json({ message: errorText || 'Failed to fetch organization' }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Organizations API] Error:', error.message);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
