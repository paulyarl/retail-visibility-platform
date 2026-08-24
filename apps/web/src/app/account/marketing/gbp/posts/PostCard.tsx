'use client';

import { Calendar, Tag, Zap, Trash2, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { GbpPost } from '@/services/MarketingCustomerService';

interface PostCardProps {
  post: GbpPost;
  onDelete: () => void;
}

const topicTypeLabels: Record<string, string> = {
  STANDARD: "What's New",
  EVENT: 'Event',
  OFFER: 'Offer',
};

const topicTypeIcons: Record<string, any> = {
  STANDARD: Zap,
  EVENT: Calendar,
  OFFER: Tag,
};

const statusColors: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const statusIcons: Record<string, any> = {
  PUBLISHED: CheckCircle,
  SCHEDULED: Clock,
  FAILED: XCircle,
};

export function PostCard({ post, onDelete }: PostCardProps) {
  const topicType = post.topic_type || 'STANDARD';
  const TopicIcon = topicTypeIcons[topicType] || Zap;
  const StatusIcon = statusIcons[post.status] || Clock;

  const handleDelete = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await marketingCustomerService.deletePost(post.id);
      onDelete();
    } catch (err: any) {
      alert(err.message || 'Failed to delete post');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            <TopicIcon className="w-3 h-3" />
            {topicTypeLabels[topicType] || topicType}
          </span>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[post.status] || statusColors.SCHEDULED}`}>
            <StatusIcon className="w-3 h-3" />
            {post.status}
          </span>
        </div>
        <button
          onClick={handleDelete}
          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
          title="Delete post"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap line-clamp-4">
        {post.summary}
      </p>

      {/* Event details */}
      {topicType === 'EVENT' && post.event_title && (
        <div className="text-xs text-gray-500 mb-2">
          <p className="font-medium text-gray-700 dark:text-gray-300">{post.event_title}</p>
          {post.event_start_date && (
            <p>{new Date(post.event_start_date).toLocaleDateString()} {post.event_end_date && `– ${new Date(post.event_end_date).toLocaleDateString()}`}</p>
          )}
        </div>
      )}

      {/* Offer details */}
      {topicType === 'OFFER' && (post.offer_coupon_code || post.offer_redeem_url) && (
        <div className="text-xs text-gray-500 mb-2">
          {post.offer_coupon_code && <p>Code: <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{post.offer_coupon_code}</span></p>}
          {post.offer_redeem_url && <a href={post.offer_redeem_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Redeem link →</a>}
        </div>
      )}

      {/* CTA */}
      {post.call_to_action_url && (
        <a href={post.call_to_action_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
          {post.call_to_action_type || 'Learn more'} →
        </a>
      )}

      {/* Dates */}
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 flex items-center gap-4">
        {post.status === 'PUBLISHED' && post.published_at && (
          <span>Published {new Date(post.published_at).toLocaleDateString()}</span>
        )}
        {post.status === 'SCHEDULED' && post.scheduled_for && (
          <span>Scheduled for {new Date(post.scheduled_for).toLocaleString()}</span>
        )}
        {post.created_at && <span>Created {new Date(post.created_at).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}

import marketingCustomerService from '@/services/MarketingCustomerService';
