import { Router, Request, Response } from 'express';
import { getDirectPool } from '../../../../utils/db-pool';
import { logger } from '../../../../logger';

const router = Router();

// GET /api/public/stores/:tenantId/reviews/summary - Get rating summary for a store (public)
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    const pool = getDirectPool();

    const summaryQuery = `
      SELECT 
        rating_avg,
        rating_count,
        rating_1_count,
        rating_2_count,
        rating_3_count,
        rating_4_count,
        rating_5_count,
        helpful_count_total,
        verified_purchase_count,
        last_review_at
      FROM store_rating_summary
      WHERE tenant_id = $1
    `;
    const result = await pool.query(summaryQuery, [tenantId]);

    const summary = result.rows[0] || {
      rating_avg: 0,
      rating_count: 0,
      rating_1_count: 0,
      rating_2_count: 0,
      rating_3_count: 0,
      rating_4_count: 0,
      rating_5_count: 0,
      helpful_count_total: 0,
      verified_purchase_count: 0,
      last_review_at: null
    };

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('Error fetching public review summary:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review summary'
    });
  }
});

// GET /api/public/stores/:tenantId/reviews - Get approved reviews for a store (public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { limit = '10', page = '1', sort = 'newest' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const offset = (pageNum - 1) * limitNum;

    const pool = getDirectPool();

    // Validate sort parameter
    const validSorts = ['newest', 'rating_high', 'rating_low', 'helpful'];
    const sortDirection = validSorts.includes(sort as string) ? sort as string : 'newest';

    // Build order by clause
    let orderBy = 'ORDER BY r.created_at DESC'; // default: newest
    switch (sortDirection) {
      case 'rating_high':
        orderBy = 'ORDER BY r.rating DESC, r.created_at DESC';
        break;
      case 'rating_low':
        orderBy = 'ORDER BY r.rating ASC, r.created_at DESC';
        break;
      case 'helpful':
        orderBy = 'ORDER BY r.helpful_count DESC, r.created_at DESC';
        break;
    }

    // Get approved reviews for public display
    const reviewsQuery = `
      SELECT 
        r.id,
        r.rating,
        r.review_text,
        r.helpful_count,
        r.verified_purchase,
        r.created_at,
        r.updated_at,
        r.user_id,
        r.user_name,
        r.product_id,
        r.location_lat,
        r.location_lng
      FROM store_reviews r
      WHERE r.tenant_id = $1 
        AND r.approval_status = 'approved'
        AND r.is_public = true
      ${orderBy}
      LIMIT $2 OFFSET $3
    `;
    const reviewsResult = await pool.query(reviewsQuery, [tenantId, limitNum, offset]);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM store_reviews
      WHERE tenant_id = $1 
        AND approval_status = 'approved'
        AND is_public = true
    `;
    const countResult = await pool.query(countQuery, [tenantId]);
    const totalReviews = parseInt(countResult.rows[0].total);

    // Get rating summary
    const summaryQuery = `
      SELECT 
        rating_avg,
        rating_count,
        rating_1_count,
        rating_2_count,
        rating_3_count,
        rating_4_count,
        rating_5_count,
        verified_purchase_count
      FROM store_rating_summary
      WHERE tenant_id = $1
    `;
    const summaryResult = await pool.query(summaryQuery, [tenantId]);
    const summary = summaryResult.rows[0] || {
      rating_avg: 0,
      rating_count: 0,
      rating_1_count: 0,
      rating_2_count: 0,
      rating_3_count: 0,
      rating_4_count: 0,
      rating_5_count: 0,
      verified_purchase_count: 0
    };

    // Format reviews response
    const formattedReviews = reviewsResult.rows.map(review => ({
      id: review.id,
      rating: review.rating,
      review_text: review.review_text,
      helpful_count: review.helpful_count,
      verified_purchase: review.verified_purchase,
      created_at: review.created_at,
      updated_at: review.updated_at,
      user_id: review.user_id,
      user_name: review.user_name || 'Anonymous',
      product_id: review.product_id,
      location_lat: review.location_lat,
      location_lng: review.location_lng
    }));

    res.json({
      success: true,
      data: {
        reviews: formattedReviews,
        summary,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalReviews,
          totalPages: Math.ceil(totalReviews / limitNum)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching public reviews:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews'
    });
  }
});

// GET /api/public/stores/:tenantId/reviews/approved - Get approved reviews (alias for consistency)
router.get('/approved', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { limit = '10', page = '1', sort = 'newest' } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const offset = (pageNum - 1) * limitNum;

    const pool = getDirectPool();

    // Validate sort parameter
    const validSorts = ['newest', 'rating_high', 'rating_low', 'helpful'];
    const sortDirection = validSorts.includes(sort as string) ? sort as string : 'newest';

    // Build order by clause
    let orderBy = 'ORDER BY r.created_at DESC'; // default: newest
    switch (sortDirection) {
      case 'rating_high':
        orderBy = 'ORDER BY r.rating DESC, r.created_at DESC';
        break;
      case 'rating_low':
        orderBy = 'ORDER BY r.rating ASC, r.created_at DESC';
        break;
      case 'helpful':
        orderBy = 'ORDER BY r.helpful_count DESC, r.created_at DESC';
        break;
    }

    // Get approved reviews for public display
    const reviewsQuery = `
      SELECT 
        r.id,
        r.rating,
        r.review_text,
        r.helpful_count,
        r.verified_purchase,
        r.created_at,
        r.updated_at,
        r.user_id,
        r.user_name,
        r.product_id,
        r.location_lat,
        r.location_lng
      FROM store_reviews r
      WHERE r.tenant_id = $1 
        AND r.approval_status = 'approved'
        AND r.is_public = true
      ${orderBy}
      LIMIT $2 OFFSET $3
    `;
    const reviewsResult = await pool.query(reviewsQuery, [tenantId, limitNum, offset]);

    // Format reviews response
    const formattedReviews = reviewsResult.rows.map(review => ({
      id: review.id,
      rating: review.rating,
      review_text: review.review_text,
      helpful_count: review.helpful_count,
      verified_purchase: review.verified_purchase,
      created_at: review.created_at,
      updated_at: review.updated_at,
      user_id: review.user_id,
      user_name: review.user_name || 'Anonymous',
      product_id: review.product_id,
      location_lat: review.location_lat,
      location_lng: review.location_lng
    }));

    res.json({
      success: true,
      data: formattedReviews
    });

  } catch (error) {
    logger.error('Error fetching approved public reviews:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch approved reviews'
    });
  }
});

export default router;
