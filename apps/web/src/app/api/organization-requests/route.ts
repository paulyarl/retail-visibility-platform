import { NextRequest, NextResponse } from 'next/server';
import { proxyGet, proxyPost } from '@/lib/api-proxy';

// GET /api/organization-requests - List all requests (Admin only) or user's requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = `/organization-requests${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const res = await proxyGet(request, path);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[Organization Requests] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization requests' },
      { status: 500 }
    );
  }
}

// POST /api/organization-requests - Create a new request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await proxyPost(request, '/organization-requests', body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[Organization Requests] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create organization request' },
      { status: 500 }
    );
  }
}
