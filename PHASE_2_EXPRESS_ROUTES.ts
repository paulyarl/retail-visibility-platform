// ============================================================================
// PHASE 2: DIRECTORY API EXPRESS.JS ROUTES
// ============================================================================

import { Router } from 'express';
import { pool } from '../database';

const router = Router();

// GET /api/directory/categories
// Returns all categories with aggregated product counts and quality metrics
router.get('/categories', async (req, res) => {
  try {
    const query = `
      SELECT json_agg(
        json_build_object(
          'id', category_id,
          'name', category_name,
          'slug', category_slug,
          'icon', category_icon,
          'level', category_level,
          'store_count', store_count,
          'total_products', total_products,
          'avg_quality', avg_quality,
          'top_stores', top_stores
        )
      )
      FROM (
        SELECT 
          category_id,
          category_name,
          category_slug,
          category_icon,
          category_level,
          COUNT(DISTINCT tenant_id) as store_count,
          SUM(actual_product_count) as total_products,
          ROUND(AVG(quality_score), 2) as avg_quality,
          (
            SELECT json_agg(
              json_build_object(
                'id', tenant_id,
                'name', tenant_name,
                'product_count', actual_product_count,
                'quality_score', quality_score,
                'city', tenant_city,
                'state', tenant_state,
                'is_featured', is_featured
              )
            )
            FROM (
              SELECT 
                tenant_id, tenant_name, actual_product_count, 
                quality_score, tenant_city, tenant_state, is_featured
              FROM directory_category_products dcp_inner
              WHERE dcp_inner.category_id = dcp_outer.category_id
                AND dcp_inner.is_published = true
                AND dcp_inner.actual_product_count > 0
              ORDER BY dcp_inner.quality_score DESC, dcp_inner.actual_product_count DESC
              LIMIT 3
            ) top_stores
          ) as top_stores
        FROM directory_category_products dcp_outer
        WHERE dcp_outer.is_published = true
          AND dcp_outer.actual_product_count > 0
        GROUP BY category_id, category_name, category_slug, category_icon, category_level
        ORDER BY total_products DESC, avg_quality DESC
      ) category_data
    `;
    
    const result = await pool.query(query);
    res.json({ categories: result.rows[0].json_agg || [] });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/directory/categories/:slug/stores
// Returns stores for a specific category
router.get('/categories/:slug/stores', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const categoryQuery = `
      SELECT json_agg(
        json_build_object(
          'id', category_id,
          'name', category_name,
          'slug', category_slug,
          'total_stores', store_count,
          'total_products', total_products
        )
      )
      FROM (
        SELECT 
          category_id,
          category_name,
          category_slug,
          COUNT(*) as store_count,
          SUM(actual_product_count) as total_products
        FROM directory_category_products
        WHERE category_slug = $1
          AND is_published = true
          AND actual_product_count > 0
        GROUP BY category_id, category_name, category_slug
      ) cat_data
    `;
    
    const storesQuery = `
      SELECT json_agg(
        json_build_object(
          'id', tenant_id,
          'name', tenant_name,
          'slug', tenant_slug,
          'product_count', actual_product_count,
          'quality_score', quality_score,
          'avg_price', ROUND(avg_price_dollars, 2),
          'in_stock_count', in_stock_products,
          'city', tenant_city,
          'state', tenant_state,
          'is_featured', is_featured,
          'is_primary', is_primary,
          'rating_avg', rating_avg,
          'rating_count', rating_count
        )
      )
      FROM directory_category_products
      WHERE category_slug = $1
        AND is_published = true
        AND actual_product_count > 0
    `;
    
    const [categoryResult, storesResult] = await Promise.all([
      pool.query(categoryQuery, [slug]),
      pool.query(storesQuery, [slug])
    ]);
    
    res.json({
      category: categoryResult.rows[0].json_agg || [],
      stores: storesResult.rows[0].json_agg || []
    });
  } catch (error) {
    console.error('Error fetching category stores:', error);
    res.status(500).json({ error: 'Failed to fetch category stores' });
  }
});

// GET /api/directory/featured
// Returns featured categories and stores
router.get('/featured', async (req, res) => {
  try {
    const categoriesQuery = `
      SELECT json_agg(
        json_build_object(
          'id', category_id,
          'name', category_name,
          'slug', category_slug,
          'icon', category_icon,
          'store_count', store_count,
          'total_products', total_products,
          'avg_quality', avg_quality,
          'featured_stores', featured_stores
        )
      )
      FROM (
        SELECT 
          category_id,
          category_name,
          category_slug,
          category_icon,
          COUNT(DISTINCT tenant_id) as store_count,
          SUM(actual_product_count) as total_products,
          ROUND(AVG(quality_score), 2) as avg_quality,
          COUNT(*) FILTER (WHERE is_featured = true) as featured_stores
        FROM directory_category_products
        WHERE is_published = true
          AND actual_product_count > 0
        GROUP BY category_id, category_name, category_slug, category_icon
        HAVING SUM(actual_product_count) >= 5
        ORDER BY total_products DESC, avg_quality DESC
        LIMIT 6
      ) featured_cats
    `;
    
    const storesQuery = `
      SELECT json_agg(
        json_build_object(
          'id', tenant_id,
          'name', tenant_name,
          'slug', tenant_slug,
          'city', tenant_city,
          'state', tenant_state,
          'total_products', total_products,
          'category_count', category_count,
          'avg_quality', avg_quality,
          'is_featured', is_featured,
          'rating_avg', rating_avg,
          'rating_count', rating_count
        )
      )
      FROM (
        SELECT 
          tenant_id,
          tenant_name,
          tenant_slug,
          tenant_city,
          tenant_state,
          SUM(actual_product_count) as total_products,
          COUNT(DISTINCT category_id) as category_count,
          ROUND(AVG(quality_score), 2) as avg_quality,
          BOOL_OR(is_featured) as is_featured,
          MAX(rating_avg) as rating_avg,
          MAX(rating_count) as rating_count
        FROM directory_category_products
        WHERE is_published = true
          AND actual_product_count > 0
        GROUP BY tenant_id, tenant_name, tenant_slug, tenant_city, tenant_state
        ORDER BY total_products DESC, avg_quality DESC
        LIMIT 8
      ) featured_stores_data
    `;
    
    const [categoriesResult, storesResult] = await Promise.all([
      pool.query(categoriesQuery),
      pool.query(storesQuery)
    ]);
    
    res.json({
      featured_categories: categoriesResult.rows[0].json_agg || [],
      featured_stores: storesResult.rows[0].json_agg || []
    });
  } catch (error) {
    console.error('Error fetching featured content:', error);
    res.status(500).json({ error: 'Failed to fetch featured content' });
  }
});

// GET /api/directory/search
// Search categories and stores
router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const categoriesQuery = `
      SELECT json_agg(
        json_build_object(
          'id', category_id,
          'name', category_name,
          'slug', category_slug,
          'icon', category_icon,
          'store_count', store_count,
          'total_products', total_products,
          'avg_quality', avg_quality,
          'relevance_score', relevance_score
        )
      )
      FROM (
        SELECT 
          category_id,
          category_name,
          category_slug,
          category_icon,
          COUNT(DISTINCT tenant_id) as store_count,
          SUM(actual_product_count) as total_products,
          ROUND(AVG(quality_score), 2) as avg_quality,
          CASE 
            WHEN category_name ILIKE $1 THEN 100
            WHEN category_name ILIKE $2 THEN 80
            ELSE 50
          END as relevance_score
        FROM directory_category_products
        WHERE is_published = true
          AND actual_product_count > 0
          AND (category_name ILIKE $1 OR category_name ILIKE $2)
        GROUP BY category_id, category_name, category_slug, category_icon
        ORDER BY 
          CASE 
            WHEN category_name ILIKE $1 THEN 100
            WHEN category_name ILIKE $2 THEN 80
            ELSE 50
          END DESC,
          total_products DESC
      ) search_categories
    `;
    
    const storesQuery = `
      SELECT json_agg(
        json_build_object(
          'id', tenant_id,
          'name', tenant_name,
          'slug', tenant_slug,
          'city', tenant_city,
          'state', tenant_state,
          'matching_categories', matching_categories,
          'total_products', total_products,
          'relevance_score', relevance_score
        )
      )
      FROM (
        SELECT 
          dcp.tenant_id,
          dcp.tenant_name,
          dcp.tenant_slug,
          dcp.tenant_city,
          dcp.tenant_state,
          SUM(dcp.actual_product_count) as total_products,
          CASE 
            WHEN dcp.tenant_name ILIKE $1 THEN 100
            ELSE 50
          END as relevance_score,
          (
            SELECT json_agg(
              json_build_object(
                'id', dcp_inner.category_id,
                'name', dcp_inner.category_name,
                'slug', dcp_inner.category_slug,
                'product_count', dcp_inner.actual_product_count,
                'quality_score', dcp_inner.quality_score
              )
            )
            FROM directory_category_products dcp_inner
            WHERE dcp_inner.tenant_id = dcp.tenant_id
              AND dcp_inner.is_published = true
              AND dcp_inner.actual_product_count > 0
              AND (dcp_inner.category_name ILIKE $1 OR dcp_inner.category_name ILIKE $2)
          ) as matching_categories
        FROM directory_category_products dcp
        WHERE dcp.is_published = true
          AND dcp.actual_product_count > 0
          AND EXISTS (
            SELECT 1 FROM directory_category_products dcp_inner
            WHERE dcp_inner.tenant_id = dcp.tenant_id
              AND dcp_inner.is_published = true
              AND dcp_inner.actual_product_count > 0
              AND (dcp_inner.category_name ILIKE $1 OR dcp_inner.category_name ILIKE $2)
          )
        GROUP BY dcp.tenant_id, dcp.tenant_name, dcp.tenant_slug, dcp.tenant_city, dcp.tenant_state
        ORDER BY 
          CASE 
            WHEN dcp.tenant_name ILIKE $1 THEN 100
            ELSE 50
          END DESC,
          total_products DESC
      ) search_stores
    `;
    
    const exactMatch = `%${query}%`;
    const partialMatch = `%${query.split(' ')[0]}%`;
    
    const [categoriesResult, storesResult] = await Promise.all([
      pool.query(categoriesQuery, [exactMatch, partialMatch]),
      pool.query(storesQuery, [exactMatch, partialMatch])
    ]);
    
    res.json({
      query,
      categories: categoriesResult.rows[0].json_agg || [],
      stores: storesResult.rows[0].json_agg || []
    });
  } catch (error) {
    console.error('Error searching directory:', error);
    res.status(500).json({ error: 'Failed to search directory' });
  }
});

export default router;
