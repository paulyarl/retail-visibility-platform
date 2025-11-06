import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/featureFlags';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';

/**
 * PUT /api/tenant/gbp-category
 * Set GBP business category for a tenant
 * Feature-gated by FF_TENANT_GBP_CATEGORY_SYNC
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, gbpCategoryId, gbpCategoryName } = body;

    if (!tenantId || !gbpCategoryId || !gbpCategoryName) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, gbpCategoryId, gbpCategoryName' },
        { status: 400 }
      );
    }

    // Feature gate
    if (!isFeatureEnabled('FF_TENANT_GBP_CATEGORY_SYNC', tenantId)) {
      return NextResponse.json(
        { error: 'GBP category sync not enabled for this tenant' },
        { status: 403 }
      );
    }

    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Update tenant business profile with GBP category
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    };
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    
    const response = await fetch(`${API_BASE_URL}/api/tenant/profile`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        tenant_id: tenantId,
        gbpCategoryId,
        gbpCategoryName,
        gbpCategorySyncStatus: 'pending', // Will be updated by worker
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update profile' }));
      return NextResponse.json(
        { error: error.error || 'Failed to set GBP category' },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Queue mirror job if FF_CATEGORY_MIRRORING is enabled
    const mirroringEnabled = isFeatureEnabled('FF_CATEGORY_MIRRORING', tenantId);
    if (mirroringEnabled) {
      // TODO: Queue GBP mirror job
      // For now, just log that it would be queued
      console.log('[GBP Category API] Would queue mirror job for tenant:', tenantId);
    }

    return NextResponse.json({
      success: true,
      data: result,
      status: mirroringEnabled ? 'queued' : 'ok',
    });
  } catch (error) {
    console.error('[GBP Category API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to set GBP category' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tenant/gbp-category?tenantId=...
 * Get GBP business category for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId parameter' },
        { status: 400 }
      );
    }

    // Feature gate
    if (!isFeatureEnabled('FF_TENANT_GBP_CATEGORY_SYNC', tenantId)) {
      return NextResponse.json(
        { error: 'GBP category sync not enabled for this tenant' },
        { status: 403 }
      );
    }

    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    // Fetch tenant profile
    const headers: HeadersInit = {};
    if (authHeader) headers['Authorization'] = authHeader;
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    
    const response = await fetch(`${API_BASE_URL}/api/tenant/profile?tenant_id=${tenantId}`, {
      headers,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch tenant profile' },
        { status: response.status }
      );
    }

    const profile = await response.json();

    return NextResponse.json({
      gbpCategoryId: profile.gbpCategoryId || null,
      gbpCategoryName: profile.gbpCategoryName || null,
      gbpCategoryLastMirrored: profile.gbpCategoryLastMirrored || null,
      gbpCategorySyncStatus: profile.gbpCategorySyncStatus || null,
    });
  } catch (error) {
    console.error('[GBP Category API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get GBP category' },
      { status: 500 }
    );
  }
}
