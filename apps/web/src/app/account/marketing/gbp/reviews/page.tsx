'use client';

import { useEffect, useState, useCallback } from 'react';
import { Star, RefreshCw, AlertCircle, Filter, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import marketingCustomerService, {
  GbpReview,
  GbpReviewsListResponse,
} from '@/services/MarketingCustomerService';
import { ReviewCard } from './ReviewCard';
import { AiDraftPicker } from './AiDraftPicker';

export default function GbpReviewsPage() {
  const [data, setData] = useState<GbpReviewsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterRating, setFilterRating] = useState<number | undefined>(undefined);
  const [filterSentiment, setFilterSentiment] = useState<string | undefined>(undefined);
  const [filterReplyStatus, setFilterReplyStatus] = useState<string | undefined>(undefined);
  const [draftPickerReview, setDraftPickerReview] = useState<GbpReview | null>(null);
  const [replyingTo, setReplyingTo] = useState<GbpReview | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      const result = await marketingCustomerService.listReviews({
        page,
        pageSize: 20,
        rating: filterRating,
        sentiment: filterSentiment as any,
        replyStatus: filterReplyStatus as any,
      });
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [page, filterRating, filterSentiment, filterReplyStatus]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleReplyPublished = async () => {
    setReplyingTo(null);
    await loadReviews();
  };

  const handleDraftsGenerated = async () => {
    setDraftPickerReview(null);
    await loadReviews();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            {error}
            <button
              onClick={() => { setError(null); loadReviews(); }}
              className="ml-2 underline text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your Google Business Profile reviews</p>
        </div>
        <button
          onClick={loadReviews}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Star Rating</label>
            <select
              value={filterRating ?? ''}
              onChange={(e) => { setFilterRating(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All</option>
              <option value="5">5 ★</option>
              <option value="4">4 ★</option>
              <option value="3">3 ★</option>
              <option value="2">2 ★</option>
              <option value="1">1 ★</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Sentiment</label>
            <select
              value={filterSentiment ?? ''}
              onChange={(e) => { setFilterSentiment(e.target.value || undefined); setPage(1); }}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Reply Status</label>
            <select
              value={filterReplyStatus ?? ''}
              onChange={(e) => { setFilterReplyStatus(e.target.value || undefined); setPage(1); }}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All</option>
              <option value="NONE">No reply</option>
              <option value="AI_DRAFTED">AI drafted</option>
              <option value="PUBLISHED">Published</option>
              <option value="DISPUTED">Disputed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {data && data.reviews.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No reviews found. Reviews will appear here once your GBP location is verified and the ingestion job runs.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onGenerateDrafts={() => setDraftPickerReview(review)}
              onReply={() => setReplyingTo(review)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {data.pagination.totalPages} ({data.pagination.total} reviews)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page >= data.pagination.totalPages}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* AI Draft Picker Modal */}
      {draftPickerReview && (
        <AiDraftPicker
          review={draftPickerReview}
          onClose={() => setDraftPickerReview(null)}
          onDraftsGenerated={handleDraftsGenerated}
          onReplyPublished={handleReplyPublished}
        />
      )}
    </div>
  );
}
