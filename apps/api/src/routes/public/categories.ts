import { Router, Request, Response } from 'express';
import { getDirectPool } from '../../utils/db-pool';

const router = Router();

// GET /api/public/categories - Public categories endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    // Query public categories with product counts
    const query = `
      SELECT 
        c.id,
        c.name,
        c.slug,
        COUNT(DISTINCT sp.id) as product_count
      FROM categories c
      LEFT JOIN storefront_products sp ON c.id = sp.category_id
        AND sp.is_public = true
        AND sp.is_active = true
      WHERE c.is_active = true
      GROUP BY c.id, c.name, c.slug
      HAVING COUNT(DISTINCT sp.id) > 0
      ORDER BY c.name ASC
    `;
    
    const result = await getDirectPool().query(query);
    
    const categories = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      productCount: Number(row.product_count)
    }));
    
    res.json({ categories });
    
  } catch (error) {
    console.error('Public categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
