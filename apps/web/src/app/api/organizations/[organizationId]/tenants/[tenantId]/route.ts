import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string; tenantId: string }> }
) {
  try {
    const { organizationId, tenantId } = await params;
    
    // Get optional Auth0 session
    const auth = await getAuth0Session(req);
    const accessToken = auth?.accessToken || null;
    
    const response = await authenticatedFetch(`/api/organizations/${organizationId}/tenants/${tenantId}`, accessToken, {
      method: 'DELETE',
    });

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[Organizations API] Remove tenant error:', error.message);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
