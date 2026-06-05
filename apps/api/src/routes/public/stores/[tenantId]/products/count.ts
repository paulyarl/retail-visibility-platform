/**
 * Store Product Count Endpoint
 * 
 * Returns the number of products for a store from mv_global view
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDirectPool } from '../../../../../utils/db-pool';

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;

    // Query mv_global for product count
    const countQuery = `
      SELECT COUNT(DISTINCT inventory_item_id) as product_count
      FROM mv_global_discovery
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
    console.error('Store Product Count API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
