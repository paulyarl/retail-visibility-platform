'use client';

import { useState, useEffect } from 'react';
import { shopsService, type Shop, type ShopReview } from '@/services/ShopsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@mantine/core';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { 
  Star, 
  ThumbsUp, 
  MessageCircle, 
  Filter,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';
import Image from 'next/image';

interface ShopReviewsProps {
  shop: Shop;
}

export default function ShopReviews({ shop }: ShopReviewsProps) {
  const [reviews, setReviews] = useState<ShopReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);
  const [filter, setFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'helpful' | 'rating-high' | 'rating-low'>('recent');

  const reviewsPerPage = 10;

  useEffect(() => {
    fetchReviews();
  }, [page, filter, sortBy, shop.tenantId]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const result = await shopsService.getShopReviews(shop.tenantId, page, reviewsPerPage, filter, sortBy);
      setReviews(result.reviews);
      setTotalReviews(result.total);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
      setTotalReviews(0);
    } finally {
      setLoading(false);
    }
  };

  const handleHelpful = async (reviewId: string) => {
    const success = await shopsService.markReviewHelpful(reviewId);
    if (success) {
      setReviews(prev => prev.map(review => 
        review.id === reviewId 
          ? { ...review, helpful: review.helpful + 1 }
          : review
      ));
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating 
                ? 'text-yellow-500 fill-current' 
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const getRatingDistribution = () => {
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      distribution[review.rating as keyof typeof distribution]++;
    });
    
    return Object.entries(distribution).map(([rating, count]) => ({
      rating: parseInt(rating),
      count,
      percentage: totalReviews > 0 ? (count / totalReviews) * 100 : 0,
    }));
  };

  const totalPages = Math.ceil(totalReviews / reviewsPerPage);

  if (loading && page === 1) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 mt-1" />
                </div>
              </div>
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Rating */}
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {shop.rating ? shop.rating.toFixed(1) : '0.0'}
              </div>
              {renderStars(shop.rating || 0)}
              <p className="text-gray-600 mt-2">
                Based on {shop.reviewCount || 0} reviews
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-2">
              {getRatingDistribution().map(({ rating, count, percentage }) => (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm">{rating}</span>
                    <Star className="w-3 h-3 text-yellow-500 fill-current" />
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-yellow-500 h-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Sorting */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">Filter:</span>
              <div className="flex gap-1">
                {(['all', '5', '4', '3', '2', '1'] as const).map((rating) => (
                  <Button
                    key={rating}
                    variant={filter === rating ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(rating)}
                  >
                    {rating === 'all' ? 'All' : `${rating}★`}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sort:</span>
              <div className="flex gap-1">
                <Button
                  variant={sortBy === 'recent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('recent')}
                >
                  Recent
                </Button>
                <Button
                  variant={sortBy === 'helpful' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('helpful')}
                >
                  Helpful
                </Button>
                <Button
                  variant={sortBy === 'rating-high' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('rating-high')}
                >
                  Rating High
                </Button>
                <Button
                  variant={sortBy === 'rating-low' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('rating-low')}
                >
                  Rating Low
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No reviews yet</h3>
            <p className="text-gray-600">
              Be the first to review this shop!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* User Avatar */}
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    {review.userAvatar ? (
                      <Image
                        src={review.userAvatar}
                        alt={review.userName}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    ) : (
                      <User className="w-5 h-5 text-gray-500" />
                    )}
                  </div>

                  {/* Review Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {review.userName}
                      </h4>
                      {review.verified && (
                        <Badge variant="default" className="text-xs">
                          Verified Purchase
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      {renderStars(review.rating, 'sm')}
                      <span className="text-sm text-gray-500">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {review.title && (
                      <h5 className="font-medium text-gray-900 mb-2">
                        {review.title}
                      </h5>
                    )}

                    <p className="text-gray-700 mb-4">
                      {review.content}
                    </p>

                    {/* Shop Response */}
                    {review.response && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm">Shop Response</span>
                          <span className="text-xs text-gray-500">
                            {new Date(review.response.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {review.response.content}
                        </p>
                      </div>
                    )}

                    {/* Helpful Button */}
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleHelpful(review.id)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <ThumbsUp className="w-4 h-4 mr-1" />
                        Helpful ({review.helpful})
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          <div className="flex gap-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const pageNum = i + 1;
              const isActive = pageNum === page;
              return (
                <Button
                  key={pageNum}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
