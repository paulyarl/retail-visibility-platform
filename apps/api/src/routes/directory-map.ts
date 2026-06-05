/**
 * Directory Map Data Endpoint
 * 
 * Unified endpoint for fetching store locations for map display
 * Uses directory_settings_list which has reliable coordinate data
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';

const router = Router();

/**
 * GET /api/directory/map/locations
 * 
 * Get store locations with coordinates for map display
 * Supports filtering by category, store type, location, etc.
 * 
 * Query params:
 * - category: Filter by GBP category slug
 * - storeType: Filter by store type slug  
 * - city: Filter by city
 * - state: Filter by state
 * - limit: Max results (default: 100)
 */
router.get('/map/locations', async (req: Request, res: Response) => {
  try {
    const queryParams = req.query as { 
      category?: string; 
      storeType?: string; 
      city?: string; 
      state?: string; 
      q?: string; // Search query
      limit?: string 
    };
    const { category, storeType, city, state, q: searchQuery, limit = '100' } = queryParams;
    
    const pool = getDirectPool();
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by category (GBP primary or secondary)
    if (category) {
      conditions.push(`(dll.primary_category = $${paramIndex} OR $${paramIndex} = ANY(dll.secondary_categories))`);
      params.push(category);
      paramIndex++;
    }

    // Filter by store type - need to map slug to actual category
    if (storeType && !category) {
      // First, look up what category this store type represents
      // For now, handle common mappings
      const storeTypeToCategory: Record<string, string> = {
        'specialty-food-store': 'Indian Grocery Store', // Example mapping
        // Add more mappings based on your store types
      };

      const actualCategory = storeTypeToCategory[storeType] || storeType;
      conditions.push(`(dll.primary_category = $${paramIndex} OR $${paramIndex} = ANY(dll.secondary_categories))`);
      params.push(actualCategory);
      paramIndex++;
    }

    // Filter by city
    if (city) {
      conditions.push(`dll.city ILIKE $${paramIndex}`);
      params.push(`%${city}%`);
      paramIndex++;
    }

    // Filter by state
    if (state) {
      conditions.push(`dll.state = $${paramIndex}`);
      params.push(state);
      paramIndex++;
    }

    // Filter by search query (name or city)
    if (searchQuery) {
      conditions.push(`(t.name ILIKE $${paramIndex} OR dll.city ILIKE $${paramIndex})`);
      params.push(`%${searchQuery}%`);
      paramIndex++;
    }

    // Only include stores with coordinates
    conditions.push('dll.latitude IS NOT NULL');
    conditions.push('dll.longitude IS NOT NULL');

    const whereClause = conditions.join(' AND ');

    const sqlQuery = `
      SELECT 
        dsl.tenant_id as "tenantId",
        t.name as "businessName",
        dsl.slug,
        dll.address,
        dll.city,
        dll.state,
        dll.zip_code as "zipCode",
        dll.latitude,
        dll.longitude,
        (t.metadata->>'logo_url') as "logoUrl",
        dll.primary_category as "primaryCategory",
        dll.primary_category as "gbpPrimaryCategoryName",
        COALESCE(
          (SELECT COUNT(*) 
           FROM inventory_items 
           WHERE tenant_id = dsl.tenant_id 
             AND item_status = 'active' 
             AND visibility = 'public'
             AND directory_category_id IS NOT NULL),
          0
        ) as "productCount",
        0 as "ratingAvg",  -- Placeholder for now
        0 as "ratingCount" -- Placeholder for now
      FROM directory_settings_list dsl
      INNER JOIN tenants t ON dsl.tenant_id = t.id
      LEFT JOIN directory_listings_list dll ON dsl.tenant_id = dll.tenant_id
      WHERE ${whereClause}
      LIMIT $${paramIndex}
    `;

    params.push(parseInt(limit, 10));

    const result = await pool.query(sqlQuery, params);

    res.json({
      success: true,
      data: {
        listings: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('[Directory Map] Error fetching locations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch map locations',
    });
  }
});

export default router;
