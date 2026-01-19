import { Router } from 'express';
import { getDirectPool } from '../utils/db-pool';

const router = Router();

// GET /api/directory/random-featured
// Returns 12 random featured products from all stores
router.get('/', async (req, res) => {
  try {
    const pool = getDirectPool();
    
    // Query for random featured products from all published stores
    const query = `
      SELECT 
        sp.id,
        sp.name,
        sp.price_cents,
        sp.currency,
        sp.image_url,
        sp.brand,
        sp.description,
        sp.stock,
        sp.availability,
        sp.tenant_id,
        sp.category_name,
        sp.category_slug,
        sp.has_active_payment_gateway,
        sp.default_gateway_type,
        dsl.slug as store_slug,
        dsl.business_name as store_name,
        dsl.logo_url as store_logo,
        dsl.city as store_city,
        dsl.state as store_state,
        sp.updated_at
      FROM storefront_products sp
      JOIN directory_listings_list dsl ON dsl.tenant_id = sp.tenant_id
      WHERE sp.is_actively_featured = true 
        AND dsl.is_published = true
        AND sp.has_image = true
        AND sp.stock > 0
      ORDER BY RANDOM() 
      LIMIT 12
    `;
    
    const result = await pool.query(query);
    
    // Transform to camelCase for frontend compatibility
    const products = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      currency: row.currency,
      imageUrl: row.image_url,
      brand: row.brand,
      description: row.description,
      stock: row.stock,
      availability: row.availability,
      tenantId: row.tenant_id,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      hasActivePaymentGateway: row.has_active_payment_gateway,
      paymentGatewayType: row.default_gateway_type,
      storeSlug: row.store_slug,
      storeName: row.store_name,
      storeLogo: row.store_logo,
      storeCity: row.store_city,
      storeState: row.store_state,
      updatedAt: row.updated_at
    }));
    
    res.json({
      products,
      total: products.length,
      refreshed_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Directory Random Featured] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random featured products',
      products: [],
      total: 0,
      refreshed_at: new Date().toISOString()
    });
  }
});

export default router;
