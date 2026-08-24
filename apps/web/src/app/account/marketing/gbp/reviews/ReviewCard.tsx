'use client';

import { Star, MessageSquare, Sparkles, Reply, Flag } from 'lucide-react';
import type { GbpReview } from '@/services/MarketingCustomerService';

interface ReviewCardProps {
  review: GbpReview;
  onGenerateDrafts: () => void;
  onReply: () => void;
}

const sentimentColors: Record<string, string> = {
  positive: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  negative: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const replyStatusColors: Record<string, string> = {
  NONE: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  AI_DRAFTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  DISPUTED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

const replyStatusLabels: Record<string, string> = {
  NONE: 'No reply',
  AI_DRAFTED: 'AI drafted',
  PUBLISHED: 'Published',
  FAILED: 'Failed',
  DISPUTED: 'Disputed',
};

export function ReviewCard({ review, onGenerateDrafts, onReply }: ReviewCardProps) {
  const rating = review.star_rating ?? 0;
  const sentiment = review.sentiment;
  const replyStatus = review.reply_status || 'NONE';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      {/* Header: reviewer + rating + date */}
      <div className="flex items-start gap-3 mb-3">
        {review.reviewer_photo_url ? (
          <img
            src={review.reviewer_photo_url}
            alt={review.reviewer_name || 'Reviewer'}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 text-sm font-medium">
            {(review.reviewer_name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {review.reviewer_name || 'Anonymous'}
            </p>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    star <= rating
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
              ))}
            </div>
            {sentiment && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sentimentColors[sentiment] || sentimentColors.neutral}`}>
                {sentiment}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${replyStatusColors[replyStatus] || replyStatusColors.NONE}`}>
              {replyStatusLabels[replyStatus] || replyStatus}
            </span>
          </div>
          {review.google_create_time && (
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(review.google_create_time).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
          {review.comment}
        </p>
      )}

      {/* Existing Reply */}
      {review.review_reply && (
        <div className="mt-3 pl-4 border-l-2 border-blue-200 dark:border-blue-700">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Your reply</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{review.review_reply}</p>
        </div>
      )}

      {/* AI Drafts Indicator */}
      {review.ai_drafts && Array.isArray(review.ai_drafts) && review.ai_drafts.length > 0 && review.reply_status === 'AI_DRAFTED' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{review.ai_drafts.length} AI drafts ready — click "AI Drafts" to review</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {replyStatus !== 'PUBLISHED' && replyStatus !== 'DISPUTED' && (
          <>
            <button
              onClick={onGenerateDrafts}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              AI Drafts
            </button>
            <button
              onClick={onReply}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <Reply className="w-4 h-4" />
              Reply
            </button>
          </>
        )}
        {replyStatus !== 'DISPUTED' && replyStatus !== 'PUBLISHED' && (
          <button
            onClick={onReply}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/30 transition-colors"
          >
            <Flag className="w-4 h-4" />
            Dispute
          </button>
        )}
      </div>
    </div>
  );
}
