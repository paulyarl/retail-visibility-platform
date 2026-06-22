/**
 * Admin BSaaS Promotions - Deactivate Promotion Code (Proxy)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const response = await authenticatedFetch(
      `/api/admin/bsaas-promotions/promotion/${params.id}`,
      accessToken,
      { method: 'DELETE' }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[BSaaS Promotions Proxy DELETE /promotion/:id] Error:', error);
    return NextResponse.json({ error: 'Failed to deactivate promotion code' }, { status: 500 });
  }
}
