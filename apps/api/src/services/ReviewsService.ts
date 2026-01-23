/**
 * Reviews Service - UniversalSingleton Implementation
 * Handles review management, moderation, and analytics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { prisma } from '../prisma';

// Review Types
export interface Review {
  id: string;
  tenantId: string;
  userId?: string;
  productId?: string;
  rating: number;
  reviewText?: string;
  helpfulCount?: number;
  verifiedPurchase?: boolean;
  locationLat?: number;
  locationLng?: number;
  sessionId?: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewFilter {
  tenantId?: string;
  productId?: string;
  userId?: string;
  rating?: number;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  verifiedPurchase?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'rating' | 'helpfulCount';
  sortOrder?: 'asc' | 'desc';
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  pendingReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
  verifiedPurchaseReviews: number;
  averageHelpfulCount: number;
}

export interface ReviewCreateRequest {
  tenantId: string;
  userId?: string;
  productId?: string;
  rating: number;
  reviewText?: string;
  verifiedPurchase?: boolean;
  locationLat?: number;
  locationLng?: number;
  sessionId?: string;
  userName?: string;
  userEmail?: string;
}

export interface ReviewUpdateRequest {
  rating?: number;
  reviewText?: string;
  verifiedPurchase?: boolean;
  locationLat?: number;
  locationLng?: number;
}

class ReviewsService extends UniversalSingleton {
  private static instance: ReviewsService;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'public',
      defaultTTL: 1800, // 30 minutes
      maxCacheSize: 500,
      enableMetrics: true,
      enableLogging: true
    });
  }

  static getInstance(): ReviewsService {
    if (!ReviewsService.instance) {
      ReviewsService.instance = new ReviewsService('reviews-service');
    }
    return ReviewsService.instance;
  }

  // ====================
  // CORE REVIEW OPERATIONS
  // ====================

  /**
   * Create a new review
   */
  async createReview(request: ReviewCreateRequest): Promise<Review> {
    try {
      // Check if product exists, if productId is provided
      if (request.productId) {
        const product = await prisma.inventory_items.findUnique({
          where: { id: request.productId }
        });
        
        if (!product) {
          // Product doesn't exist, create review without product reference
          console.warn(`Product ${request.productId} not found, creating review without product reference`);
          request.productId = undefined;
        }
      }

      const review = await prisma.store_reviews.create({
        data: {
          tenant_id: request.tenantId,
          user_id: request.userId,
          product_id: request.productId,
          rating: request.rating,
          review_text: request.reviewText,
          verified_purchase: request.verifiedPurchase || false,
          location_lat: request.locationLat,
          location_lng: request.locationLng,
          session_id: request.sessionId,
          approval_status: 'pending', // Require moderation
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      // Update rating summary
      await this.updateRatingSummary(request.tenantId);

      const mappedReview = this.mapPrismaReview(review);
      
      // Cache the new review
      const cacheKey = `review-${review.id}`;
      await this.setCache(cacheKey, mappedReview);

      this.logInfo('Review created successfully', { reviewId: review.id, tenantId: request.tenantId });
      
      return mappedReview;
    } catch (error) {
      this.logError('Error creating review', error);
      throw error;
    }
  }

  /**
   * Get review by ID
   */
  async getReview(reviewId: string): Promise<Review | null> {
    try {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(reviewId)) {
        console.warn(`Invalid UUID format for review ID: ${reviewId}`);
        return null;
      }

      const cacheKey = `review-${reviewId}`;
      const cached = await this.getFromCache<Review>(cacheKey);
      if (cached) {
        return cached;
      }

      const review = await prisma.store_reviews.findUnique({
        where: { id: reviewId },
        include: {
          inventory_items: {
            select: {
              id: true,
              title: true,
              sku: true
            }
          }
        }
      });

      if (!review) {
        return null;
      }

      const mappedReview = this.mapPrismaReview(review);
      await this.setCache(cacheKey, mappedReview);
      
      return mappedReview;
    } catch (error) {
      this.logError('Error fetching review', error);
      throw error;
    }
  }

  /**
   * Update a review
   */
  async updateReview(reviewId: string, updates: ReviewUpdateRequest): Promise<Review> {
    try {
      const existingReview = await prisma.store_reviews.findUnique({
        where: { id: reviewId }
      });

      if (!existingReview) {
        throw new Error('Review not found');
      }

      const review = await prisma.store_reviews.update({
        where: { id: reviewId },
        data: {
          rating: updates.rating,
          review_text: updates.reviewText,
          verified_purchase: updates.verifiedPurchase,
          location_lat: updates.locationLat,
          location_lng: updates.locationLng,
          updated_at: new Date()
        }
      });

      // Update rating summary if rating changed
      if (updates.rating && updates.rating !== existingReview.rating) {
        await this.updateRatingSummary(existingReview.tenant_id);
      }

      const mappedReview = this.mapPrismaReview(review);
      
      // Update cache
      const cacheKey = `review-${reviewId}`;
      await this.setCache(cacheKey, mappedReview);

      this.logInfo('Review updated successfully', { reviewId });
      
      return mappedReview;
    } catch (error) {
      this.logError('Error updating review', error);
      throw error;
    }
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string): Promise<void> {
    try {
      const review = await prisma.store_reviews.findUnique({
        where: { id: reviewId }
      });

      if (!review) {
        throw new Error('Review not found');
      }

      await prisma.store_reviews.delete({
        where: { id: reviewId }
      });

      // Update rating summary
      await this.updateRatingSummary(review.tenant_id);

      // Clear cache
      const cacheKey = `review-${reviewId}`;
      await this.clearCache(cacheKey);

      this.logInfo('Review deleted successfully', { reviewId });
    } catch (error) {
      this.logError('Error deleting review', error);
      throw error;
    }
  }

  /**
   * List reviews with filtering
   */
  async listReviews(filters: ReviewFilter = {}): Promise<Review[]> {
    try {
      const cacheKey = `reviews-list-${JSON.stringify(filters)}`;
      const cached = await this.getFromCache<Review[]>(cacheKey);
      if (cached) {
        return cached;
      }

      const where: any = {};
      
      if (filters.tenantId) where.tenant_id = filters.tenantId;
      if (filters.productId) where.product_id = filters.productId;
      if (filters.userId) where.user_id = filters.userId;
      if (filters.rating) where.rating = filters.rating;
      if (filters.approvalStatus) where.approval_status = filters.approvalStatus;
      if (filters.verifiedPurchase !== undefined) where.verified_purchase = filters.verifiedPurchase;

      const orderBy: any = {};
      if (filters.sortBy) {
        const field = filters.sortBy === 'createdAt' ? 'created_at' : 
                     filters.sortBy === 'rating' ? 'rating' : 
                     filters.sortBy === 'helpfulCount' ? 'helpful_count' : 'created_at';
        orderBy[field] = filters.sortOrder || 'desc';
      } else {
        orderBy.created_at = 'desc';
      }

      const reviews = await prisma.store_reviews.findMany({
        where,
        orderBy,
        take: filters.limit,
        skip: filters.offset,
        include: {
          inventory_items: {
            select: {
              id: true,
              title: true,
              sku: true
            }
          }
        }
      });

      const mappedReviews = reviews.map(review => this.mapPrismaReview(review));
      await this.setCache(cacheKey, mappedReviews);
      
      return mappedReviews;
    } catch (error) {
      this.logError('Error listing reviews', error);
      throw error;
    }
  }

  // ====================
  // REVIEW MODERATION
  // ====================

  /**
   * Approve a review
   */
  async approveReview(reviewId: string, approvedBy: string): Promise<Review> {
    try {
      const review = await prisma.store_reviews.update({
        where: { id: reviewId },
        data: {
          approval_status: 'approved',
          approved_by: approvedBy,
          approved_at: new Date(),
          updated_at: new Date()
        }
      });

      // Update rating summary
      await this.updateRatingSummary(review.tenant_id);

      const mappedReview = this.mapPrismaReview(review);
      
      // Update cache
      const cacheKey = `review-${reviewId}`;
      await this.setCache(cacheKey, mappedReview);

      this.logInfo('Review approved successfully', { reviewId, approvedBy });
      
      return mappedReview;
    } catch (error) {
      this.logError('Error approving review', error);
      throw error;
    }
  }

  /**
   * Reject a review
   */
  async rejectReview(reviewId: string, rejectionReason: string, rejectedBy: string): Promise<Review> {
    try {
      const review = await prisma.store_reviews.update({
        where: { id: reviewId },
        data: {
          approval_status: 'rejected',
          rejection_reason: rejectionReason,
          approved_by: rejectedBy,
          approved_at: new Date(),
          updated_at: new Date()
        }
      });

      const mappedReview = this.mapPrismaReview(review);
      
      // Update cache
      const cacheKey = `review-${reviewId}`;
      await this.setCache(cacheKey, mappedReview);

      this.logInfo('Review rejected successfully', { reviewId, rejectionReason });
      
      return mappedReview;
    } catch (error) {
      this.logError('Error rejecting review', error);
      throw error;
    }
  }

  /**
   * Get pending reviews for moderation
   */
  async getPendingReviews(tenantId?: string): Promise<Review[]> {
    return this.listReviews({
      tenantId,
      approvalStatus: 'pending',
      sortBy: 'createdAt',
      sortOrder: 'asc'
    });
  }

  // ====================
  // REVIEW ANALYTICS
  // ====================

  /**
   * Get review statistics
   */
  async getReviewStats(tenantId?: string): Promise<ReviewStats> {
    try {
      const cacheKey = `review-stats-${tenantId || 'all'}`;
      const cached = await this.getFromCache<ReviewStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const where = tenantId ? { tenant_id: tenantId } : {};

      const [totalResult, ratingDistribution, statusCounts, verifiedCounts, helpfulAvg] = await Promise.all([
        prisma.store_reviews.count({ where }),
        prisma.store_reviews.groupBy({
          by: ['rating'],
          where,
          _count: { rating: true }
        }),
        prisma.store_reviews.groupBy({
          by: ['approval_status'],
          where,
          _count: { approval_status: true }
        }),
        prisma.store_reviews.aggregate({
          where: { ...where, verified_purchase: true },
          _count: { id: true }
        }),
        prisma.store_reviews.aggregate({
          where,
          _avg: { helpful_count: true }
        })
      ]);

      // Build rating distribution
      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratingDistribution.forEach(item => {
        if (item.rating != null) {
          distribution[item.rating] = item._count.rating;
        }
      });

      // Build status counts
      const statusMap = statusCounts.reduce((acc, item) => {
        if (item.approval_status != null) {
          acc[item.approval_status] = item._count.approval_status;
        }
        return acc;
      }, {} as Record<string, number>);

      const stats: ReviewStats = {
        totalReviews: totalResult,
        averageRating: ratingDistribution.length > 0 
          ? ratingDistribution.reduce((sum, item) => sum + (item.rating || 0) * item._count.rating, 0) / totalResult
          : 0,
        ratingDistribution: {
          1: distribution[1] || 0,
          2: distribution[2] || 0,
          3: distribution[3] || 0,
          4: distribution[4] || 0,
          5: distribution[5] || 0
        },
        pendingReviews: statusMap.pending || 0,
        approvedReviews: statusMap.approved || 0,
        rejectedReviews: statusMap.rejected || 0,
        verifiedPurchaseReviews: verifiedCounts._count.id,
        averageHelpfulCount: helpfulAvg._avg.helpful_count || 0
      };

      await this.setCache(cacheKey, stats);
      return stats;
    } catch (error) {
      this.logError('Error fetching review stats', error);
      throw error;
    }
  }

  // ====================
  // HELPER METHODS
  // ====================

  /**
   * Map Prisma review to Review interface
   */
  private mapPrismaReview(prismaReview: any): Review {
    return {
      id: prismaReview.id,
      tenantId: prismaReview.tenant_id,
      userId: prismaReview.user_id,
      productId: prismaReview.product_id,
      rating: prismaReview.rating,
      reviewText: prismaReview.review_text,
      helpfulCount: prismaReview.helpful_count || 0,
      verifiedPurchase: prismaReview.verified_purchase || false,
      locationLat: prismaReview.location_lat ? Number(prismaReview.location_lat) : undefined,
      locationLng: prismaReview.location_lng ? Number(prismaReview.location_lng) : undefined,
      sessionId: prismaReview.session_id,
      approvalStatus: prismaReview.approval_status,
      approvedBy: prismaReview.approved_by,
      approvedAt: prismaReview.approved_at,
      rejectionReason: prismaReview.rejection_reason,
      createdAt: prismaReview.created_at,
      updatedAt: prismaReview.updated_at
    };
  }

  /**
   * Update rating summary for a tenant
   */
  private async updateRatingSummary(tenantId: string): Promise<void> {
    try {
      // This would update the store_rating_summary table
      // For now, we'll just log it since the existing store-reviews.ts handles this
      this.logInfo('Rating summary update triggered', { tenantId });
    } catch (error) {
      this.logError('Error updating rating summary', error);
    }
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      reviewsCreated: this.metrics.cacheHits,
      reviewsModerated: this.metrics.cacheMisses,
      averageRating: 4.2, // This would be calculated from actual data
      moderationQueueSize: 0
    };
  }
}

export default ReviewsService;
