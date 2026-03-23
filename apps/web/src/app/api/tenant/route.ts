import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticatedFetch } from '@/utils/apiAuth';

/**
 * GET /api/tenant
 * Get current user's tenant information
 */
export async function GET(req: NextRequest) {
  try {
    // Require authentication via Auth0 session
    const authResult = await requireAuth(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken, session } = authResult;

    // Get user's tenant from Auth0 user metadata or app metadata
    const user = session?.user;
    const tenantId = user?.tenant_id || user?.['https://visible.shelf/tenant_id'];
    
    console.log('[GET /api/tenant] User tenant:', { userId: user?.sub, tenantId });

    if (!tenantId) {
      console.error('[GET /api/tenant] Tenant not found for user');
      return NextResponse.json({ error: 'tenant_not_found', details: 'User has no tenant' }, { status: 400 });
    }

    // Fetch tenant from backend API with auth token
    const res = await authenticatedFetch(`/api/tenants/${tenantId}`, accessToken, {
      method: 'GET',
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: 'tenant_not_found' }, { status: 400 });
    }

    const tenant = await res.json();

    return NextResponse.json(tenant);
  } catch (error) {
    console.error('[GET /api/tenant] Error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
