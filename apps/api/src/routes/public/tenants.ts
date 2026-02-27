import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { Prisma } from '@prisma/client';
import { getDirectPool } from '../../utils/db-pool';
const tenantReviewsRoutes = require('./[tenantId]/reviews').default;

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

// GET /api/public/tenant/:tenantId/slug - Get tenant slug by ID
router.get('/tenant/:tenantId/slug', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const query = `
      SELECT slug 
      FROM tenants 
      WHERE id = $1 AND is_active = true
      LIMIT 1
    `;
    
    const result = await getDirectPool().query(query, [tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json({ slug: result.rows[0].slug });
    
  } catch (error) {
    console.error('Tenant slug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/slug/:slug/tenant - Get tenant ID by slug
router.get('/slug/:slug/tenant', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' });
    }

    const query = `
      SELECT id 
      FROM tenants 
      WHERE slug = $1 AND is_active = true
      LIMIT 1
    `;
    
    const result = await getDirectPool().query(query, [slug]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json({ tenantId: result.rows[0].id });
    
  } catch (error) {
    console.error('Slug tenant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mount individual tenant routes
router.use('/:tenantId/reviews', tenantReviewsRoutes);

export default router;
