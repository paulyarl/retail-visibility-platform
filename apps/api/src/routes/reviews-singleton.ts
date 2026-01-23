/**
 * Reviews API Routes - UniversalSingleton Implementation
 * Integrates ReviewsService with Express API
 */

import { Router } from 'express';
import ReviewsService from '../services/ReviewsService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const reviewsService = ReviewsService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get review statistics
 * GET /api/reviews-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    // Check if user has permission to view stats for this tenant
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await reviewsService.getReviewStats(tenantId);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Review statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[REVIEWS SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review statistics'
    });
  }
});

/**
 * Get review by ID
 * GET /api/reviews-singleton/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const review = await reviewsService.getReview(id);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if user has permission to access this tenant's reviews
    if (req.user?.tenantIds && !req.user.tenantIds.includes(review.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    res.json({
      success: true,
      data: {
        review,
        timestamp: new Date().toISOString()
      },
      message: 'Review retrieved successfully'
    });
  } catch (error) {
    console.error('Review retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve review',
      error: (error as Error).message
    });
  }
});

/**
 * Get reviews by product
 * GET /api/reviews-singleton/product/:productId
 */
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = '1', limit = '10', sort = 'newest' } = req.query;
    
    const reviews = await reviewsService.listReviews({
      productId,
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
      sortBy: sort as any,
      sortOrder: 'desc'
    });
    
    // Filter reviews user has access to
    const accessibleReviews = reviews.filter(review => 
      !req.user?.tenantIds || req.user.tenantIds.includes(review.tenantId)
    );
    
    res.json({
      success: true,
      data: {
        reviews: accessibleReviews,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: accessibleReviews.length
        },
        timestamp: new Date().toISOString()
      },
      message: 'Product reviews retrieved successfully'
    });
  } catch (error) {
    console.error('Product reviews retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve product reviews',
      error: (error as Error).message
    });
  }
});

/**
 * Get reviews by tenant
 * GET /api/reviews-singleton/tenant/:tenantId
 */
router.get('/tenant/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { page = '1', limit = '10', status } = req.query;
    
    // Check if user has permission to access this tenant's reviews
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const reviews = await reviewsService.listReviews({
      tenantId,
      approvalStatus: status as any,
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    
    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: reviews.length
        },
        timestamp: new Date().toISOString()
      },
      message: 'Tenant reviews retrieved successfully'
    });
  } catch (error) {
    console.error('Tenant reviews retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tenant reviews',
      error: (error as Error).message
    });
  }
});

/**
 * List all reviews
 * GET /api/reviews-singleton
 */
router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '10', sort = 'newest', status } = req.query;
    
    const reviews = await reviewsService.listReviews({
      approvalStatus: status as any,
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
      sortBy: sort as any,
      sortOrder: 'desc'
    });
    
    // Filter reviews user has access to
    const accessibleReviews = reviews.filter(review => 
      !req.user?.tenantIds || req.user.tenantIds.includes(review.tenantId)
    );
    
    res.json({
      success: true,
      data: {
        reviews: accessibleReviews,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: accessibleReviews.length
        },
        timestamp: new Date().toISOString()
      },
      message: 'Reviews retrieved successfully'
    });
  } catch (error) {
    console.error('Reviews listing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reviews',
      error: (error as Error).message
    });
  }
});

/**
 * Create new review
 * POST /api/reviews-singleton
 */
router.post('/', async (req, res) => {
  try {
    const reviewData = req.body;
    
    // Check if user has permission to create review for this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(reviewData.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const review = await reviewsService.createReview({
      ...reviewData,
      userId: req.user?.userId
    });
    
    res.status(201).json({
      success: true,
      data: {
        review,
        timestamp: new Date().toISOString()
      },
      message: 'Review created successfully'
    });
  } catch (error) {
    console.error('Review creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create review',
      error: (error as Error).message
    });
  }
});

/**
 * Update review
 * PUT /api/reviews-singleton/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Get the review first to check permissions
    const existingReview = await reviewsService.getReview(id);
    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if user has permission to update this review
    const canUpdate = req.user?.userId === existingReview.userId || 
                     (req.user?.role === 'PLATFORM_ADMIN' || req.user?.role === 'ADMIN');
    
    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions to update this review'
      });
    }
    
    const review = await reviewsService.updateReview(id, updates);
    
    res.json({
      success: true,
      data: {
        review,
        timestamp: new Date().toISOString()
      },
      message: 'Review updated successfully'
    });
  } catch (error) {
    console.error('Review update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review',
      error: (error as Error).message
    });
  }
});

/**
 * Delete review
 * DELETE /api/reviews-singleton/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the review first to check permissions
    const existingReview = await reviewsService.getReview(id);
    if (!existingReview) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }
    
    // Check if user has permission to delete this review
    const canDelete = req.user?.userId === existingReview.userId || 
                    (req.user?.role === 'PLATFORM_ADMIN' || req.user?.role === 'ADMIN');
    
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions to delete this review'
      });
    }
    
    await reviewsService.deleteReview(id);
    
    res.json({
      success: true,
      data: {
        reviewId: id,
        timestamp: new Date().toISOString()
      },
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Review deletion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: (error as Error).message
    });
  }
});

/**
 * Approve review (admin only)
 * POST /api/reviews-singleton/:id/approve
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has admin permissions
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required'
      });
    }
    
    const review = await reviewsService.approveReview(id, req.user?.userId || 'system');
    
    res.json({
      success: true,
      data: {
        review,
        timestamp: new Date().toISOString()
      },
      message: 'Review approved successfully'
    });
  } catch (error) {
    console.error('Review approval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve review',
      error: (error as Error).message
    });
  }
});

/**
 * Reject review (admin only)
 * POST /api/reviews-singleton/:id/reject
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Check if user has admin permissions
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required'
      });
    }
    
    const review = await reviewsService.rejectReview(id, reason, req.user?.userId || 'system');
    
    res.json({
      success: true,
      data: {
        review,
        timestamp: new Date().toISOString()
      },
      message: 'Review rejected successfully'
    });
  } catch (error) {
    console.error('Review rejection failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject review',
      error: (error as Error).message
    });
  }
});

/**
 * Get pending reviews (admin only)
 * GET /api/reviews-singleton/pending
 */
router.get('/pending', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Check if user has admin permissions
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required'
      });
    }
    
    const reviews = await reviewsService.getPendingReviews(tenantId as string);
    
    // Filter reviews user has access to
    const accessibleReviews = reviews.filter(review => 
      !req.user?.tenantIds || req.user.tenantIds.includes(review.tenantId)
    );
    
    res.json({
      success: true,
      data: {
        reviews: accessibleReviews,
        count: accessibleReviews.length,
        timestamp: new Date().toISOString()
      },
      message: 'Pending reviews retrieved successfully'
    });
  } catch (error) {
    console.error('Pending reviews retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending reviews',
      error: (error as Error).message
    });
  }
});

export default router;
