/**
 * useReviews Hook
 * 
 * Encapsulates reviews logic for StoreRatingDisplay component
 * Handles fetching rating summary, reviews, and user review based on scope
 */

import { useState, useEffect, useCallback } from 'react';
import { reviewsService, type ReviewSummary, type Review } from '@/services/ReviewsSingletonService';

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
      const summary = await reviewsService.getRatingSummary(tenantId);
      setSummary(summary);
    } catch (error) {
      console.error('Error fetching rating summary:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    try {
      const reviews = await reviewsService.getReviews(tenantId, 10);
      setReviews(reviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  }, [tenantId]);

  // Fetch user review (only for private scope)
  const fetchUserReview = useCallback(async () => {
    try {
      const userReview = await reviewsService.getUserReview(tenantId);
      setUserReview(userReview);
    } catch (error) {
      console.error('Error fetching user review:', error);
    }
  }, [tenantId]);

  // Handle helpful vote
  const handleHelpfulVote = useCallback(async (reviewId: string, isHelpful: boolean) => {
    try {
      // ReviewsSingletonService handles both public and private operations
      const success = await reviewsService.submitHelpfulVote(reviewId, isHelpful);
      
      if (success) {
        // Refresh reviews to update vote counts
        fetchReviews();
        if (!isPublic) {
          fetchUserReview();
        }
      }
    } catch (error) {
      console.error('Error submitting helpful vote:', error);
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
      const response = await reviewsService.submitReview(tenantId, {
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
      console.error('Error submitting review:', error);
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
