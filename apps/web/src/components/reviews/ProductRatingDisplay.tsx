'use client';

import { useState, useEffect } from 'react';
//import { Star, MessageSquare, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ReviewForm from '@/components/reviews/ReviewForm';
import { api } from '@/lib/api';
import { MessageSquare, Star, User } from 'lucide-react';

interface ProductRatingDisplayProps {
  productId: string;
  tenantId: string;
  showWriteReview?: boolean;
}

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  helpful_count: number;
  verified_purchase: boolean;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  session_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface RatingSummary {
  rating_avg: number;
  rating_count: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
  verified_purchase_count: number;
}

interface UserReview {
  id: string;
  rating: number;
  review_text: string | null;
  verified_purchase: boolean;
  created_at: string;
  updated_at: string;
}

export default function ProductRatingDisplay({ productId, tenantId, showWriteReview = true }: ProductRatingDisplayProps) {
  const { user, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<UserReview | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch product reviews and summary
  const fetchReviews = async () => {
    try {
      setLoading(true);

      // Fetch summary
      const summaryResponse = await api.get(`/api/stores/${tenantId}/products/${productId}/reviews/summary`);
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        if (summaryData.success) {
          // Parse string values to numbers
          const parsedSummary = {
            ...summaryData.data,
            rating_avg: parseFloat(summaryData.data.rating_avg) || 0,
            rating_count: parseInt(summaryData.data.rating_count) || 0,
            rating_1_count: parseInt(summaryData.data.rating_1_count) || 0,
            rating_2_count: parseInt(summaryData.data.rating_2_count) || 0,
            rating_3_count: parseInt(summaryData.data.rating_3_count) || 0,
            rating_4_count: parseInt(summaryData.data.rating_4_count) || 0,
            rating_5_count: parseInt(summaryData.data.rating_5_count) || 0,
            helpful_count_total: parseInt(summaryData.data.helpful_count_total) || 0,
            verified_purchase_count: parseInt(summaryData.data.verified_purchase_count) || 0
          };
          setSummary(parsedSummary);
        }
      }

      // Fetch reviews
      const reviewsResponse = await api.get(`/api/stores/${tenantId}/products/${productId}/reviews?limit=5`);
      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json();
        if (reviewsData.success) {
          setReviews(reviewsData.data.reviews);
        }
      }

      // Fetch user's review if authenticated
      if (isAuthenticated) {
        try {
          const userReviewResponse = await api.get(`/api/stores/${tenantId}/products/${productId}/reviews/user`);
          if (userReviewResponse.ok) {
            const userReviewData = await userReviewResponse.json();
            if (userReviewData.success && userReviewData.data) {
              setUserReview(userReviewData.data);
            }
          }
        } catch (userReviewError) {
          // User hasn't reviewed this product yet, that's ok
        }
      }
    } catch (err) {
      console.error('Error fetching product reviews:', err);
      setError('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [productId, tenantId, isAuthenticated]);

  const handleReviewSubmit = async (formData: any) => {
    try {
      const endpoint = isAuthenticated
        ? `/api/stores/${tenantId}/products/${productId}/reviews`
        : `/api/stores/${tenantId}/products/${productId}/reviews/anonymous`;

      const response = await api.post(endpoint, formData);

      if (response.ok) {
        const responseData = await response.json();
        if (responseData.success) {
          setShowReviewForm(false);
          // Refresh reviews
          await fetchReviews();
        } else {
          throw new Error(responseData.error || 'Failed to submit review');
        }
      } else {
        throw new Error('Failed to submit review');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      throw err;
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const starSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Customer Reviews
        </h2>
        {showWriteReview && (
          <button
            onClick={() => setShowReviewForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{userReview ? 'Edit Review' : 'Write Review'}</span>
          </button>
        )}
      </div>

      {/* Rating Summary */}
      {summary && summary.rating_count > 0 && summary.rating_avg != null && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {typeof summary.rating_avg === 'number' ? summary.rating_avg.toFixed(1) : '0.0'}
              </div>
              {renderStars(typeof summary.rating_avg === 'number' ? Math.round(summary.rating_avg) : 0, 'md')}
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {summary.rating_count} review{summary.rating_count !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = summary[`rating_${stars}_count` as keyof RatingSummary] as number;
                const percentage = summary.rating_count > 0 ? (count / summary.rating_count) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-sm">
                      <span>{stars}</span>
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    </div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 w-8">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {renderStars(review.rating)}
                    {review.verified_purchase && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        Verified Purchase
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {review.first_name && review.last_name
                      ? `${review.first_name} ${review.last_name}`
                      : review.email || 'Anonymous'
                    }
                    {' • '}
                    {new Date(review.created_at).toLocaleDateString()}
                  </div>

                  {review.review_text && (
                    <p className="text-gray-900 dark:text-white leading-relaxed">
                      {review.review_text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Reviews Yet */}
      {summary && summary.rating_count === 0 && (
        <div className="text-center py-8">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No reviews yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Be the first to review this product!
          </p>
        </div>
      )}

      {/* Review Form Modal */}
      {showReviewForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {userReview ? 'Edit Your Review' : 'Write a Review'}
              </h3>
              <ReviewForm
                productId={productId}
                tenantId={tenantId}
                onClose={() => setShowReviewForm(false)}
                onSubmit={handleReviewSubmit}
                isAnonymous={!isAuthenticated}
                initialValues={userReview ? {
                  rating: userReview.rating,
                  reviewText: userReview.review_text || ''
                } : undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
