'use client';

import React, { useEffect } from 'react';
import { Star, ThumbsUp, User, MapPin, Shield } from 'lucide-react';
import ReviewForm from './ReviewForm';
import { useReviews } from '@/hooks/useReviews';
import { type ReviewSummary, type Review } from '@/services/ReviewsSingletonService';

interface StoreRatingDisplayProps {
  tenantId: string;
  showWriteReview?: boolean;
  compact?: boolean;
  isPublic?: boolean; // New prop to determine service scope
  className?: string;
}

export const StoreRatingDisplay: React.FC<StoreRatingDisplayProps> = ({
  tenantId,
  showWriteReview = true,
  compact = false,
  isPublic = true, // Default to public for public pages
  className = ''
}) => {
  const {
    summary,
    reviews,
    userReview,
    loading,
    showReviews,
    showReviewForm,
    setShowReviews,
    setShowReviewForm,
    fetchRatingSummary,
    fetchReviews,
    fetchUserReview,
    handleHelpfulVote,
    handleReviewSubmit
  } = useReviews({ tenantId, isPublic, showReviews: false });

//  console.log('[StoreRatingDisplay] RENDER - showReviewForm:', showReviewForm, 'isPublic:', isPublic);

  useEffect(() => {
//    console.log('[StoreRatingDisplay] showReviewForm changed to:', showReviewForm);
  }, [showReviewForm]);

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5'
    };

    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClasses[size]} ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-transparent text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getUserName = (review: Review) => {
    if (review.first_name) {
      return `${review.first_name} ${review.last_name || ''}`.trim();
    }
    if (review.email) {
      return review.email.split('@')[0];
    }
    return 'Anonymous';
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
      </div>
    );
  }

  if (!summary || summary.rating_count === 0) {
    return (
      <div className={`text-gray-500 dark:text-gray-400 ${className}`}>
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-gray-300 dark:text-gray-600" />
          <span className="text-sm">No reviews yet</span>
          {showWriteReview && (
            <button
              onClick={() => {
//                console.log('[StoreRatingDisplay] Button clicked, setting showReviewForm to true');
                setShowReviewForm(true);
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer relative z-10"
              style={{ pointerEvents: 'auto' }}
            >
              Be the first to review
            </button>
          )}
        </div>

        {/* Review Form Modal - Render here for early return */}
        {showReviewForm && (
          <>
            {(() => {
//              console.log('[StoreRatingDisplay] Rendering ReviewForm modal, isAnonymous:', isPublic);
              return null;
            })()}
            <ReviewForm
              tenantId={tenantId}
              onClose={() => setShowReviewForm(false)}
              onSubmit={handleReviewSubmit}
              isAnonymous={isPublic}
            />
          </>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {renderStars(Math.round(summary.rating_avg), 'sm')}
        <span className="text-sm font-medium">{summary.rating_avg.toFixed(1)}</span>
        <span className="text-xs text-gray-500">({summary.rating_count})</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Rating Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-3xl font-bold">{summary.rating_avg.toFixed(1)}</div>
            {renderStars(Math.round(summary.rating_avg), 'lg')}
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {summary.rating_count} reviews
            </div>
          </div>
          
          {/* Rating Distribution */}
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((rating) => {
              const countKey = `rating_${rating}_count` as keyof ReviewSummary;
              const count = summary[countKey] as number;
              const percentage = summary.rating_count > 0 ? (count / summary.rating_count) * 100 : 0;
              
              return (
                <div key={rating} className="flex items-center gap-2">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm">{rating}</span>
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 w-8 text-right">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {showWriteReview && (
          <button
            onClick={() => setShowReviewForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {userReview ? 'Edit Review' : 'Write Review'}
          </button>
        )}
      </div>

      {/* Verified Purchase Badge */}
      {summary.verified_purchase_count > 0 && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Shield className="w-4 h-4" />
          <span>{summary.verified_purchase_count} verified purchases</span>
        </div>
      )}

      {/* Reviews List */}
      {showReviews && (
        <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">Customer Reviews</h3>
          
          {reviews.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div>
                        <div className="font-medium">{getUserName(review)}</div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          {renderStars(review.rating, 'sm')}
                          <span>{formatDate(review.created_at)}</span>
                          {review.verified_purchase && (
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <Shield className="w-3 h-3" />
                              <span className="text-xs">Verified</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {review.review_text && (
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{review.review_text}</p>
                  )}
                  
                  <div className="flex items-center gap-4">
                    {!isPublic ? (
                      <button
                        onClick={() => handleHelpfulVote(review.id, true)}
                        className={`flex items-center gap-1 text-sm ${
                          review.user_vote === true
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        Helpful ({review.helpful_count})
                      </button>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">
                        <a href="/auth/login" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">Login</a> to vote
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toggle Reviews Button */}
      <button
        onClick={() => setShowReviews(!showReviews)}
        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
      >
        {showReviews ? 'Hide Reviews' : `Show All ${summary.rating_count} Reviews`}
      </button>

      {/* Review Form Modal */}
      {showReviewForm && (
        <>
          {(() => {
            console.log('[StoreRatingDisplay] Rendering ReviewForm modal, isAnonymous:', isPublic);
            return null;
          })()}
          <ReviewForm
            tenantId={tenantId}
            onClose={() => setShowReviewForm(false)}
            onSubmit={handleReviewSubmit}
            isAnonymous={isPublic}
            initialValues={userReview ? {
              rating: userReview.rating,
              reviewText: userReview.review_text || ''
            } : undefined}
          />
        </>
      )}
    </div>
  );
};
