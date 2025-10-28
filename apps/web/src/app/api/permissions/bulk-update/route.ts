import { NextResponse } from 'next/server';
import { proxyPost } from '@/lib/api-proxy';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await proxyPost(req, '/permissions/bulk-update', body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /permissions/bulk-update] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to bulk update permissions' },
      { status: 500 }
    );
  }
}
