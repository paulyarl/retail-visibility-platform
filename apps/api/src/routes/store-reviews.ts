import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { getDirectPool } from '../utils/db-pool';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  reviewText: z.string().optional(),
  verifiedPurchase: z.boolean().default(false),
  locationLat: z.number().nullable().optional(),
  locationLng: z.number().nullable().optional(),
  userName: z.string().optional(), // For anonymous reviews
  userEmail: z.string().optional(), // For anonymous reviews
  sessionId: z.string().optional(), // For anonymous reviews
});

const updateReviewSchema = z.object({
  rating: z.number().min(1).max(5).optional(),
  reviewText: z.string().optional(),
  verifiedPurchase: z.boolean().optional(),
  locationLat: z.number().nullable().optional(),
  locationLng: z.number().nullable().optional(),
});

const helpfulVoteSchema = z.object({
  isHelpful: z.boolean(),
});

// Helper function to update rating summary
async function updateRatingSummary(pool: any, tenantId: string) {
  try {
    // Calculate new rating summary from reviews
    const summaryQuery = `
      INSERT INTO store_rating_summary (
        tenant_id, 
        rating_avg, 
        rating_count, 
        rating_1_count, 
        rating_2_count, 
        rating_3_count, 
        rating_4_count, 
        rating_5_count, 
        helpful_count_total, 
        verified_purchase_count, 
        last_review_at,
        updated_at
      )
      SELECT 
        $1 as tenant_id,
        COALESCE(AVG(rating), 0) as rating_avg,
        COUNT(*) as rating_count,
        COUNT(*) FILTER (WHERE rating = 1) as rating_1_count,
        COUNT(*) FILTER (WHERE rating = 2) as rating_2_count,
        COUNT(*) FILTER (WHERE rating = 3) as rating_3_count,
        COUNT(*) FILTER (WHERE rating = 4) as rating_4_count,
        COUNT(*) FILTER (WHERE rating = 5) as rating_5_count,
        COALESCE(SUM(helpful_count), 0) as helpful_count_total,
        COUNT(*) FILTER (WHERE verified_purchase = true) as verified_purchase_count,
        MAX(created_at) as last_review_at,
        NOW() as updated_at
      FROM store_reviews
      WHERE tenant_id = $1
      ON CONFLICT (tenant_id) 
      DO UPDATE SET
        rating_avg = EXCLUDED.rating_avg,
        rating_count = EXCLUDED.rating_count,
        rating_1_count = EXCLUDED.rating_1_count,
        rating_2_count = EXCLUDED.rating_2_count,
        rating_3_count = EXCLUDED.rating_3_count,
        rating_4_count = EXCLUDED.rating_4_count,
        rating_5_count = EXCLUDED.rating_5_count,
        helpful_count_total = EXCLUDED.helpful_count_total,
        verified_purchase_count = EXCLUDED.verified_purchase_count,
        last_review_at = EXCLUDED.last_review_at,
        updated_at = EXCLUDED.updated_at
    `;
    
    await pool.query(summaryQuery, [tenantId]);
    
    // Skip directory listing update due to trigger issues
    // TODO: Fix directory listing sync separately
    
  } catch (error) {
    console.error('Error updating rating summary:', error);
    throw error;
  }
}

// Helper function to update directory listing ratings
async function updateDirectoryListingRatings(pool: any, tenantId: string) {
  try {
    const updateQuery = `
      UPDATE directory_listings_list 
      SET 
        rating_avg = srs.rating_avg,
        rating_count = srs.rating_count,
        updated_at = NOW()
      FROM store_rating_summary srs
      WHERE directory_listings_list.tenant_id::text = srs.tenant_id::text
      AND directory_listings_list.tenant_id::text = $1::text
    `;
    
    await pool.query(updateQuery, [tenantId]);
  } catch (error) {
    console.error('Error updating directory listing ratings:', error);
    // Don't throw here - directory update is secondary
  }
}

