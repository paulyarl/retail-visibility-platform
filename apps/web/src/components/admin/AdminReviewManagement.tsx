'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button, Badge, Select, TextInput, Input } from '@mantine/core';
import {
  Star,
  ThumbsUp,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Mail,
  Calendar,
  Building,
  AlertTriangle,
  Check,
  X,
  Eye
} from 'lucide-react';
import { adminReviewsService, AdminReview, AdminReviewStats } from '@/services/AdminReviewsSingletonService';

interface AdminReviewManagementProps {}

export default function AdminReviewManagement({}: AdminReviewManagementProps) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [stats, setStats] = useState<AdminReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [ratingFilter, setRatingFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [storeFilter, setStoreFilter] = useState('');
  const [reviewTypeFilter, setReviewTypeFilter] = useState<'all' | 'store' | 'product' | 'google'>('all');

  useEffect(() => {
    fetchReviews();
    fetchStats();
  }, [statusFilter, ratingFilter, reviewTypeFilter, searchTerm, storeFilter]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      
      // Build filters object for the API call
      const filters = {
        status: statusFilter === 'all' ? undefined : statusFilter,
        rating: ratingFilter === 'all' ? undefined : ratingFilter,
        reviewType: reviewTypeFilter === 'all' ? undefined : reviewTypeFilter,
        search: searchTerm || undefined,
        store: storeFilter || undefined,
      };

      const allReviews = await adminReviewsService.getAllAdminReviews(filters);
      setReviews(allReviews);
    } catch (error) {
      console.error('Error fetching admin reviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const stats = await adminReviewsService.getAdminReviewStats();
      setStats(stats);
    } catch (error) {
      console.error('Error fetching admin review stats:', error);
      setStats({
        totalReviews: 0,
        pendingReviews: 0,
        approvedReviews: 0,
        rejectedReviews: 0,
        averageRating: 0
      });
    }
  };

  const handleApprove = async (reviewId: string, tenantId: string) => {
    setProcessingIds(prev => new Set(prev).add(reviewId));
    try {
      await adminReviewsService.approveReview(reviewId);
      setReviews(prev => prev.map(review =>
        review.id === reviewId
          ? { ...review, approvalStatus: 'approved' as const }
          : review
      ));
      fetchStats();
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

  const handleReject = async (reviewId: string, tenantId: string) => {
    setProcessingIds(prev => new Set(prev).add(reviewId));
    try {
      await adminReviewsService.rejectReview(reviewId);
      setReviews(prev => prev.map(review =>
        review.id === reviewId
          ? { ...review, approvalStatus: 'rejected' as const }
          : review
      ));
      fetchStats();
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
      await adminReviewsService.bulkApproveReviews(reviewIds);

      setReviews(prev => prev.map(review =>
        selectedReviews.has(review.id)
          ? { ...review, approvalStatus: 'approved' as const }
          : review
      ));

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
      await adminReviewsService.bulkRejectReviews(reviewIds);

      setReviews(prev => prev.map(review =>
        selectedReviews.has(review.id)
          ? { ...review, approvalStatus: 'rejected' as const }
          : review
      ));

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
    setSelectedReviews(new Set(Array.isArray(reviews) ? reviews.map(review => review.id) : []));
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="light" color="orange">Pending</Badge>;
      case 'approved':
        return <Badge variant="light" color="green">Approved</Badge>;
      case 'rejected':
        return <Badge variant="light" color="red">Rejected</Badge>;
      default:
        return <Badge variant="light">Unknown</Badge>;
    }
  };

  const getReviewTypeBadge = (type: string) => {
    switch (type) {
      case 'store':
        return <Badge variant="outline" size="sm" color="blue">🏪 Store</Badge>;
      case 'product':
        return <Badge variant="outline" size="sm" color="purple">📦 Product</Badge>;
      case 'google':
        return <Badge variant="outline" size="sm" color="green">🌍 Google</Badge>;
      default:
        return <Badge variant="outline" size="sm">Review</Badge>;
    }
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
                  Rejected Reviews
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.rejectedReviews || 0}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
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
              <AlertTriangle className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <TextInput
                  placeholder="Search reviews..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <Select
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as typeof statusFilter)}
                data={[
                  { value: 'all', label: 'All Status' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rating
              </label>
              <Select
                value={ratingFilter}
                onChange={(value) => setRatingFilter(value as typeof ratingFilter)}
                data={[
                  { value: 'all', label: 'All Ratings' },
                  { value: '5', label: '5 Stars' },
                  { value: '4', label: '4 Stars' },
                  { value: '3', label: '3 Stars' },
                  { value: '2', label: '2 Stars' },
                  { value: '1', label: '1 Star' }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Review Type
              </label>
              <Select
                value={reviewTypeFilter}
                onChange={(value) => setReviewTypeFilter(value as typeof reviewTypeFilter)}
                data={[
                  { value: 'all', label: 'All Types' },
                  { value: 'store', label: 'Store Reviews' },
                  { value: 'product', label: 'Product Reviews' },
                  { value: 'google', label: 'Google Reviews' }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Store
              </label>
              <TextInput
                placeholder="Filter by store..."
                value={storeFilter}
                onChange={(e) => setStoreFilter(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('pending');
                  setRatingFilter('all');
                  setReviewTypeFilter('all');
                  setStoreFilter('');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
              Review Moderation ({reviews.length})
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
                No reviews found
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchTerm || statusFilter !== 'pending' || ratingFilter !== 'all' || reviewTypeFilter !== 'all' || storeFilter
                  ? 'Try adjusting your filters to see more reviews.'
                  : 'No reviews match the current criteria.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(reviews) && reviews.map((review) => (
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
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          {renderStars(review.rating)}
                          <Badge variant="light" size="sm">
                            {review.rating}/5
                          </Badge>
                          {getReviewTypeBadge(review.reviewType)}
                          {getStatusBadge(review.approvalStatus)}
                          {review.verifiedPurchase && (
                            <Badge variant="outline" size="sm" color="green">
                              Verified Purchase
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-1">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {review.userName || 'Anonymous'}
                          </div>
                          {review.userEmail && (
                            <div className="flex items-center">
                              <Mail className="w-4 h-4 mr-1" />
                              {review.userEmail}
                            </div>
                          )}
                          <div className="flex items-center">
                            <Building className="w-4 h-4 mr-1" />
                            <span className="font-medium">{review.tenantName}</span>
                          </div>
                          {review.reviewType === 'product' && review.productName && (
                            <div className="flex items-center">
                              <span className="font-medium text-blue-600">📦 {review.productName}</span>
                              {review.productSku && (
                                <span className="ml-1 text-gray-400">({review.productSku})</span>
                              )}
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
                      {review.approvalStatus === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(review.id, review.tenantId)}
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
                            onClick={() => handleReject(review.id, review.tenantId)}
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
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-gray-600 border-gray-600 hover:bg-gray-50"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>

                  {review.reviewText && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                        {review.reviewText}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {review.helpfulCount} helpful
                      </span>
                      {review.locationLat && review.locationLng && (
                        <span className="flex items-center">
                          <Eye className="w-3 h-3 mr-1" />
                          Location verified
                        </span>
                      )}
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
