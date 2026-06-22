/**
 * Admin BSaaS Promotions API Route (Proxy)
 *
 * Forwards requests to the API server with Auth0 session authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const response = await authenticatedFetch('/api/admin/bsaas-promotions', accessToken, { method: 'GET' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[BSaaS Promotions Proxy GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch BSaaS promotions' }, { status: 500 });
  }
}