// GET /api/stores/:tenantId/reviews - Get all reviews for a store
router.get('/:tenantId/reviews', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { page = '1', limit = '10', sort = 'newest' } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const pool = getDirectPool();

    // Determine order by clause
    let orderByClause = 'ORDER BY ';
    switch (sort) {
      case 'rating_high':
        orderByClause += 'sr.rating DESC, sr.created_at DESC';
        break;
      case 'rating_low':
        orderByClause += 'sr.rating ASC, sr.created_at DESC';
        break;
      case 'helpful':
        orderByClause += 'sr.helpful_count DESC, sr.created_at DESC';
        break;
      case 'newest':
      default:
        orderByClause += 'sr.created_at DESC';
        break;
    }

    // Get reviews with user info (only approved reviews for public)
    const reviewsQuery = `
      SELECT 
        sr.id,
        sr.rating,
        sr.review_text,
        sr.helpful_count,
        sr.verified_purchase,
        sr.created_at,
        sr.updated_at,
        sr.user_id,
        sr.session_id,
        u.first_name,
        u.last_name,
        u.email
      FROM store_reviews sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.tenant_id = $1 AND sr.approval_status = 'approved'
      ${orderByClause}
      LIMIT $2 OFFSET $3
    `;

    const reviewsResult = await pool.query(reviewsQuery, [
      tenantId,
      limitNum,
      offset
    ]);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM store_reviews
      WHERE tenant_id = $1
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

    res.json({
      success: true,
      data: {
        reviews: reviewsResult.rows,
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
    console.error('Error fetching store reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reviews'
    });
  }
});

// POST /api/stores/:tenantId/reviews/anonymous - Create a new anonymous review
router.post('/:tenantId/reviews/anonymous', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    // Validate request body
    const validatedData = createReviewSchema.parse(req.body);
    const { rating, reviewText, verifiedPurchase, locationLat, locationLng, userName, userEmail, sessionId } = validatedData;

    // Require userName and userEmail for anonymous reviews
    if (!userName || !userEmail) {
      return res.status(400).json({
        success: false,
        error: 'userName and userEmail are required for anonymous reviews'
      });
    }

    const pool = getDirectPool();

    // Generate or use provided session ID
    const finalSessionId = sessionId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if this session has already reviewed this store
    const existingReviewQuery = `
      SELECT id FROM store_reviews
      WHERE tenant_id = $1 AND session_id = $2
    `;
    const existingReviewResult = await pool.query(existingReviewQuery, [tenantId, finalSessionId]);

    if (existingReviewResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted a review for this store.'
      });
    }

    // Create the anonymous review (pending approval)
    const insertQuery = `
      INSERT INTO store_reviews (
        tenant_id, session_id, rating, review_text, verified_purchase,
        location_lat, location_lng, approval_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW(), NOW())
      RETURNING id, rating, review_text, helpful_count, verified_purchase, created_at, approval_status
    `;

    const result = await pool.query(insertQuery, [
      tenantId,
      finalSessionId,
      rating,
      reviewText || null,
      verifiedPurchase,
      locationLat || null,
      locationLng || null
    ]);

    const review = result.rows[0];

    // For anonymous reviews, we don't update the rating summary until approved
    // The summary will be updated when the review is approved

    res.status(201).json({
      success: true,
      data: {
        ...review,
        sessionId: finalSessionId,
        message: 'Your review has been submitted and is pending approval. It will be visible once approved by the store owner.'
      }
    });

  } catch (error) {
    console.error('Error creating anonymous review:', error);
    if (error instanceof z.ZodError) {
      const errors = error.issues || [];
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create review'
    });
  }
});

