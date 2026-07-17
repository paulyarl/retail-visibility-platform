/**
 * Tenant Logo API Route
 * Provides tenant logo URL from mv_storefront_discovery materialized view
 */

import { Router } from 'express';
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/public/tenant/:tenantId/logo
 * Get tenant logo URL from mv_storefront_discovery materialized view
 */
router.get('/:tenantId/logo', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Use direct pool like ShopService does for mv_storefront_discovery queries
    const pool = getDirectPool();
    const result = await pool.query(
      'SELECT tenant_logo_url FROM mv_storefront_discovery WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );

    if (result.rows && result.rows.length > 0) {
      const logoUrl = result.rows[0].tenant_logo_url;
      return res.json({
        success: true,
        data: [{ tenant_logo_url: logoUrl }]
      });
    }

    return res.json({
      success: true,
      data: []
    });
  } catch (error) {
    logger.error('[Tenant Logo API] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant logo',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
