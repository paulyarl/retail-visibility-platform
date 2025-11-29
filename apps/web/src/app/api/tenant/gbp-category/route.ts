import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/featureFlags';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';

/**
 * PUT /api/tenant/gbp-category
 * Set GBP business categories for a tenant (primary + secondary)
 * Automatically syncs to directory listings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, primary, secondary = [] } = body;

    // Validate input
    if (!tenantId || !primary?.id || !primary?.name) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, primary.id, primary.name' },
        { status: 400 }
      );
    }

    // Validate secondary categories (max 9)
    if (secondary.length > 9) {
      return NextResponse.json(
        { error: 'Maximum 9 secondary categories allowed' },
        { status: 400 }
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

    // Update business profile with GBP categories
    // This will trigger the database trigger to sync to tenants.metadata and refresh the materialized view
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    };
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    
    const response = await fetch(`${API_BASE_URL}/api/tenant/gbp-category`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        tenantId,
        primary,
        secondary,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update GBP category' }));
      return NextResponse.json(
        { error: error.error || 'Failed to set GBP categories' },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'GBP categories updated and synced to directory',
      data: result,
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
