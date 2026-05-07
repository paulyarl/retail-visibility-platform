/**
 * Public Store Endpoint
 * 
 * Returns rich store data from mv_global view
 * Provides comprehensive store information for product pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;

    // Query the global discovery view for store information
    const storeQuery = `
      SELECT 
        tenant_id,
        tenant_name,
        tenant_slug,
        profile_image_url,
        hero_image_url,
        description,
        address,
        city,
        state,
        zip_code,
        country,
        phone,
        website,
        email,
        hours_json,
        categories,
        rating,
        review_count,
        item_status,
        visibility
      FROM mv_global_discovery
      WHERE tenant_id = $1
        AND item_status = 'active'
        AND visibility = 'public'
      LIMIT 1
    `;

    const result = await prisma.$queryRawUnsafe(storeQuery, [tenantId]);

    if (!Array.isArray(result) || result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    const storeData = result[0];

    // Transform data to match expected format
    const transformedStore = {
      id: storeData.tenant_id,
      name: storeData.tenant_name,
      slug: storeData.tenant_slug,
      logo_url: storeData.tenant_logo_url,
      city: storeData.tenant_city,
      state: storeData.tenant_state,
      country: storeData.tenant_country,
      zip: storeData.tenant_zip,
      address: storeData.tenant_address,
      latitude: storeData.tenant_latitude,
      longitude: storeData.tenant_longitude,
      subscription_tier: storeData.subscription_tier,
      shop_category: storeData.shop_category,
      average_rating: storeData.store_average_rating,
      review_count: storeData.store_review_count,
      business_type: storeData.business_type,
      business_category: storeData.business_category,
      created_at: storeData.created_at,
      updated_at: storeData.updated_at,
      mv_refreshed_at: storeData.mv_refreshed_at
    };

    return NextResponse.json({
      success: true,
      data: transformedStore
    });

  } catch (error) {
    console.error('Store API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
