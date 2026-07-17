/**
 * useReviews Hook
 * 
 * Encapsulates reviews logic for StoreRatingDisplay component
 * Handles fetching rating summary, reviews, and user review based on scope
 */

import { useState, useEffect, useCallback } from 'react';
import { reviewsService, type ReviewSummary, type Review } from '@/services/ReviewsSingletonService';
import { publicReviewsService } from '@/services/PublicReviewsSingletonService';
import { clientLogger } from '@/lib/client-logger';

interface UseReviewsOptions {
  tenantId: string;
  isPublic: boolean;
  showReviews?: boolean;
}

interface UseReviewsReturn {
  // Data
  summary: ReviewSummary | null;
  reviews: Review[];
  userReview: Review | null;
  
  // State
  loading: boolean;
  showReviews: boolean;
  showReviewForm: boolean;
  
  // Actions
  setShowReviews: (show: boolean) => void;
  setShowReviewForm: (show: boolean) => void;
  fetchRatingSummary: () => Promise<void>;
  fetchReviews: () => Promise<void>;
  fetchUserReview: () => Promise<void>;
  handleHelpfulVote: (reviewId: string, isHelpful: boolean) => Promise<void>;
  handleReviewSubmit: (reviewData: {
    rating: number;
    title: string;
    content: string;
    userName: string;
    userEmail: string;
    sessionId?: string;
  }) => Promise<void>;
}

export function useReviews({ tenantId, isPublic, showReviews = false }: UseReviewsOptions): UseReviewsReturn {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewsState, setShowReviewsState] = useState(showReviews);
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Fetch rating summary
  const fetchRatingSummary = useCallback(async () => {
    try {
      const service = isPublic ? publicReviewsService : reviewsService;
      const summary = await service.getRatingSummary(tenantId);
      setSummary(summary);
    } catch (error) {
      clientLogger.error('Error fetching rating summary:', { detail: error });
    } finally {
      setLoading(false);
    }
  }, [tenantId, isPublic]);

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    try {
      const service = isPublic ? publicReviewsService : reviewsService;
      const reviews = await service.getReviews(tenantId, 10);
      setReviews(reviews);
    } catch (error) {
      clientLogger.error('Error fetching reviews:', { detail: error });
    }
  }, [tenantId, isPublic]);

  // Fetch user review (only for private scope)
  const fetchUserReview = useCallback(async () => {
    try {
      const userReview = await reviewsService.getUserReview(tenantId);
      setUserReview(userReview);
    } catch (error) {
      clientLogger.error('Error fetching user review:', { detail: error });
    }
  }, [tenantId]);

  // Handle helpful vote
  const handleHelpfulVote = useCallback(async (reviewId: string, isHelpful: boolean) => {
    try {
      // Use appropriate service based on scope
      const service = isPublic ? publicReviewsService : reviewsService;
      const success = await service.submitHelpfulVote(reviewId, isHelpful);
      
      if (success) {
        // Refresh reviews to update vote counts
        fetchReviews();
        if (!isPublic) {
          fetchUserReview();
        }
      }
    } catch (error) {
      clientLogger.error('Error submitting helpful vote:', { detail: error });
    }
  }, [fetchReviews, fetchUserReview, isPublic]);

  // Handle review submit
  const handleReviewSubmit = useCallback(async (reviewData: {
    rating: number;
    title: string;
    content: string;
    userName: string;
    userEmail: string;
    sessionId?: string;
  }) => {
    try {
      const service = isPublic ? publicReviewsService : reviewsService;
      const response = await service.submitReview(tenantId, {
        rating: reviewData.rating,
        content: reviewData.content,
        locationLat: null,
        locationLng: null,
        sessionId: reviewData.sessionId,
        userName: reviewData.userName,
        userEmail: reviewData.userEmail
      });
      
      if (response) {
        // Refresh data
        fetchRatingSummary();
        fetchReviews();
        if (!isPublic) {
          fetchUserReview();
        }
        setShowReviewForm(false);
      }
    } catch (error) {
      clientLogger.error('Error submitting review:', { detail: error });
    }
  }, [tenantId, fetchRatingSummary, fetchReviews, fetchUserReview, isPublic]);

  // Show reviews state handler
  const setShowReviews = useCallback((show: boolean) => {
    setShowReviewsState(show);
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchRatingSummary();
    if (showReviewsState) {
      fetchReviews();
    }
    if (!isPublic) {
      fetchUserReview();
    }
  }, [tenantId, showReviewsState, isPublic, fetchRatingSummary, fetchReviews, fetchUserReview]);

  // Fetch reviews when showReviews changes
  useEffect(() => {
    if (showReviewsState) {
      fetchReviews();
    }
  }, [showReviewsState, fetchReviews]);

  return {
    // Data
    summary,
    reviews,
    userReview,
    
    // State
    loading,
    showReviews: showReviewsState,
    showReviewForm,
    
    // Actions
    setShowReviews,
    setShowReviewForm,
    fetchRatingSummary,
    fetchReviews,
    fetchUserReview,
    handleHelpfulVote,
    handleReviewSubmit
  };
}
