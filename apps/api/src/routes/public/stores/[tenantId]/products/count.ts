/**
 * Store Product Count Endpoint
 * 
 * Returns the number of products for a store from mv_storefront_discovery view
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDirectPool } from '../../../../../utils/db-pool';
import { logger } from '../../../../../logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;

    // Query mv_storefront_discovery for product count
    const countQuery = `
      SELECT COUNT(DISTINCT inventory_item_id) as product_count
      FROM mv_storefront_discovery
      WHERE tenant_id = $1
        AND item_status = 'active'
        AND visibility = 'public'
    `;

    const pool = getDirectPool();
    const result = await pool.query(countQuery, [tenantId]);

    const productCount = parseInt(result.rows[0]?.product_count || '0');

    return NextResponse.json({
      success: true,
      data: {
        count: productCount
      }
    });

  } catch (error) {
    logger.error('Store Product Count API Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
