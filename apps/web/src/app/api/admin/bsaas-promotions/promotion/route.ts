/**
 * Admin BSaaS Promotions - Create Promotion Code (Proxy)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const requestBody = await request.json();

    const response = await authenticatedFetch('/api/admin/bsaas-promotions/promotion', accessToken, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[BSaaS Promotions Proxy POST /promotion] Error:', error);
    return NextResponse.json({ error: 'Failed to create promotion code' }, { status: 500 });
  }
}
