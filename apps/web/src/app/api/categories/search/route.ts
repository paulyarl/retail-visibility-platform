import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = searchParams.get('limit') || '50';
    
    // Get optional Auth0 session
    const auth = await getAuth0Session(req);
    const accessToken = auth?.accessToken || null;
    
    // Call the Google taxonomy search endpoint
    const res = await authenticatedFetch(`/api/google/taxonomy/search?q=${encodeURIComponent(query)}&limit=${limit}`, accessToken, {
      method: 'GET',
    });
    
    const data = await res.json();
    
    // Transform response to expected format (results array)
    const results = data.categories?.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      path: cat.path || cat.fullPath?.split(' > ') || []
    })) || [];
    
    return NextResponse.json({ results }, { status: res.status });
  } catch (e) {
    console.error('[API Proxy] GET /categories/search error:', e);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
