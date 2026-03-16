import { Router } from 'express';
import { getDirectPool } from '../utils/db-pool';

const router = Router();

// GET /api/directory/featured-stats
// Returns statistics for premium featured product types
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    
    if (!type || typeof type !== 'string') {
      return res.status(400).json({
        error: 'Featured type is required',
        validTypes: ['trending', 'recommended', 'bestseller', 'random_featured']
      });
    }

    const validTypes = ['trending', 'recommended', 'bestseller', 'random_featured'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid featured type',
        validTypes
      });
    }

    const pool = getDirectPool();
    let query;
    let queryParams: any[] = [];

    switch (type) {
      case 'trending':
        query = `
          SELECT 
            COUNT(*) as count,
            COALESCE(AVG(mv.trending_score::numeric), 0) as avg_score,
            mv.product_name as top_product
          FROM mv_global_discovery mv
          WHERE mv.featured_type = 'trending'
            AND mv.is_actively_featured = true
            AND mv.has_image = true
            AND mv.in_stock = true
          ORDER BY mv.trending_score DESC
          LIMIT 1
        `;
        break;

      case 'recommended':
        query = `
          SELECT 
            COUNT(*) as count,
            COALESCE(AVG(mv.product_average_rating::numeric), 0) as avg_rating,
            mv.product_name as top_product
          FROM mv_global_discovery mv
          WHERE mv.featured_type = 'recommended'
            AND mv.is_actively_featured = true
            AND mv.has_image = true
            AND mv.in_stock = true
          ORDER BY mv.product_average_rating DESC, mv.product_reviews_count_live DESC
          LIMIT 1
        `;
        break;

      case 'bestseller':
        query = `
          SELECT 
            COUNT(*) as count,
            COALESCE(SUM(mv.units_sold::numeric), 0) as total_sales,
            mv.product_name as top_product
          FROM mv_global_discovery mv
          WHERE mv.featured_type = 'bestseller'
            AND mv.is_actively_featured = true
            AND mv.has_image = true
            AND mv.in_stock = true
          ORDER BY mv.units_sold DESC
          LIMIT 1
        `;
        break;

      case 'random_featured':
        query = `
          WITH diversity_calc AS (
            SELECT 
              COUNT(*) as count,
              COUNT(DISTINCT mv.tenant_id) as unique_merchants,
              COUNT(DISTINCT mv.product_category_slug) as unique_categories,
              mv.product_name as top_product
            FROM mv_global_discovery mv
            WHERE mv.featured_type = 'random_featured'
              AND mv.is_actively_featured = true
              AND mv.has_image = true
              AND mv.in_stock = true
            ORDER BY RANDOM()
            LIMIT 1
          )
          SELECT 
            count,
            CASE 
              WHEN count > 0 THEN (unique_merchants::float / count::float + unique_categories::float / count::float) / 2
              ELSE 0
            END as diversity,
            top_product
          FROM diversity_calc
        `;
        break;

      default:
        return res.status(400).json({
          error: 'Invalid featured type',
          validTypes
        });
    }

    const result = await pool.query(query, queryParams);
    
    if (result.rows.length === 0) {
      return res.json({
        count: 0,
        [type === 'trending' ? 'avgScore' : 
         type === 'recommended' ? 'avgRating' : 
         type === 'bestseller' ? 'totalSales' : 'diversity']: 0,
        topProduct: 'N/A'
      });
    }

    const stats = result.rows[0];
    
    // Format response based on type
    let response: any = {
      count: parseInt(stats.count) || 0,
      topProduct: stats.top_product || 'N/A'
    };

    if (type === 'trending') {
      response.avgScore = parseFloat(stats.avg_score) || 0;
    } else if (type === 'recommended') {
      response.avgRating = parseFloat(stats.avg_rating) || 0;
    } else if (type === 'bestseller') {
      response.totalSales = parseInt(stats.total_sales) || 0;
    } else if (type === 'random_featured') {
      response.diversity = parseFloat(stats.diversity) || 0;
    }

    return res.json(response);

  } catch (error) {
    console.error('[GET /api/directory/featured-stats] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch featured stats',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

export default router;