// POST /api/stores/:tenantId/reviews - Create a new authenticated review
router.post('/:tenantId/reviews', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user?.userId;
    
    // Validate request body
    const validatedData = createReviewSchema.parse(req.body);
    const { rating, reviewText, verifiedPurchase, locationLat, locationLng } = validatedData;

    const pool = getDirectPool();

    // Check if user already reviewed this store
    const existingReviewQuery = `
      SELECT id FROM store_reviews
      WHERE tenant_id = $1 AND user_id = $2
    `;
    const existingReviewResult = await pool.query(existingReviewQuery, [tenantId, userId]);

    if (existingReviewResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted a review for this store. Use PUT to update your review.'
      });
    }

    // Create the authenticated review (automatically approved)
    const insertQuery = `
      INSERT INTO store_reviews (
        tenant_id, user_id, rating, review_text, verified_purchase,
        location_lat, location_lng, approval_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', NOW(), NOW())
      RETURNING id, rating, review_text, helpful_count, verified_purchase, created_at, approval_status
    `;

    const result = await pool.query(insertQuery, [
      tenantId,
      userId,
      rating,
      reviewText || null,
      verifiedPurchase,
      locationLat || null,
      locationLng || null
    ]);

    const review = result.rows[0];

    // Update rating summary for authenticated reviews (approved immediately)
    await updateRatingSummary(pool, tenantId);

    res.status(201).json({
      success: true,
      data: review
    });

  } catch (error) {
    console.error('Error creating authenticated review:', error);
    if (error instanceof z.ZodError) {
      const errors = error.issues || [];
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create review'
    });
  }
});

// PUT /api/stores/:tenantId/reviews - Update user's review
router.put('/:tenantId/reviews', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user?.userId;
    
    // Validate request body
    const validatedData = updateReviewSchema.parse(req.body);
    const { rating, reviewText, verifiedPurchase, locationLat, locationLng } = validatedData;

    const pool = getDirectPool();

    // Check if review exists
    const existingReviewQuery = `
      SELECT id FROM store_reviews
      WHERE tenant_id = $1 AND user_id = $2
    `;
    const existingReviewResult = await pool.query(existingReviewQuery, [tenantId, userId]);

    if (existingReviewResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found. Create a review first.'
      });
    }

    const reviewId = existingReviewResult.rows[0].id;

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 3;

    if (rating !== undefined) {
      updateFields.push(`rating = $${paramIndex++}`);
      updateValues.push(rating);
    }
    if (reviewText !== undefined) {
      updateFields.push(`review_text = $${paramIndex++}`);
      updateValues.push(reviewText);
    }
    if (verifiedPurchase !== undefined) {
      updateFields.push(`verified_purchase = $${paramIndex++}`);
      updateValues.push(verifiedPurchase);
    }
    if (locationLat !== undefined) {
      updateFields.push(`location_lat = $${paramIndex++}`);
      updateValues.push(locationLat);
    }
    if (locationLng !== undefined) {
      updateFields.push(`location_lng = $${paramIndex++}`);
      updateValues.push(locationLng);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(reviewId);

    const updateQuery = `
      UPDATE store_reviews
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, rating, review_text, helpful_count, verified_purchase, created_at, updated_at
    `;

    const result = await pool.query(updateQuery, updateValues);

    const review = result.rows[0];

    // Update rating summary
    await updateRatingSummary(pool, tenantId);

    res.json({
      success: true,
      data: review
    });

  } catch (error) {
    console.error('Error updating review:', error);
    if (error instanceof z.ZodError) {
      const errors = error.issues || [];
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update review'
    });
  }
});

// DELETE /api/stores/:tenantId/reviews - Delete user's review
router.delete('/:tenantId/reviews', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user?.userId;

    const pool = getDirectPool();

    // Delete the review
    const deleteQuery = `
      DELETE FROM store_reviews
      WHERE tenant_id = $1 AND user_id = $2
      RETURNING id
    `;

    const result = await pool.query(deleteQuery, [tenantId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete review'
    });
  }
});

