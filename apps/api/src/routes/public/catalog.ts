import { Router, Request, Response } from 'express';
import { getDirectPool } from '../../utils/db-pool';
import { logger } from '../../logger';

const router = Router();

// GET /api/public/catalog - Public catalog endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '24', 
      category, 
      tenant, 
      search, 
      sort = 'featured' 
    } = req.query;
    
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // Build WHERE clause for public catalog
    const conditions: string[] = [
      'sp.is_public = true',
      'sp.is_active = true',
      'sp.category_id IS NOT NULL'
    ];
    const params: any[] = [];
    let paramIndex = 1;
    
    // Category filter
    if (category && typeof category === 'string') {
      conditions.push(`sp.category_slug = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    
    // Tenant filter
    if (tenant && typeof tenant === 'string') {
      conditions.push(`sp.tenant_id = $${paramIndex}`);
      params.push(tenant);
      paramIndex++;
    }
    
    // Search filter (name or SKU)
    if (search && typeof search === 'string') {
      conditions.push(`(sp.name ILIKE $${paramIndex} OR sp.sku ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Build ORDER BY clause based on sort parameter
    let orderByClause = 'sp.is_featured DESC, sp.created_at DESC'; // Default: featured first, then newest
    switch (sort) {
      case 'newest':
        orderByClause = 'sp.created_at DESC';
        break;
      case 'price-low':
        orderByClause = 'sp.price_cents ASC';
        break;
      case 'price-high':
        orderByClause = 'sp.price_cents DESC';
        break;
      case 'rating':
        orderByClause = 'sp.rating_avg DESC NULLS LAST, sp.rating_count DESC';
        break;
      case 'featured':
      default:
        orderByClause = 'sp.is_featured DESC, sp.created_at DESC';
        break;
    }
    
    // Query public products from storefront_products MV
    const query = `
      SELECT DISTINCT 
        sp.id,
        sp.tenant_id,
        sp.sku,
        sp.name,
        sp.title,
        sp.description,
        sp.price_cents,
        sp.sale_price_cents,
        sp.stock,
        sp.image_url,
        sp.category_id,
        sp.category_name,
        sp.category_slug,
        sp.condition,
        sp.availability,
        sp.rating_avg,
        sp.rating_count,
        sp.is_featured,
        sp.has_variants,
        sp.metadata,
        sp.created_at,
        sp.updated_at,
        t.name as tenant_name,
        t.slug as tenant_slug,
        t.name as business_name
      FROM storefront_products sp
      JOIN tenants t ON sp.tenant_id = t.id
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countQuery = `
      SELECT COUNT(DISTINCT sp.id) as count
      FROM storefront_products sp
      JOIN tenants t ON sp.tenant_id = t.id
      WHERE ${whereClause}
    `;
    
    // Execute queries in parallel
    const [itemsResult, countResult] = await Promise.all([
      getDirectPool().query(query, [...params, limitNum, skip]),
      getDirectPool().query(countQuery, params),
    ]);
    
    const totalCount = parseInt(countResult.rows[0]?.count || '0');
    
    // Fetch featured types for the returned products
    const productIds = itemsResult.rows.map((item: any) => item.id);
    let featuredTypesMap: Record<string, string[]> = {};
    
    if (productIds.length > 0) {
      const featuredTypesQuery = `
        SELECT 
          fp.inventory_item_id as product_id,
          fp.featured_type
        FROM featured_products fp
        WHERE fp.inventory_item_id = ANY($1)
          AND fp.is_active = true
      `;
      
      const featuredTypesResult = await getDirectPool().query(featuredTypesQuery, [productIds]);
      
      // Build featured types map
      featuredTypesMap = featuredTypesResult.rows.reduce((acc: Record<string, string[]>, row: any) => {
        if (!acc[row.product_id]) {
          acc[row.product_id] = [];
        }
        acc[row.product_id].push(row.featured_type);
        return acc;
      }, {});
    }
    
    // Transform the data
    const items = itemsResult.rows.map((row: any) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      brand: row.metadata?.brand,
      description: row.description,
      priceCents: row.price_cents,
      salePriceCents: row.sale_price_cents,
      stock: row.stock,
      imageUrl: row.image_url,
      tenantId: row.tenant_id,
      tenantName: row.business_name || row.tenant_name,
      tenantSlug: row.tenant_slug,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      condition: row.condition,
      availability: row.availability,
      ratingAvg: row.rating_avg ? parseFloat(row.rating_avg) : undefined,
      ratingCount: row.rating_count,
      isFeatured: row.is_featured,
      featuredTypes: featuredTypesMap[row.id] || [],
      hasVariants: row.has_variants,
      metadata: row.metadata,
      price: row.price_cents / 100,
      salePrice: row.sale_price_cents ? row.sale_price_cents / 100 : undefined,
      currency: 'USD'
    }));
    
    const totalPages = Math.ceil(totalCount / limitNum);
    
    res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalCount,
        totalPages,
        hasMore: pageNum < totalPages
      }
    });
    
  } catch (error) {
    logger.error('Public catalog error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
