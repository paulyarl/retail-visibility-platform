'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { api } from '@/lib/api';

interface ProductRatingBadgeProps {
  productId: string;
  tenantId: string;
  size?: 'sm' | 'md';
  showCount?: boolean;
}

export default function ProductRatingBadge({ productId, tenantId, size = 'sm', showCount = true }: ProductRatingBadgeProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRating = async () => {
      try {
        const response = await api.get(`/api/stores/${tenantId}/products/${productId}/reviews/summary`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setRating(data.data.rating_avg);
            setCount(data.data.rating_count);
          }
        }
      } catch (error) {
        console.error('Error fetching product rating:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRating();
  }, [productId, tenantId]);

  if (loading || !rating || rating === 0) {
    return null; // Don't show anything if loading or no ratings
  }

  const starSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
      <span className={`${textSize} font-medium text-gray-900 dark:text-white`}>
        {rating.toFixed(1)}
      </span>
      {showCount && count > 0 && (
        <span className={`${textSize} text-gray-500 dark:text-gray-400`}>
          ({count})
        </span>
      )}
    </div>
  );
}
