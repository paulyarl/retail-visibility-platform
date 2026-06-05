import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await params;
    const body = await req.json();
    
    // Get optional Auth0 session
    const auth = await getAuth0Session(req);
    const accessToken = auth?.accessToken || null;
    
    const response = await authenticatedFetch(`/api/organizations/${organizationId}/tenants`, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[Organizations API] Add tenant error:', error.message);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
