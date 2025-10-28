import { NextResponse } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(req: Request) {
  try {
    const res = await proxyGet(req, '/users');
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[API Proxy /users] Error:', error);
    return NextResponse.json(
      { error: 'proxy_failed', message: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
