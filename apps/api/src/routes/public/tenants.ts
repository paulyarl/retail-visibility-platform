import { Router, Request, Response } from 'express';
import { getDirectPool } from '../../utils/db-pool';

const router = Router();

// GET /api/public/tenants - Public tenants endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    // Query public tenants with product counts
    const query = `
      SELECT DISTINCT
        t.id,
        t.name,
        t.slug,
        t.business_name,
        t.logo_url,
        COUNT(DISTINCT sp.id) as product_count
      FROM tenants t
      LEFT JOIN storefront_products sp ON t.id = sp.tenant_id
        AND sp.is_public = true
        AND sp.is_active = true
      WHERE t.is_active = true
        AND EXISTS (
          SELECT 1 FROM storefront_products sp2 
          WHERE sp2.tenant_id = t.id 
            AND sp2.is_public = true 
            AND sp2.is_active = true
        )
      GROUP BY t.id, t.name, t.slug, t.business_name, t.logo_url
      HAVING COUNT(DISTINCT sp.id) > 0
      ORDER BY t.business_name ASC, t.name ASC
    `;
    
    const result = await getDirectPool().query(query);
    
    const tenants = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      business_name: row.business_name,
      logo_url: row.logo_url
    }));
    
    res.json({ tenants });
    
  } catch (error) {
    console.error('Public tenants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
