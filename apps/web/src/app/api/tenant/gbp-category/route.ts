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

    // Prepare GBP categories structure
    const gbpCategories = {
      primary: {
        id: primary.id,
        name: primary.name,
        selected_at: new Date().toISOString(),
      },
      secondary: secondary.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        selected_at: new Date().toISOString(),
      })),
      sync_status: 'pending',
      last_synced_at: null,
    };

    // Update tenant metadata with GBP categories
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    };
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    
    const response = await fetch(`${API_BASE_URL}/api/tenants/${tenantId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        metadata: {
          gbp_categories: gbpCategories,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update tenant' }));
      return NextResponse.json(
        { error: error.error || 'Failed to set GBP categories' },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Trigger sync to directory
    try {
      const syncResponse = await fetch(`${API_BASE_URL}/api/gbp/sync-to-directory`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tenantId,
          gbpCategories: {
            primary: gbpCategories.primary,
            secondary: gbpCategories.secondary,
          },
        }),
      });

      if (!syncResponse.ok) {
        console.error('[GBP Category API] Sync to directory failed');
        // Don't fail the request, just log the error
      }
    } catch (syncError) {
      console.error('[GBP Category API] Sync to directory error:', syncError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      data: result,
      gbpCategories: {
        primary: gbpCategories.primary,
        secondary: gbpCategories.secondary,
      },
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