// POST /api/reviews/:reviewId/helpful - Vote on review helpfulness
router.post('/reviews/:reviewId/helpful', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?.userId;
    
    // Validate request body
    const validatedData = helpfulVoteSchema.parse(req.body);
    const { isHelpful } = validatedData;

    const pool = getDirectPool();

    // Check if user already voted
    const existingVoteQuery = `
      SELECT is_helpful FROM review_helpful_votes
      WHERE review_id = $1 AND user_id = $2
    `;
    const existingVoteResult = await pool.query(existingVoteQuery, [reviewId, userId]);

    let helpfulCountChange = 0;

    if (existingVoteResult.rows.length > 0) {
      // Update existing vote
      const previousVote = existingVoteResult.rows[0].is_helpful;
      
      if (previousVote !== isHelpful) {
        // Vote changed, update helpful count
        helpfulCountChange = isHelpful ? 1 : -1;
        
        const updateVoteQuery = `
          UPDATE review_helpful_votes
          SET is_helpful = $1
          WHERE review_id = $2 AND user_id = $3
        `;
        await pool.query(updateVoteQuery, [isHelpful, reviewId, userId]);
      } else {
        // Same vote, remove it
        helpfulCountChange = isHelpful ? -1 : 0;
        
        const deleteVoteQuery = `
          DELETE FROM review_helpful_votes
          WHERE review_id = $1 AND user_id = $2
        `;
        await pool.query(deleteVoteQuery, [reviewId, userId]);
      }
    } else {
      // New vote
      if (isHelpful) {
        helpfulCountChange = 1;
      }
      
      const insertVoteQuery = `
        INSERT INTO review_helpful_votes (id, review_id, user_id, is_helpful, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, NOW())
        ON CONFLICT (review_id, user_id) DO UPDATE SET
          is_helpful = EXCLUDED.is_helpful
      `;
      await pool.query(insertVoteQuery, [reviewId, userId, isHelpful]);
    }

    // Update helpful count on review
    if (helpfulCountChange !== 0) {
      const updateReviewQuery = `
        UPDATE store_reviews
        SET helpful_count = helpful_count + $1
        WHERE id = $2
      `;
      await pool.query(updateReviewQuery, [helpfulCountChange, reviewId]);
    }

    res.json({
      success: true,
      message: 'Vote recorded successfully'
    });

  } catch (error) {
    console.error('Error voting on review:', error);
    if (error instanceof z.ZodError) {
      const errors = error.issues || [];
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to record vote'
    });
  }
});

// GET /api/stores/:tenantId/reviews/summary - Get rating summary for a store
router.get('/:tenantId/reviews/summary', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

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
    console.error('Error fetching review summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review summary'
    });
  }
});

// GET /api/stores/:tenantId/reviews/user - Get current user's review for a store
router.get('/:tenantId/reviews/user', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user!.userId || req.user!.user_id;

    const pool = getDirectPool();

    const reviewQuery = `
      SELECT 
        id,
        rating,
        review_text,
        verified_purchase,
        location_lat,
        location_lng,
        created_at,
        updated_at
      FROM store_reviews
      WHERE tenant_id = $1 AND user_id = $2
    `;
    const result = await pool.query(reviewQuery, [tenantId, userId]);

    const review = result.rows[0] || null;

    res.json({
      success: true,
      data: review
    });

  } catch (error) {
    console.error('Error fetching user review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user review'
    });
  }
});

// GET /api/stores/:tenantId/reviews/pending - Get pending reviews for approval (store owners/admins only)
router.get('/:tenantId/reviews/pending', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = req.user?.userId || req.user?.user_id;
    const userRole = req.user?.role;

    const pool = getDirectPool();

    // Check if user has permission to view pending reviews
    // Allow platform admins, or users who are owners/admins of this tenant
    if (userRole !== 'PLATFORM_ADMIN' && userRole !== 'PLATFORM_SUPPORT') {
      // Check if user is owner/admin of this tenant
      const tenantCheckQuery = `
        SELECT role FROM user_tenants
        WHERE user_id = $1 AND tenant_id = $2 AND role IN ('OWNER', 'ADMIN')
      `;
      const tenantCheckResult = await pool.query(tenantCheckQuery, [userId, tenantId]);
      
      if (tenantCheckResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to view pending reviews for this store'
        });
      }
    }

    // Get pending reviews
    const pendingReviewsQuery = `
      SELECT 
        sr.id,
        sr.rating,
        sr.review_text,
        sr.helpful_count,
        sr.verified_purchase,
        sr.created_at,
        sr.updated_at,
        sr.session_id,
        sr.user_id,
        u.first_name,
        u.last_name,
        u.email
      FROM store_reviews sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.tenant_id = $1 AND sr.approval_status = 'pending'
      ORDER BY sr.created_at ASC
    `;

    const result = await pool.query(pendingReviewsQuery, [tenantId]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending reviews'
    });
  }
});

