'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button, Badge } from '@mantine/core';
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Mail,
  Calendar,
  Eye,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';
import { authenticatedReviewService, Review } from '@/services/AuthenticatedReviewService';
import { reviewsService } from '@/services/ReviewsSingletonService';

interface ReviewStats {
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
  averageRating: number;
}

interface ReviewManagementDashboardProps {
  tenantId: string;
}

export default function ReviewManagementDashboard({ tenantId }: ReviewManagementDashboardProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPendingReviews();
    fetchStats();
  }, [tenantId]);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      const pendingReviews = await authenticatedReviewService.getPendingReviews(tenantId);
      setReviews(pendingReviews || []);
    } catch (error) {
      console.error('Error fetching pending reviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const summary = await reviewsService.getRatingSummary(tenantId);
      if (summary) {
        // We need to get total counts from the API
        // For now, we'll calculate from the pending reviews we have
        const pendingCount = reviews.length;
        setStats({
          totalReviews: summary.rating_count || 0,
          pendingReviews: pendingCount,
          approvedReviews: (summary.rating_count || 0) - pendingCount,
          rejectedReviews: 0, // We don't track this yet
          averageRating: summary.rating_avg || 0
        });
      }
    } catch (error) {
      console.error('Error fetching review stats:', error);
    }
  };

  const handleApprove = async (reviewId: string) => {
    setProcessingIds(prev => new Set(prev).add(reviewId));
    try {
      await authenticatedReviewService.approveReview(tenantId, reviewId);
      setReviews(prev => prev.filter(review => review.id !== reviewId));
      fetchStats(); // Refresh stats
    } catch (error) {
      console.error('Error approving review:', error);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(reviewId);
        return newSet;
      });
    }
  };

  const handleReject = async (reviewId: string) => {
    setProcessingIds(prev => new Set(prev).add(reviewId));
    try {
      await authenticatedReviewService.rejectReview(tenantId, reviewId);
      setReviews(prev => prev.filter(review => review.id !== reviewId));
      fetchStats(); // Refresh stats
    } catch (error) {
      console.error('Error rejecting review:', error);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(reviewId);
        return newSet;
      });
    }
  };

  const handleBulkApprove = async () => {
    const reviewIds = Array.from(selectedReviews);
    setProcessingIds(prev => new Set([...prev, ...reviewIds]));

    try {
      await authenticatedReviewService.bulkApproveReviews(tenantId, reviewIds);
      setReviews(prev => prev.filter(review => !selectedReviews.has(review.id)));
      setSelectedReviews(new Set());
      fetchStats();
    } catch (error) {
      console.error('Error bulk approving reviews:', error);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        reviewIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  const handleBulkReject = async () => {
    const reviewIds = Array.from(selectedReviews);
    setProcessingIds(prev => new Set([...prev, ...reviewIds]));

    try {
      await authenticatedReviewService.bulkRejectReviews(tenantId, reviewIds);
      setReviews(prev => prev.filter(review => !selectedReviews.has(review.id)));
      setSelectedReviews(new Set());
      fetchStats();
    } catch (error) {
      console.error('Error bulk rejecting reviews:', error);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        reviewIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  const toggleReviewSelection = (reviewId: string) => {
    setSelectedReviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedReviews(new Set(reviews.map(review => review.id)));
  };

  const clearSelection = () => {
    setSelectedReviews(new Set());
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Pending Reviews
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.pendingReviews || 0}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Approved Reviews
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.approvedReviews || 0}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total Reviews
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.totalReviews || 0}
                </p>
              </div>
              <MessageCircle className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Average Rating
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.averageRating ? stats.averageRating.toFixed(1) : '0.0'}
                </p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      {selectedReviews.size > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedReviews.size} review{selectedReviews.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  className="text-xs"
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkApprove}
                  disabled={processingIds.size > 0}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Approve All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkReject}
                  disabled={processingIds.size > 0}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  <X className="w-4 h-4 mr-1" />
                  Reject All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
              Pending Reviews ({reviews.length})
            </CardTitle>
            {reviews.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={selectedReviews.size === reviews.length}
              >
                Select All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading reviews...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No pending reviews
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                All reviews have been processed. New anonymous reviews will appear here for approval.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedReviews.has(review.id)}
                        onChange={() => toggleReviewSelection(review.id)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          {renderStars(review.rating)}
                          <Badge variant="light" size="sm">
                            {review.rating}/5
                          </Badge>
                          {review.isVerifiedPurchase && (
                            <Badge variant="outline" size="sm" color="green">
                              Verified Purchase
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {review.isAnonymous ? 'Anonymous' : 'User'}
                          </div>
                          {!review.isAnonymous && review.userEmail && (
                            <div className="flex items-center">
                              <Mail className="w-4 h-4 mr-1" />
                              {review.userEmail}
                            </div>
                          )}
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(review.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleApprove(review.id)}
                        disabled={processingIds.has(review.id)}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        {processingIds.has(review.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-1" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(review.id)}
                        disabled={processingIds.has(review.id)}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        {processingIds.has(review.id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                        ) : (
                          <XCircle className="w-4 h-4 mr-1" />
                        )}
                        Reject
                      </Button>
                    </div>
                  </div>

                  {(review.title || review.content) && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                      {review.title && (
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                          {review.title}
                        </h4>
                      )}
                      {review.content && (
                        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                          {review.content}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {review.helpfulVotes} helpful
                      </span>
                    </div>
                    <span>Review ID: {review.id.slice(-8)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
