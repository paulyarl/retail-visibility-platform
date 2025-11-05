import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Get auth token from cookies
    let token = req.cookies.get('access_token')?.value;
    
    // Fallback: parse from cookie header directly
    if (!token) {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const match = cookieHeader.match(/access_token=([^;]+)/);
        if (match) {
          token = match[1];
        }
      }
    }
    
    if (!token) {
      return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/upgrade-requests${queryString ? `?${queryString}` : ''}`;
    
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json();
    
    console.log('[Upgrade Requests API] Response:', { 
      status: res.status, 
      dataKeys: Object.keys(data),
      requestsCount: data.requests?.length || 0,
      dataCount: data.data?.length || 0,
      paginationTotal: data.pagination?.total
    });
    
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Error fetching upgrade requests:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get auth token from cookies
    let token = req.cookies.get('access_token')?.value;
    
    // Fallback: parse from cookie header directly
    if (!token) {
      const cookieHeader = req.headers.get('cookie');
      if (cookieHeader) {
        const match = cookieHeader.match(/access_token=([^;]+)/);
        if (match) {
          token = match[1];
        }
      }
    }
    
    if (!token) {
      return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
    }

    const body = await req.json();
    
    const res = await fetch(`${API_BASE_URL}/upgrade-requests`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Error creating upgrade request:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}