// POST /api/stores/:tenantId/reviews/:reviewId/approve - Approve a pending review
router.post('/:tenantId/reviews/:reviewId/approve', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, reviewId } = req.params;
    const userId = req.user?.userId || req.user?.user_id;
    const userRole = req.user?.role;

    const pool = getDirectPool();

    // Check permissions
    if (userRole !== 'PLATFORM_ADMIN' && userRole !== 'PLATFORM_SUPPORT') {
      const tenantCheckQuery = `
        SELECT role FROM user_tenants
        WHERE user_id = $1 AND tenant_id = $2 AND role IN ('OWNER', 'ADMIN')
      `;
      const tenantCheckResult = await pool.query(tenantCheckQuery, [userId, tenantId]);
      
      if (tenantCheckResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to approve reviews for this store'
        });
      }
    }

    // Approve the review
    const approveQuery = `
      UPDATE store_reviews
      SET approval_status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3 AND approval_status = 'pending'
      RETURNING id, rating, review_text, helpful_count, verified_purchase, created_at, approval_status
    `;

    const result = await pool.query(approveQuery, [userId, reviewId, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found or already processed'
      });
    }

    // Update rating summary after approval
    await updateRatingSummary(pool, tenantId);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Review approved successfully'
    });

  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve review'
    });
  }
});

// POST /api/stores/:tenantId/reviews/:reviewId/reject - Reject a pending review
router.post('/:tenantId/reviews/:reviewId/reject', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, reviewId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.userId || req.user?.user_id;
    const userRole = req.user?.role;

    const pool = getDirectPool();

    // Check permissions
    if (userRole !== 'PLATFORM_ADMIN' && userRole !== 'PLATFORM_SUPPORT') {
      const tenantCheckQuery = `
        SELECT role FROM user_tenants
        WHERE user_id = $1 AND tenant_id = $2 AND role IN ('OWNER', 'ADMIN')
      `;
      const tenantCheckResult = await pool.query(tenantCheckQuery, [userId, tenantId]);
      
      if (tenantCheckResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to reject reviews for this store'
        });
      }
    }

    // Reject the review
    const rejectQuery = `
      UPDATE store_reviews
      SET approval_status = 'rejected', approved_by = $1, approved_at = NOW(), rejection_reason = $2, updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4 AND approval_status = 'pending'
      RETURNING id, rating, review_text, helpful_count, verified_purchase, created_at, approval_status
    `;

    const result = await pool.query(rejectQuery, [userId, reason || null, reviewId, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Review not found or already processed'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Review rejected successfully'
    });

  } catch (error) {
    console.error('Error rejecting review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject review'
    });
  }
});

