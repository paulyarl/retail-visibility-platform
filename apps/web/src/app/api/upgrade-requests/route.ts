import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticatedFetch } from '@/utils/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const searchParams = req.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const endpoint = `/upgrade-requests${queryString ? `?${queryString}` : ''}`;
    
    const res = await authenticatedFetch(endpoint, accessToken, {
      method: 'GET',
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Error fetching upgrade requests:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const body = await req.json();
    
    const res = await authenticatedFetch('/upgrade-requests', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Error creating upgrade request:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}