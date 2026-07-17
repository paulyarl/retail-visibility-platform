'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Tabs, Pagination, Select, Checkbox, TextInput, MultiSelect, Textarea, Text, Group, Stack, Grid } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import type { DatesRangeValue } from '@mantine/dates';
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
  X,
  CheckSquare,
  Store,
  Package
} from 'lucide-react';
import { authenticatedReviewService, Review } from '@/services/AuthenticatedReviewService';
import { reviewsService } from '@/services/ReviewsSingletonService';
import { clientLogger } from '@/lib/client-logger';

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

type ReviewType = 'store' | 'product';
type ReviewStatus = 'all' | 'pending' | 'approved';

export default function ReviewManagementDashboard({ tenantId }: ReviewManagementDashboardProps) {
  // Tab states
  const [activeReviewType, setActiveReviewType] = useState<ReviewType>('store');
  const [activeStatus, setActiveStatus] = useState<ReviewStatus>('all');

  // Review response states
  const [respondingToReview, setRespondingToReview] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Error handling states
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const MAX_RETRIES = 3;

  // Data states
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalReviews, setTotalReviews] = useState(0);

  // Bulk action states
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());

  // Load more state
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DatesRangeValue>([null, null]);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'rating_high' | 'rating_low' | 'helpful'>('newest');

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when tab/status changes
    setError(null); // Clear any existing errors
    fetchReviews();
    fetchStats();
  }, [tenantId, activeReviewType, activeStatus, currentPage, pageSize]);

  const fetchReviews = async (isRetry = false) => {
    try {
      if (!isRetry) {
        setLoading(true);
        setError(null);
      }

      /* console.log('[ReviewManagementDashboard] Fetching reviews:', {
        tenantId,
        reviewType: activeReviewType,
        status: activeStatus,
        page: currentPage,
        pageSize,
        isRetry
      }); */

      let result;
      const paginationOptions = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
      };

      if (activeReviewType === 'store') {
        if (activeStatus === 'pending') {
          result = await authenticatedReviewService.getPendingReviews(tenantId, {
            ...paginationOptions,
            reviewType: 'store'
          });
        } else if (activeStatus === 'approved') {
          result = await authenticatedReviewService.getApprovedReviews(tenantId, {
            limit: pageSize,
            page: currentPage
          });
        } else { // 'all'
          // For 'all', we need to combine pending and approved
          const [pendingResult, approvedResult] = await Promise.all([
            authenticatedReviewService.getPendingReviews(tenantId, {
              ...paginationOptions,
              reviewType: 'store'
            }),
            authenticatedReviewService.getApprovedReviews(tenantId, {
              limit: pageSize,
              page: currentPage
            })
          ]);

          // Combine and sort by created date
          const allReviews = [
            ...(pendingResult?.reviews || []),
            ...(approvedResult?.reviews || [])
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          result = {
            reviews: allReviews.slice(0, pageSize),
            pagination: {
              total: (pendingResult?.pagination?.total || 0) + (approvedResult?.pagination?.total || 0),
              hasMore: allReviews.length > pageSize
            }
          };
        }
      } else { // product reviews
        if (activeStatus === 'pending') {
          result = await authenticatedReviewService.getPendingReviews(tenantId, {
            ...paginationOptions,
            reviewType: 'product'
          });
        } else if (activeStatus === 'approved') {
          result = await authenticatedReviewService.getApprovedReviews(tenantId, {
            limit: pageSize,
            page: currentPage,
            reviewType: 'product'
          });
        } else { // 'all'
          // For 'all', we need to combine pending and approved product reviews
          const [pendingResult, approvedResult] = await Promise.all([
            authenticatedReviewService.getPendingReviews(tenantId, {
              ...paginationOptions,
              reviewType: 'product'
            }),
            authenticatedReviewService.getApprovedReviews(tenantId, {
              limit: pageSize,
              page: currentPage,
              reviewType: 'product'
            })
          ]);

          // Combine and sort by created date
          const allReviews = [
            ...(pendingResult?.reviews || []),
            ...(approvedResult?.reviews || [])
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

          result = {
            reviews: allReviews.slice(0, pageSize),
            pagination: {
              total: (pendingResult?.pagination?.total || 0) + (approvedResult?.pagination?.total || 0),
              hasMore: allReviews.length > pageSize
            }
          };
        }
      }

      setReviews(result?.reviews || []);
      setTotalReviews(result?.pagination?.total || 0);
      setRetryCount(0); // Reset retry count on success

      // Apply client-side filtering
      let filteredReviews = result?.reviews || [];

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filteredReviews = filteredReviews.filter(review =>
          review.first_name?.toLowerCase().includes(query) ||
          review.last_name?.toLowerCase().includes(query) ||
          review.email?.toLowerCase().includes(query) ||
          review.review_text?.toLowerCase().includes(query)
        );
      }

      // Rating filter
      if (ratingFilter.length > 0) {
        filteredReviews = filteredReviews.filter(review =>
          ratingFilter.includes(review.rating.toString())
        );
      }

      // Date range filter
      if (dateRange[0] || dateRange[1]) {
        filteredReviews = filteredReviews.filter(review => {
          const reviewDate = new Date(review.created_at);
          const startDate = dateRange[0] ? new Date(dateRange[0]) : null;
          const endDate = dateRange[1] ? new Date(dateRange[1]) : null;

          if (startDate && reviewDate < startDate) return false;
          if (endDate && reviewDate > endDate) return false;

          return true;
        });
      }

      // Apply sorting
      filteredReviews.sort((a, b) => {
        switch (sortBy) {
          case 'oldest':
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          case 'rating_high':
            return b.rating - a.rating;
          case 'rating_low':
            return a.rating - b.rating;
          case 'helpful':
            return b.helpful_count - a.helpful_count;
          case 'newest':
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });

      setReviews(filteredReviews);

    } catch (error) {
      clientLogger.error('Error fetching reviews:', { detail: error });
      const errorMessage = error instanceof Error ? error.message : 'Failed to load reviews';
      setError(errorMessage);

      // Auto-retry for certain errors
      if (!isRetry && retryCount < MAX_RETRIES && errorMessage.includes('network')) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchReviews(true), 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        setReviews([]);
      }
    } finally {
      if (!isRetry) {
        setLoading(false);
      }
    }
  };

  const retryFetch = () => {
    setRetryCount(0);
    setError(null);
    fetchReviews();
  };

  const fetchStats = async () => {
    try {
      // Get counts filtered by reviewType
      const [pendingResult, approvedResult] = await Promise.all([
        authenticatedReviewService.getPendingReviews(tenantId, {
          reviewType: activeReviewType === 'store' ? 'store' : 'product'
        }),
        reviewsService.getApprovedReviews(tenantId, {
          reviewType: activeReviewType === 'store' ? 'store' : 'product'
        })
      ]);

      const pendingCount = pendingResult?.reviews?.length || 0;
      const approvedCount = approvedResult?.reviews?.length || 0;
      const totalCount = pendingCount + approvedCount;

      setStats({
        totalReviews: totalCount,
        pendingReviews: pendingCount,
        approvedReviews: approvedCount,
        rejectedReviews: 0, // We don't track this yet
        averageRating: approvedResult?.summary?.rating_avg || 0
      });
    } catch (error) {
      clientLogger.error('Error fetching review stats:', { detail: error });
    }
  };

  const handleApprove = async (reviewId: string) => {
    setProcessingIds(prev => new Set(prev).add(reviewId));
    try {
      if (activeReviewType === 'store') {
        await authenticatedReviewService.approveReview(tenantId, reviewId);
      } else {
        // For product reviews, we need the productId
        const review = reviews.find(r => r.id === reviewId);
        if (review?.product_id) {
          await authenticatedReviewService.approveProductReview(review.product_id, reviewId);
        }
      }

      // Remove from local state and refresh
      setReviews(prev => prev.filter(review => review.id !== reviewId));
      setSelectedReviews(prev => {
        const newSet = new Set(prev);
        newSet.delete(reviewId);
        return newSet;
      });
      fetchStats();
    } catch (error) {
      clientLogger.error('Error approving review:', { detail: error });
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
      if (activeReviewType === 'store') {
        await authenticatedReviewService.rejectReview(tenantId, reviewId);
      } else {
        // For product reviews, we need the productId
        const review = reviews.find(r => r.id === reviewId);
        if (review?.product_id) {
          await authenticatedReviewService.rejectProductReview(review.product_id, reviewId);
        }
      }

      // Remove from local state and refresh
      setReviews(prev => prev.filter(review => review.id !== reviewId));
      setSelectedReviews(prev => {
        const newSet = new Set(prev);
        newSet.delete(reviewId);
        return newSet;
      });
      fetchStats();
    } catch (error) {
      clientLogger.error('Error rejecting review:', { detail: error });
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
      if (activeReviewType === 'store') {
        await authenticatedReviewService.bulkApproveReviews(tenantId, reviewIds);
      } else {
        // For product reviews, bulk operations would need to be handled differently
        // For now, we'll process them individually
        for (const reviewId of reviewIds) {
          const review = reviews.find(r => r.id === reviewId);
          if (review?.product_id) {
            await authenticatedReviewService.approveProductReview(review.product_id, reviewId);
          }
        }
      }

      // Remove from local state
      setReviews(prev => prev.filter(review => !selectedReviews.has(review.id)));
      setSelectedReviews(new Set());
      fetchStats();
    } catch (error) {
      clientLogger.error('Error bulk approving reviews:', { detail: error });
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
      if (activeReviewType === 'store') {
        await authenticatedReviewService.bulkRejectReviews(tenantId, reviewIds);
      } else {
        // For product reviews, bulk operations would need to be handled differently
        for (const reviewId of reviewIds) {
          const review = reviews.find(r => r.id === reviewId);
          if (review?.product_id) {
            await authenticatedReviewService.rejectProductReview(review.product_id, reviewId);
          }
        }
      }

      // Remove from local state
      setReviews(prev => prev.filter(review => !selectedReviews.has(review.id)));
      setSelectedReviews(new Set());
      fetchStats();
    } catch (error) {
      clientLogger.error('Error bulk rejecting reviews:', { detail: error });
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

  const selectAllReviews = () => {
    setSelectedReviews(new Set(reviews.map(review => review.id)));
  };

  const clearSelection = () => {
    setSelectedReviews(new Set());
  };

  const startResponding = (reviewId: string) => {
    setRespondingToReview(reviewId);
    setResponseText('');
  };

  const cancelResponse = () => {
    setRespondingToReview(null);
    setResponseText('');
  };

  const submitResponse = async (reviewId: string) => {
    if (!responseText.trim()) return;

    setSubmittingResponse(true);
    try {
      // TODO: Implement backend API call for review responses
      // For now, this is a placeholder that shows the functionality
      console.log('Submitting response for review:', reviewId, 'Response:', responseText);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For now, just update the local state to show the response
      setReviews(prev => prev.map(review =>
        review.id === reviewId
          ? { ...review, merchant_response: responseText, response_date: new Date().toISOString() }
          : review
      ));

      // Reset response state
      setRespondingToReview(null);
      setResponseText('');

    } catch (error) {
      clientLogger.error('Error submitting response:', { detail: error });
    } finally {
      setSubmittingResponse(false);
    }
  };

  const loadMoreReviews = async () => {
    if (loadingMore || !hasMoreReviews) return;

    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;

      // Fetch the next page
      let result;
      const paginationOptions = {
        limit: pageSize,
        offset: (nextPage - 1) * pageSize
      };

      if (activeReviewType === 'store') {
        if (activeStatus === 'pending') {
          result = await authenticatedReviewService.getPendingReviews(tenantId, {
            ...paginationOptions,
            reviewType: 'store'
          });
        } else if (activeStatus === 'approved') {
          result = await authenticatedReviewService.getApprovedReviews(tenantId, {
            limit: pageSize,
            page: nextPage
          });
        } else { // 'all'
          result = await authenticatedReviewService.getPendingReviews(tenantId, {
            ...paginationOptions,
            reviewType: 'store'
          });
        }
      } else {
        // For product reviews, implement when backend supports it
        result = { reviews: [], pagination: { total: 0, hasMore: false } };
      }

      if (result?.reviews && result.reviews.length > 0) {
        setReviews(prev => [...prev, ...result.reviews]);
        setCurrentPage(nextPage);
        setHasMoreReviews(result.pagination?.hasMore || false);
      } else {
        setHasMoreReviews(false);
      }

    } catch (error) {
      clientLogger.error('Error loading more reviews:', { detail: error });
    } finally {
      setLoadingMore(false);
    }
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
      <Grid>
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <Card shadow="sm" padding="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>
                  Pending Reviews
                </Text>
                <Text size="xl" fw="bold">
                  {stats?.pendingReviews || 0}
                </Text>
              </div>
              <Clock size={32} className="text-orange-500" />
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <Card shadow="sm" padding="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>
                  Approved Reviews
                </Text>
                <Text size="xl" fw="bold">
                  {stats?.approvedReviews || 0}
                </Text>
              </div>
              <CheckCircle size={32} className="text-green-500" />
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <Card shadow="sm" padding="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>
                  Total Reviews
                </Text>
                <Text size="xl" fw="bold">
                  {stats?.totalReviews || 0}
                </Text>
              </div>
              <MessageCircle size={32} className="text-blue-500" />
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <Card shadow="sm" padding="md" withBorder>
            <Group justify="space-between">
              <div>
                <Text size="sm" c="dimmed" fw={500}>
                  Average Rating
                </Text>
                <Text size="xl" fw="bold">
                  {stats?.averageRating ? Number(stats.averageRating).toFixed(1) : '0.0'}
                </Text>
              </div>
              <Star size={32} className="text-yellow-500" />
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Bulk Actions */}
      {selectedReviews.size > 0 && (
        <Card shadow="sm" padding="md" withBorder>
          <Group justify="space-between">
            <Group>
              <Text size="sm" c="dimmed">
                {selectedReviews.size} review{selectedReviews.size !== 1 ? 's' : ''} selected
              </Text>
              <Button
                variant="outline"
                size="compact-sm"
                onClick={clearSelection}
              >
                Clear Selection
              </Button>
            </Group>
            <Group>
              <Button
                variant="outline"
                size="compact-sm"
                onClick={handleBulkApprove}
                disabled={processingIds.size > 0}
                c="green"
              >
                <Check size={14} style={{ marginRight: '4px' }} />
                Approve All
              </Button>
              <Button
                variant="outline"
                size="compact-sm"
                onClick={handleBulkReject}
                disabled={processingIds.size > 0}
                c="red"
              >
                <X size={14} style={{ marginRight: '4px' }} />
                Reject All
              </Button>
            </Group>
          </Group>
        </Card>
      )}

      {/* Reviews List */}
      <Card shadow="sm" padding="md" withBorder>
        <Card.Section p="md" mb="md">
          <Group justify="space-between">
            <Group>
              <AlertTriangle size={20} className="text-orange-500" />
              <Text size="lg" fw={600}>
                {activeStatus === 'all' ? 'All ' :
                 activeStatus === 'pending' ? 'Pending ' :
                 'Approved '}
                {activeReviewType === 'store' ? 'Store ' : 'Product '}Reviews
                ({reviews.length}{totalReviews > pageSize ? ` of ${totalReviews}` : ''})
                {totalReviews > pageSize && (
                  <Text size="sm" c="dimmed" span>
                    Page {currentPage} of {Math.ceil(totalReviews / pageSize)}
                  </Text>
                )}
              </Text>
            </Group>
            {reviews.length > 0 && (
              <Button
                variant="outline"
                size="compact-sm"
                onClick={selectAllReviews}
                disabled={selectedReviews.size === reviews.length}
              >
                {selectedReviews.size === reviews.length ? (
                  <Group gap={4}>
                    <Check size={14} />
                    Deselect All
                  </Group>
                ) : (
                  <Group gap={4}>
                    <CheckSquare size={14} />
                    Select All
                  </Group>
                )}
              </Button>
            )}
          </Group>
        </Card.Section>

        <Card.Section p="md">
          {/* Tabs for Review Types */}
          <Tabs value={activeReviewType} onChange={(value) => setActiveReviewType(value as ReviewType)} mb="md">
            <Tabs.List>
              <Tabs.Tab value="store">Store Reviews</Tabs.Tab>
              <Tabs.Tab value="product">Product Reviews</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {/* Status Filter Tabs */}
          <Tabs value={activeStatus} onChange={(value) => setActiveStatus(value as ReviewStatus)} mb="md">
            <Tabs.List>
              <Tabs.Tab value="all">All Reviews ({stats?.totalReviews || 0})</Tabs.Tab>
              <Tabs.Tab value="pending">Pending ({stats?.pendingReviews || 0})</Tabs.Tab>
              <Tabs.Tab value="approved">Approved ({stats?.approvedReviews || 0})</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {/* Search and Filter Controls */}
          <Card p="md" mb="md" withBorder bg="gray.0">
            <Grid>
              <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                <TextInput
                  placeholder="Search by customer name or email..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.currentTarget.value)}
                  leftSection={<User size={16} />}
                />
              </Grid.Col>

              {/* Rating Filter */}
              <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                <MultiSelect
                  placeholder="Filter by rating"
                  data={[
                    { value: '5', label: '⭐⭐⭐⭐⭐ 5 Stars' },
                    { value: '4', label: '⭐⭐⭐⭐ 4 Stars' },
                    { value: '3', label: '⭐⭐⭐ 3 Stars' },
                    { value: '2', label: '⭐⭐ 2 Stars' },
                    { value: '1', label: '⭐ 1 Star' }
                  ]}
                  value={ratingFilter}
                  onChange={setRatingFilter}
                  clearable
                />
              </Grid.Col>

              {/* Date Range */}
              <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                <DatePickerInput
                  type="range"
                  placeholder="Filter by date range"
                  value={dateRange}
                  onChange={setDateRange}
                />
              </Grid.Col>

              {/* Sort Options */}
              <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
                <Select
                  placeholder="Sort by"
                  data={[
                    { value: 'newest', label: 'Newest First' },
                    { value: 'oldest', label: 'Oldest First' },
                    { value: 'rating_high', label: 'Highest Rating' },
                    { value: 'rating_low', label: 'Lowest Rating' },
                    { value: 'helpful', label: 'Most Helpful' }
                  ]}
                  value={sortBy}
                  onChange={(value) => setSortBy(value as any)}
                />
              </Grid.Col>
            </Grid>

            {/* Active Filters Summary */}
            {(searchQuery || ratingFilter.length > 0 || dateRange[0] || dateRange[1]) && (
              <Group mt="md" gap="sm" wrap="wrap">
                <Text size="sm" c="dimmed">Active filters:</Text>
                {searchQuery && (
                  <Badge variant="light" size="sm" color="blue">
                    Search: "{searchQuery}"
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      onClick={() => setSearchQuery('')}
                      ml={4}
                    >
                      ×
                    </Button>
                  </Badge>
                )}
                {ratingFilter.map(rating => (
                  <Badge key={rating} variant="light" size="sm" color="yellow">
                    {rating} ⭐
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      onClick={() => setRatingFilter(prev => prev.filter(r => r !== rating))}
                      ml={4}
                    >
                      ×
                    </Button>
                  </Badge>
                ))}
                {dateRange[0] && (
                  <Badge variant="light" size="sm" color="green">
                    From: {dateRange[0] ? new Date(dateRange[0]).toLocaleDateString() : ''}
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      onClick={() => setDateRange([null, dateRange[1]])}
                      ml={4}
                    >
                      ×
                    </Button>
                  </Badge>
                )}
                {dateRange[1] && (
                  <Badge variant="light" size="sm" color="green">
                    To: {dateRange[1] ? new Date(dateRange[1]).toLocaleDateString() : ''}
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      onClick={() => setDateRange([dateRange[0], null])}
                      ml={4}
                    >
                      ×
                    </Button>
                  </Badge>
                )}
                <Button
                  variant="subtle"
                  size="compact-xs"
                  onClick={() => {
                    setSearchQuery('');
                    setRatingFilter([]);
                    setDateRange([null, null]);
                    setSortBy('newest');
                  }}
                >
                  Clear All
                </Button>
              </Group>
            )}
          </Card>

          {loading ? (
            <Stack align="center" py="xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <Text c="dimmed">Loading reviews...</Text>
              {retryCount > 0 && (
                <Text size="xs" c="dimmed">Retrying... ({retryCount}/{MAX_RETRIES})</Text>
              )}
            </Stack>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Failed to load reviews
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {error}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={retryFetch}
                  leftSection={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>}
                >
                  Try Again
                </Button>
                <Button
                  variant="subtle"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </div>
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
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          {renderStars(review.rating)}
                          <Badge variant="light" size="sm">
                            {review.rating}/5
                          </Badge>
                          {review.product_id ? (
                            <Badge variant="outline" size="sm" color="blue">
                              📦 Product
                            </Badge>
                          ) : (
                            <Badge variant="outline" size="sm" color="green">
                              🏪 Store
                            </Badge>
                          )}
                          {review.verified_purchase && (
                            <Badge variant="outline" size="sm" color="green">
                              Verified Purchase
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {review.first_name && review.last_name ? 
                              `${review.first_name} ${review.last_name}` : 
                              'User'
                            }
                          </div>
                          {review.email && (
                            <div className="flex items-center">
                              <Mail className="w-4 h-4 mr-1" />
                              {review.email}
                            </div>
                          )}
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(review.created_at)}
                          </div>
                        </div>

                        {/* Product Information */}
                        {review.product_id && (review.product_name || review.product_title) && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start space-x-3">
                              {review.image_url && (
                                <img
                                  src={review.image_url}
                                  alt={review.product_name || review.product_title}
                                  className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Package className="w-4 h-4 text-blue-600" />
                                  {review.product_url ? (
                                    <a 
                                      href={review.product_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate hover:text-blue-700 dark:hover:text-blue-300 underline"
                                    >
                                      {review.product_name || review.product_title}
                                    </a>
                                  ) : (
                                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">
                                      {review.product_name || review.product_title}
                                    </h4>
                                  )}
                                </div>
                                {review.product_category && (
                                  <div className="flex items-center space-x-2 text-xs text-blue-700 dark:text-blue-300">
                                    <span>{review.product_category}</span>
                                    {review.brand && (
                                      <>
                                        <span>•</span>
                                        <span>{review.brand}</span>
                                      </>
                                    )}
                                    {review.price && (
                                      <>
                                        <span>•</span>
                                        <span className="font-medium">{review.price} {review.currency}</span>
                                      </>
                                    )}
                                  </div>
                                )}
                                {review.product_description && (
                                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 line-clamp-2">
                                    {review.product_description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
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

                  {review.review_text && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                      <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                        {review.review_text}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        {review.helpful_count} helpful
                      </span>
                    </div>
                    <span>Review ID: {review.id.slice(-8)}</span>
                  </div>

                  {/* Review Response Section */}
                  {(review as any).merchant_response && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-400">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          Merchant Response
                        </span>
                        {(review as any).response_date && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            {new Date((review as any).response_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {(review as any).merchant_response}
                      </p>
                    </div>
                  )}

                  {/* Response Input */}
                  {respondingToReview === review.id && (
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          Respond to this review
                        </span>
                      </div>
                      <Textarea
                        placeholder="Write your response to this customer review..."
                        value={responseText}
                        onChange={(event) => setResponseText(event.currentTarget.value)}
                        minRows={3}
                        maxRows={6}
                        className="mb-3"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="xs"
                          color="blue"
                          onClick={() => submitResponse(review.id)}
                          loading={submittingResponse}
                          disabled={!responseText.trim()}
                        >
                          Submit Response
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={cancelResponse}
                          disabled={submittingResponse}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Response Button */}
                  {activeStatus === 'approved' && !(review as any).merchant_response && respondingToReview !== review.id && (
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => startResponding(review.id)}
                        leftSection={<MessageCircle className="w-4 h-4" />}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                      >
                        Respond to Review
                      </Button>
                    </div>
                  )}
               
                </div>
              ))}

            {/* Pagination Controls */}
            {totalReviews > reviews.length && (
              <div className="mt-6 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Showing {reviews.length} of {totalReviews} reviews
                </div>
                <div className="flex items-center space-x-2">
                  {hasMoreReviews ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMoreReviews}
                      loading={loadingMore}
                      className="text-blue-600 border-blue-600 hover:bg-blue-50"
                    >
                      {loadingMore ? 'Loading...' : 'Load More Reviews'}
                    </Button>
                  ) : (
                    <span className="text-sm text-gray-500">All reviews loaded</span>
                  )}
                </div>
              </div>
            )}
            </div>
          )}
        </Card.Section>
      </Card>
    </div>
  );
}
