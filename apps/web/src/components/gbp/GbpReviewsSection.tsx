'use client';

import { useEffect, useState } from 'react';
import { Star, MessageSquare } from 'lucide-react';

interface GbpReview {
  id: string;
  reviewerName: string;
  starRating: number;
  comment: string | null;
  reviewReply: string | null;
  createTime: string | null;
}

interface GbpReviewsData {
  enabled: boolean;
  aggregateRating: number | null;
  totalReviewCount: number;
  businessName: string | null;
  reviews: GbpReview[];
}

interface GbpReviewsSectionProps {
  slug: string;
}

export function GbpReviewsSection({ slug }: GbpReviewsSectionProps) {
  const [data, setData] = useState<GbpReviewsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/directory/${encodeURIComponent(slug)}/gbp-reviews`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setData(json.data);
        }
      } catch {
        // Silent fail — component renders nothing
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading || !data || !data.enabled || data.reviews.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Reviews
        </h2>
        <span className="text-xs text-gray-400 ml-1">from Google</span>
      </div>

      {/* Aggregate Rating Badge */}
      {data.aggregateRating !== null && (
        <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 ${
                  star <= Math.round(data.aggregateRating!)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            ))}
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {data.aggregateRating!.toFixed(1)}
          </span>
          <span className="text-sm text-gray-500">
            ({data.totalReviewCount} review{data.totalReviewCount !== 1 ? 's' : ''})
          </span>
        </div>
      )}

      {/* Review List */}
      <div className="space-y-3">
        {data.reviews.slice(0, 10).map((review) => (
          <div key={review.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-400">
                  {review.reviewerName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{review.reviewerName}</span>
              </div>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3.5 h-3.5 ${
                      star <= review.starRating
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  />
                ))}
              </div>
            </div>
            {review.comment && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{review.comment}</p>
            )}
            {review.reviewReply && (
              <div className="mt-2 pl-3 border-l-2 border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 mb-1">Response from {data.businessName || 'the owner'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{review.reviewReply}</p>
              </div>
            )}
            {review.createTime && (
              <p className="text-xs text-gray-400 mt-2">{new Date(review.createTime).toLocaleDateString()}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