// POST /api/stores/:tenantId/products/:productId/reviews/anonymous - Create a new anonymous product review
router.post('/:tenantId/products/:productId/reviews/anonymous', async (req: Request, res: Response) => {
  try {
    const { tenantId, productId } = req.params;

    // Validate request body
    const validatedData = createReviewSchema.parse(req.body);
    const { rating, reviewText, verifiedPurchase, locationLat, locationLng, userName, userEmail, sessionId } = validatedData;

    // Require userName and userEmail for anonymous reviews
    if (!userName || !userEmail) {
      return res.status(400).json({
        success: false,
        error: 'userName and userEmail are required for anonymous reviews'
      });
    }

    const pool = getDirectPool();

    // Generate or use provided session ID
    const finalSessionId = sessionId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if this session has already reviewed this product
    const existingReviewQuery = `
      SELECT id FROM store_reviews
      WHERE tenant_id = $1 AND product_id = $2 AND session_id = $3
    `;
    const existingReviewResult = await pool.query(existingReviewQuery, [tenantId, productId, finalSessionId]);

    if (existingReviewResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted a review for this product.'
      });
    }

    // Create the anonymous product review (pending approval)
    const insertQuery = `
      INSERT INTO store_reviews (
        tenant_id, product_id, session_id, rating, review_text, verified_purchase,
        location_lat, location_lng, approval_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())
      RETURNING id, rating, review_text, helpful_count, verified_purchase, created_at, approval_status
    `;

    const result = await pool.query(insertQuery, [
      tenantId,
      productId,
      finalSessionId,
      rating,
      reviewText || null,
      verifiedPurchase,
      locationLat || null,
      locationLng || null
    ]);

    const review = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        ...review,
        sessionId: finalSessionId,
        message: 'Your product review has been submitted and is pending approval. It will be visible once approved by the store owner.'
      }
    });

  } catch (error) {
    console.error('Error creating anonymous product review:', error);
    if (error instanceof z.ZodError) {
      const errors = error.issues || [];
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create product review'
    });
  }
});

// POST /api/stores/:tenantId/products/:productId/reviews - Create a new authenticated product review
router.post('/:tenantId/products/:productId/reviews', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, productId } = req.params;
    const userId = req.user?.userId;

    console.log('Creating product review:', { tenantId, productId, userId, body: req.body });

    // Validate request body
    const validatedData = createReviewSchema.parse(req.body);
    const { rating, reviewText, verifiedPurchase, locationLat, locationLng } = validatedData;

    console.log('Validated review data:', { rating, reviewText, verifiedPurchase, locationLat, locationLng });

    const pool = getDirectPool();

    // Check if user already reviewed this product
    const existingReviewQuery = `
      SELECT id FROM store_reviews
      WHERE tenant_id = $1 AND product_id = $2 AND user_id = $3
    `;
    const existingReviewResult = await pool.query(existingReviewQuery, [tenantId, productId, userId]);

    console.log('Existing review check:', existingReviewResult.rows.length);

    if (existingReviewResult.rows.length > 0) {
      console.log('User already reviewed this product');
      return res.status(400).json({
        success: false,
        error: 'You have already submitted a review for this product. Use PUT to update your review.'
      });
    }

    // Create the authenticated product review (automatically approved)
    const insertQuery = `
      INSERT INTO store_reviews (
        tenant_id, product_id, user_id, rating, review_text, verified_purchase,
        location_lat, location_lng, approval_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved', NOW(), NOW())
      RETURNING id, rating, review_text, helpful_count, verified_purchase, created_at, approval_status
    `;

    console.log('Executing insert query with params:', [
      tenantId, productId, userId, rating, reviewText, verifiedPurchase, locationLat, locationLng
    ]);

    const result = await pool.query(insertQuery, [
      tenantId,
      productId,
      userId,
      rating,
      reviewText || null,
      verifiedPurchase,
      locationLat || null,
      locationLng || null
    ]);

    const review = result.rows[0];
    console.log('Review created successfully:', review);

    // Update rating summary for authenticated reviews (approved immediately)
    await updateRatingSummary(pool, tenantId);

    res.status(201).json({
      success: true,
      data: review
    });

  } catch (error) {
    console.error('Error creating authenticated product review:', error);
    if (error instanceof z.ZodError) {
      console.error('Zod validation errors:', error.issues);
      const errors = error.issues || [];
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors
      });
    }
    console.error('Database or other error:', (error as Error).message);
    res.status(500).json({
      success: false,
      error: 'Failed to create product review'
    });
  }
});

