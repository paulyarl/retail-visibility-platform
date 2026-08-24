'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, Plus, Filter, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import marketingCustomerService, {
  GbpPost,
  GbpPostsListResponse,
} from '@/services/MarketingCustomerService';
import { PostComposer } from './PostComposer';
import { PostCard } from './PostCard';

export default function GbpPostsPage() {
  const [data, setData] = useState<GbpPostsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterTopicType, setFilterTopicType] = useState<string | undefined>(undefined);
  const [showComposer, setShowComposer] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const result = await marketingCustomerService.listPosts({
        page,
        pageSize: 20,
        status: filterStatus as any,
        topicType: filterTopicType as any,
      });
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterTopicType]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handlePostCreated = async () => {
    setShowComposer(false);
    await loadPosts();
  };

  const handlePostDeleted = async () => {
    await loadPosts();
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
            <button onClick={() => { setError(null); loadPosts(); }} className="ml-2 underline text-sm">Retry</button>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Posts</h1>
          <p className="text-sm text-gray-500 mt-1">Publish updates, offers, and events to your Google Business Profile</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadPosts} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowComposer(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Post
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <select
              value={filterStatus ?? ''}
              onChange={(e) => { setFilterStatus(e.target.value || undefined); setPage(1); }}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All</option>
              <option value="PUBLISHED">Published</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Post Type</label>
            <select
              value={filterTopicType ?? ''}
              onChange={(e) => { setFilterTopicType(e.target.value || undefined); setPage(1); }}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">All</option>
              <option value="STANDARD">What&apos;s New</option>
              <option value="EVENT">Event</option>
              <option value="OFFER">Offer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Posts List */}
      {data && data.posts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No posts yet. Click &quot;New Post&quot; to create your first Google Business Profile post.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handlePostDeleted} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-500">Page {page} of {data.pagination.totalPages} ({data.pagination.total} posts)</span>
          <button onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))} disabled={page >= data.pagination.totalPages} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Post Composer Modal */}
      {showComposer && (
        <PostComposer onClose={() => setShowComposer(false)} onCreated={handlePostCreated} />
      )}
    </div>
  );
}
