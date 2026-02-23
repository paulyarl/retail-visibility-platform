/**
 * Product Reviews System with Mantine UI
 * 
 * Comprehensive reviews and ratings system with filtering, sorting, and submission
 * Uses Mantine components for professional review interface
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Rating,
  Avatar,
  Badge,
  Button,
  Textarea,
  Select,
  Pagination,
  Modal,
  Divider,
  Progress,
  Alert,
  Tooltip,
  ActionIcon,
  NumberInput
} from '@mantine/core';
import {
  IconStar,
  IconMessageCircle,
  IconThumbUp,
  IconThumbDown,
  IconFilter,
  IconSortDescending,
  IconEdit,
  IconFlag,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  verified: boolean;
  helpful: number;
  notHelpful: number;
  createdAt: Date;
  updatedAt?: Date;
  variant?: string;
  images?: string[];
  response?: {
    content: string;
    from: string;
    createdAt: Date;
  };
}

interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  verifiedPurchasePercentage: number;
  wouldRecommendPercentage: number;
}

interface ProductReviewsSystemProps {
  productId: string;
  className?: string;
}

const ProductReviewsSystem: React.FC<ProductReviewsSystemProps> = ({
  productId,
  className = ''
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [writeReviewModalOpen, setWriteReviewModalOpen] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 0,
    title: '',
    content: '',
    variant: ''
  });
  const [filterRating, setFilterRating] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('most_recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [userVote, setUserVote] = useState<Record<string, 'helpful' | 'notHelpful'>>({});

  const reviewsPerPage = 10;

  // Mock data - in production, this would come from API
  useEffect(() => {
    const mockReviews: Review[] = [
      {
        id: '1',
        userId: 'user1',
        userName: 'John Doe',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=john',
        rating: 5,
        title: 'Excellent Product!',
        content: 'This product exceeded my expectations. The quality is outstanding and the shipping was fast.',
        verified: true,
        helpful: 12,
        notHelpful: 1,
        createdAt: new Date('2024-01-15'),
        images: ['https://via.placeholder.com/300x200']
      },
      {
        id: '2',
        userId: 'user2',
        userName: 'Jane Smith',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane',
        rating: 4,
        title: 'Good value for money',
        content: 'Overall satisfied with the purchase. Minor issues with packaging but product itself is great.',
        verified: true,
        helpful: 8,
        notHelpful: 2,
        createdAt: new Date('2024-01-10'),
        variant: 'Large - Blue'
      },
      {
        id: '3',
        userId: 'user3',
        userName: 'Mike Johnson',
        rating: 3,
        title: 'Average experience',
        content: 'Product is okay but nothing special. Price could be better for what you get.',
        verified: false,
        helpful: 5,
        notHelpful: 3,
        createdAt: new Date('2024-01-05')
      }
    ];

    const mockStats: ReviewStats = {
      averageRating: 4.2,
      totalReviews: 127,
      ratingDistribution: {
        5: 68,
        4: 32,
        3: 15,
        2: 8,
        1: 4
      },
      verifiedPurchasePercentage: 87,
      wouldRecommendPercentage: 92
    };

    setTimeout(() => {
      setReviews(mockReviews);
      setReviewStats(mockStats);
      setLoading(false);
    }, 1000);
  }, [productId]);

  const handleVote = (reviewId: string, voteType: 'helpful' | 'notHelpful') => {
    if (userVote[reviewId]) {
      notifications.show({
        title: 'Already Voted',
        message: 'You have already voted on this review',
        color: 'yellow',
      });
      return;
    }

    setUserVote(prev => ({ ...prev, [reviewId]: voteType }));
    setReviews(prev => prev.map(review => 
      review.id === reviewId 
        ? { 
            ...review, 
            helpful: voteType === 'helpful' ? review.helpful + 1 : review.helpful,
            notHelpful: voteType === 'notHelpful' ? review.notHelpful + 1 : review.notHelpful
          }
        : review
    ));

    notifications.show({
      title: 'Vote Recorded',
      message: 'Thank you for your feedback',
      color: 'green',
    });
  };

  const handleSubmitReview = () => {
    if (!newReview.rating || !newReview.title || !newReview.content) {
      notifications.show({
        title: 'Missing Information',
        message: 'Please fill in all required fields',
        color: 'red',
      });
      return;
    }

    const review: Review = {
      id: Date.now().toString(),
      userId: 'current-user',
      userName: 'Current User',
      rating: newReview.rating,
      title: newReview.title,
      content: newReview.content,
      verified: true,
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date(),
      variant: newReview.variant || undefined
    };

    setReviews(prev => [review, ...prev]);
    setWriteReviewModalOpen(false);
    setNewReview({ rating: 0, title: '', content: '', variant: '' });

    notifications.show({
      title: 'Review Submitted',
      message: 'Thank you for your review!',
      color: 'green',
    });
  };

  const filteredAndSortedReviews = reviews
    .filter(review => !filterRating || review.rating === parseInt(filterRating))
    .sort((a, b) => {
      switch (sortBy) {
        case 'most_recent':
          return b.createdAt.getTime() - a.createdAt.getTime();
        case 'oldest':
          return a.createdAt.getTime() - b.createdAt.getTime();
        case 'highest_rating':
          return b.rating - a.rating;
        case 'lowest_rating':
          return a.rating - b.rating;
        case 'most_helpful':
          return b.helpful - a.helpful;
        default:
          return 0;
      }
    });

  const paginatedReviews = filteredAndSortedReviews.slice(
    (currentPage - 1) * reviewsPerPage,
    currentPage * reviewsPerPage
  );

  const totalPages = Math.ceil(filteredAndSortedReviews.length / reviewsPerPage);

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Review Summary */}
      {reviewStats && (
        <Card className="p-6">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <div>
                <Group gap="xs" align="center">
                  <Text size="xl" fw={600}>
                    {reviewStats.averageRating.toFixed(1)}
                  </Text>
                  <Rating value={reviewStats.averageRating} fractions={2} readOnly />
                  <Text size="lg" c="dimmed">
                    ({reviewStats.totalReviews} reviews)
                  </Text>
                </Group>
                <Text size="sm" c="dimmed" mt="xs">
                  {reviewStats.verifiedPurchasePercentage}% verified purchases
                </Text>
              </div>
              
              <div className="text-right">
                <Text size="sm" c="dimmed">
                  {reviewStats.wouldRecommendPercentage}% would recommend
                </Text>
                <Button
                  mt="sm"
                  onClick={() => setWriteReviewModalOpen(true)}
                  leftSection={<IconEdit size={16} />}
                >
                  Write a Review
                </Button>
              </div>
            </Group>

            {/* Rating Distribution */}
            <Stack gap="xs">
              {[5, 4, 3, 2, 1].map(rating => {
                const count = reviewStats.ratingDistribution[rating];
                const percentage = (count / reviewStats.totalReviews) * 100;
                
                return (
                  <Group key={rating} gap="sm" align="center">
                    <Group gap="xs">
                      <Text size="sm">{rating}</Text>
                      <IconStar size={14} className="text-yellow-500" />
                    </Group>
                    <Progress
                      value={percentage}
                      color="yellow"
                      size="sm"
                      style={{ flex: 1 }}
                    />
                    <Text size="sm" w={50} ta="right">
                      {count}
                    </Text>
                  </Group>
                );
              })}
            </Stack>
          </Stack>
        </Card>
      )}

      {/* Filters and Sorting */}
      <Card className="p-4">
        <Group justify="space-between">
          <Group>
            <Select
              placeholder="Filter by rating"
              data={[
                { value: '', label: 'All Ratings' },
                { value: '5', label: '5 Stars' },
                { value: '4', label: '4 Stars' },
                { value: '3', label: '3 Stars' },
                { value: '2', label: '2 Stars' },
                { value: '1', label: '1 Star' }
              ]}
              value={filterRating}
              onChange={(value) => setFilterRating(value || '')}
              leftSection={<IconFilter size={16} />}
              w={150}
            />
            
            <Select
              placeholder="Sort by"
              data={[
                { value: 'most_recent', label: 'Most Recent' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'highest_rating', label: 'Highest Rating' },
                { value: 'lowest_rating', label: 'Lowest Rating' },
                { value: 'most_helpful', label: 'Most Helpful' }
              ]}
              value={sortBy}
              onChange={(value) => setSortBy(value || '')}
              leftSection={<IconSortDescending size={16} />}
              w={150}
            />
          </Group>
          
          <Text size="sm" c="dimmed">
            {filteredAndSortedReviews.length} reviews
          </Text>
        </Group>
      </Card>

      {/* Reviews List */}
      <Stack gap="md">
        {paginatedReviews.map(review => (
          <Card key={review.id} className="p-6" withBorder>
            <Stack gap="md">
              {/* Review Header */}
              <Group justify="space-between" align="flex-start">
                <Group gap="sm">
                  <Avatar src={review.userAvatar} size="md">
                    {review.userName.charAt(0)}
                  </Avatar>
                  <div>
                    <Group gap="xs" align="center">
                      <Text fw={500}>{review.userName}</Text>
                      {review.verified && (
                        <Tooltip label="Verified Purchase">
                          <IconCheck size={14} className="text-blue-500" />
                        </Tooltip>
                      )}
                    </Group>
                    <Group gap="xs" align="center">
                      <Rating value={review.rating} fractions={2} readOnly size="sm" />
                      <Text size="sm" c="dimmed">
                        {review.createdAt.toLocaleDateString()}
                      </Text>
                    </Group>
                  </div>
                </Group>
                
                <ActionIcon variant="subtle" size="sm">
                  <IconFlag size={14} />
                </ActionIcon>
              </Group>

              {/* Review Content */}
              <div>
                <Text fw={500} mb="xs">{review.title}</Text>
                <Text size="sm">{review.content}</Text>
                
                {review.variant && (
                  <Badge size="sm" variant="light" mt="sm">
                    {review.variant}
                  </Badge>
                )}
              </div>

              {/* Review Images */}
              {review.images && review.images.length > 0 && (
                <Group gap="xs">
                  {review.images.map((image, index) => (
                    <div key={index} className="w-20 h-20 rounded overflow-hidden">
                      <img
                        src={image}
                        alt={`Review image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </Group>
              )}

              {/* Store Response */}
              {review.response && (
                <Alert color="blue" variant="light">
                  <Text size="sm" fw={500} mb="xs">
                    Response from {review.response.from}
                  </Text>
                  <Text size="sm">{review.response.content}</Text>
                  <Text size="xs" c="dimmed" mt="xs">
                    {review.response.createdAt.toLocaleDateString()}
                  </Text>
                </Alert>
              )}

              {/* Helpful Votes */}
              <Group gap="sm" align="center">
                <Text size="sm" c="dimmed">Was this helpful?</Text>
                <Button
                  variant={userVote[review.id] === 'helpful' ? 'filled' : 'light'}
                  size="sm"
                  leftSection={<IconThumbUp size={14} />}
                  onClick={() => handleVote(review.id, 'helpful')}
                >
                  Helpful ({review.helpful})
                </Button>
                <Button
                  variant={userVote[review.id] === 'notHelpful' ? 'filled' : 'light'}
                  size="sm"
                  leftSection={<IconThumbDown size={14} />}
                  onClick={() => handleVote(review.id, 'notHelpful')}
                >
                  Not Helpful ({review.notHelpful})
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </Stack>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={setCurrentPage}
          mt="xl"
        />
      )}

      {/* Write Review Modal */}
      <Modal
        opened={writeReviewModalOpen}
        onClose={() => setWriteReviewModalOpen(false)}
        title="Write a Review"
        size="md"
      >
        <Stack gap="md">
          <div>
            <Text mb="xs">Rating *</Text>
            <Rating
              value={newReview.rating}
              onChange={setRating => setNewReview(prev => ({ ...prev, rating: setRating }))}
              size="lg"
            />
          </div>

          <Textarea
            label="Title *"
            placeholder="Summarize your experience"
            value={newReview.title}
            onChange={(e) => setNewReview(prev => ({ ...prev, title: e.target.value }))}
            required
            maxLength={100}
          />

          <Textarea
            label="Review *"
            placeholder="Tell us about your experience with this product"
            value={newReview.content}
            onChange={(e) => setNewReview(prev => ({ ...prev, content: e.target.value }))}
            required
            minRows={4}
            maxLength={1000}
          />

          <Select
            label="Product Variant (Optional)"
            placeholder="Select variant if applicable"
            data={[
              { value: '', label: 'No variant' },
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' }
            ]}
            value={newReview.variant}
            onChange={(value) => setNewReview(prev => ({ ...prev, variant: value || '' }))}
          />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="outline"
              onClick={() => setWriteReviewModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={!newReview.rating || !newReview.title || !newReview.content}
            >
              Submit Review
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
};

export default ProductReviewsSystem;
