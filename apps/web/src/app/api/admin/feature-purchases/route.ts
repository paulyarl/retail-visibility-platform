/**
 * Admin Feature Purchases API Route (Proxy)
 *
 * Forwards requests to the API server with Auth0 session authentication.
 * Real operations are handled by apps/api/src/routes/admin/feature-purchases.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    let endpoint: string;
    if (action === 'grants') {
      const params = new URLSearchParams();
      const featureKey = url.searchParams.get('featureKey');
      const tenantId = url.searchParams.get('tenantId');
      const status = url.searchParams.get('status');
      if (featureKey) params.set('featureKey', featureKey);
      if (tenantId) params.set('tenantId', tenantId);
      if (status) params.set('status', status);
      const qs = params.toString();
      endpoint = `/api/admin/feature-purchases/grants${qs ? `?${qs}` : ''}`;
    } else {
      const queryParams = url.searchParams.toString();
      endpoint = `/api/admin/feature-purchases${queryParams ? `?${queryParams}` : ''}`;
    }

    const response = await authenticatedFetch(endpoint, accessToken, { method: 'GET' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Feature Purchases Proxy GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch feature purchases' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const requestBody = await request.json();

    const endpoint = action === 'grant-complimentary'
      ? '/api/admin/feature-purchases/grant-complimentary'
      : action === 'create-grant-token'
      ? '/api/admin/feature-purchases/create-grant-token'
      : '/api/admin/feature-purchases';

    const response = await authenticatedFetch(endpoint, accessToken, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Feature Purchases Proxy POST] Error:', error);
    return NextResponse.json({ error: 'Failed to process feature purchase request' }, { status: 500 });
  }
}