// GET /api/stores/:tenantId/products/:productId/reviews - Get reviews for a specific product
router.get('/:tenantId/products/:productId/reviews', async (req: Request, res: Response) => {
  try {
    const { tenantId, productId } = req.params;
    const { page = '1', limit = '10', sort = 'newest' } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const pool = getDirectPool();

    // Determine order by clause
    let orderByClause = 'ORDER BY ';
    switch (sort) {
      case 'rating_high':
        orderByClause += 'sr.rating DESC, sr.created_at DESC';
        break;
      case 'rating_low':
        orderByClause += 'sr.rating ASC, sr.created_at DESC';
        break;
      case 'helpful':
        orderByClause += 'sr.helpful_count DESC, sr.created_at DESC';
        break;
      case 'newest':
      default:
        orderByClause += 'sr.created_at DESC';
        break;
    }

    // Get reviews with user info (only approved reviews for public)
    const reviewsQuery = `
      SELECT
        sr.id,
        sr.rating,
        sr.review_text,
        sr.helpful_count,
        sr.verified_purchase,
        sr.created_at,
        sr.updated_at,
        sr.user_id,
        sr.session_id,
        u.first_name,
        u.last_name,
        u.email
      FROM store_reviews sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.tenant_id = $1 AND sr.product_id = $2 AND sr.approval_status = 'approved'
      ${orderByClause}
      LIMIT $3 OFFSET $4
    `;

    const reviewsResult = await pool.query(reviewsQuery, [
      tenantId,
      productId,
      limitNum,
      offset
    ]);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM store_reviews
      WHERE tenant_id = $1 AND product_id = $2 AND approval_status = 'approved'
    `;
    const countResult = await pool.query(countQuery, [tenantId, productId]);
    const totalReviews = parseInt(countResult.rows[0].total);

    // Get rating summary for this product
    const summaryQuery = `
      SELECT
        COALESCE(AVG(rating), 0) as rating_avg,
        COUNT(*) as rating_count,
        COUNT(*) FILTER (WHERE rating = 1) as rating_1_count,
        COUNT(*) FILTER (WHERE rating = 2) as rating_2_count,
        COUNT(*) FILTER (WHERE rating = 3) as rating_3_count,
        COUNT(*) FILTER (WHERE rating = 4) as rating_4_count,
        COUNT(*) FILTER (WHERE rating = 5) as rating_5_count,
        COUNT(*) FILTER (WHERE verified_purchase = true) as verified_purchase_count
      FROM store_reviews
      WHERE tenant_id = $1 AND product_id = $2 AND approval_status = 'approved'
    `;
    const summaryResult = await pool.query(summaryQuery, [tenantId, productId]);
    const summary = summaryResult.rows[0];

    res.json({
      success: true,
      data: {
        reviews: reviewsResult.rows,
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
    console.error('Error fetching product reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product reviews'
    });
  }
});

// PUT /api/stores/:tenantId/products/:productId/reviews - Update user's product review
router.put('/:tenantId/products/:productId/reviews', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, productId } = req.params;
    const userId = req.user?.userId;

    console.log('Updating product review:', { tenantId, productId, userId, body: req.body });

    // Validate request body
    const validatedData = updateReviewSchema.parse(req.body);
    const { rating, reviewText, verifiedPurchase, locationLat, locationLng } = validatedData;

    console.log('Validated update data:', { rating, reviewText, verifiedPurchase, locationLat, locationLng });

    const pool = getDirectPool();

    // Check if review exists
    const existingReviewQuery = `
      SELECT id FROM store_reviews
      WHERE tenant_id = $1 AND product_id = $2 AND user_id = $3
    `;
    const existingReviewResult = await pool.query(existingReviewQuery, [tenantId, productId, userId]);

    console.log('Existing review check:', existingReviewResult.rows.length);

    if (existingReviewResult.rows.length === 0) {
      console.log('No existing review found');
      return res.status(404).json({
        success: false,
        error: 'Product review not found. Create a review first.'
      });
    }

    const reviewId = existingReviewResult.rows[0].id;
    console.log('Found review ID:', reviewId);

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1; // Start from 1, not 3

    if (rating !== undefined) {
      updateFields.push(`rating = $${paramIndex++}`);
      updateValues.push(rating);
    }
    if (reviewText !== undefined) {
      updateFields.push(`review_text = $${paramIndex++}`);
      updateValues.push(reviewText);
    }
    if (verifiedPurchase !== undefined) {
      updateFields.push(`verified_purchase = $${paramIndex++}`);
      updateValues.push(verifiedPurchase);
    }
    if (locationLat !== undefined) {
      updateFields.push(`location_lat = $${paramIndex++}`);
      updateValues.push(locationLat);
    }
    if (locationLng !== undefined) {
      updateFields.push(`location_lng = $${paramIndex++}`);
      updateValues.push(locationLng);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(reviewId);

    const updateQuery = `
      UPDATE store_reviews
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, rating, review_text, helpful_count, verified_purchase, created_at, updated_at
    `;

    const result = await pool.query(updateQuery, updateValues);

    const review = result.rows[0];

    // Update rating summary
    await updateRatingSummary(pool, tenantId);

    res.json({
      success: true,
      data: review
    });

  } catch (error) {
    console.error('Error updating product review:', error);
    if (error instanceof z.ZodError) {
      const errors = error.issues || [];
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update product review'
    });
  }
});

// DELETE /api/stores/:tenantId/products/:productId/reviews - Delete user's product review
router.delete('/:tenantId/products/:productId/reviews', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, productId } = req.params;
    const userId = req.user?.userId;

    const pool = getDirectPool();

    // Delete the product review
    const deleteQuery = `
      DELETE FROM store_reviews
      WHERE tenant_id = $1 AND product_id = $2 AND user_id = $3
      RETURNING id
    `;

    const result = await pool.query(deleteQuery, [tenantId, productId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product review not found'
      });
    }

    // Update rating summary
    await updateRatingSummary(pool, tenantId);

    res.json({
      success: true,
      message: 'Product review deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting product review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product review'
    });
  }
});

// GET /api/stores/:tenantId/products/:productId/reviews/user - Get current user's review for a product
router.get('/:tenantId/products/:productId/reviews/user', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId, productId } = req.params;
    const userId = req.user!.userId || req.user!.user_id;

    const pool = getDirectPool();

    const reviewQuery = `
      SELECT
        id,
        rating,
        review_text,
        verified_purchase,
        location_lat,
        location_lng,
        created_at,
        updated_at
      FROM store_reviews
      WHERE tenant_id = $1 AND product_id = $2 AND user_id = $3
    `;
    const result = await pool.query(reviewQuery, [tenantId, productId, userId]);

    const review = result.rows[0] || null;

    res.json({
      success: true,
      data: review
    });

  } catch (error) {
    console.error('Error fetching user product review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user product review'
    });
  }
});

// GET /api/stores/:tenantId/products/:productId/reviews/summary - Get rating summary for a product
router.get('/:tenantId/products/:productId/reviews/summary', async (req: Request, res: Response) => {
  try {
    const { tenantId, productId } = req.params;

    const pool = getDirectPool();

    const summaryQuery = `
      SELECT
        COALESCE(AVG(rating), 0) as rating_avg,
        COUNT(*) as rating_count,
        COUNT(*) FILTER (WHERE rating = 1) as rating_1_count,
        COUNT(*) FILTER (WHERE rating = 2) as rating_2_count,
        COUNT(*) FILTER (WHERE rating = 3) as rating_3_count,
        COUNT(*) FILTER (WHERE rating = 4) as rating_4_count,
        COUNT(*) FILTER (WHERE rating = 5) as rating_5_count,
        COALESCE(SUM(helpful_count), 0) as helpful_count_total,
        COUNT(*) FILTER (WHERE verified_purchase = true) as verified_purchase_count,
        MAX(created_at) as last_review_at
      FROM store_reviews
      WHERE tenant_id = $1 AND product_id = $2 AND approval_status = 'approved'
    `;
    const result = await pool.query(summaryQuery, [tenantId, productId]);

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
    console.error('Error fetching product review summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product review summary'
    });
  }
});

export default router;
