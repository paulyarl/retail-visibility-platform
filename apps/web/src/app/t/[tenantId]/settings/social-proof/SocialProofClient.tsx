'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SocialProofService, SocialMention, ModerationSummary } from '@/services/SocialProofService';
import { Check, X, Star, Trash2, RefreshCw, MessageCircle, Heart, Share2, Eye } from 'lucide-react';

interface SocialProofClientProps {
  tenantId: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  tiktok: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  twitter: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  facebook: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  youtube: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

function statusBadge(status: string) {
  switch (status) {
    case 'approved':
      return <Badge variant="success">Approved</Badge>;
    case 'rejected':
      return <Badge variant="error">Rejected</Badge>;
    default:
      return <Badge variant="warning">Pending</Badge>;
  }
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SocialProofClient({ tenantId }: SocialProofClientProps) {
  const [mentions, setMentions] = useState<SocialMention[]>([]);
  const [summary, setSummary] = useState<ModerationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listResult, summaryResult] = await Promise.all([
        SocialProofService.listMentions(tenantId, filter !== 'all' ? { status: filter } : undefined),
        SocialProofService.getSummary(tenantId),
      ]);
      setMentions(listResult.mentions);
      setSummary(summaryResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load social proof data');
    } finally {
      setLoading(false);
    }
  }, [tenantId, filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleModerate = async (mentionId: string, status: 'approved' | 'rejected') => {
    setActionLoading(mentionId);
    try {
      await SocialProofService.updateMention(tenantId, mentionId, { moderationStatus: status });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update mention');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleFeatured = async (mention: SocialMention) => {
    setActionLoading(mention.id);
    try {
      await SocialProofService.updateMention(tenantId, mention.id, { isFeatured: !mention.is_featured });
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update mention');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (mentionId: string) => {
    if (!confirm('Are you sure you want to delete this mention?')) return;
    setActionLoading(mentionId);
    try {
      await SocialProofService.deleteMention(tenantId, mentionId);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mention');
    } finally {
      setActionLoading(null);
    }
  };

  const filterTabs = [
    { key: 'all', label: 'All', count: summary?.total ?? 0 },
    { key: 'pending', label: 'Pending', count: summary?.pending ?? 0 },
    { key: 'approved', label: 'Approved', count: summary?.approved ?? 0 },
    { key: 'rejected', label: 'Rejected', count: summary?.rejected ?? 0 },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Social Proof</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Moderate and display user-generated content from social media platforms
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-xs text-neutral-500 mt-1">Total Mentions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
              <div className="text-xs text-neutral-500 mt-1">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
              <div className="text-xs text-neutral-500 mt-1">Approved</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{summary.featured}</div>
              <div className="text-xs text-neutral-500 mt-1">Featured</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : mentions.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="mx-auto h-12 w-12 text-neutral-400" />}
          title="No social mentions yet"
          description="Social mentions from Instagram, TikTok, and other platforms will appear here for moderation."
        />
      ) : (
        <div className="space-y-4">
          {mentions.map((mention) => (
            <Card key={mention.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {mention.author_avatar_url ? (
                      <img
                        src={mention.author_avatar_url}
                        alt={mention.author_username}
                        className="h-10 w-10 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-neutral-500">
                          {mention.author_username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{mention.author_display_name || mention.author_username}</span>
                        <span className="text-xs text-neutral-500">@{mention.author_username}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLATFORM_COLORS[mention.platform?.toLowerCase()] || 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'}`}>
                          {mention.platform}
                        </span>
                        {statusBadge(mention.moderation_status)}
                        {mention.is_featured && (
                          <Badge variant="info">
                            <Star className="h-3 w-3 mr-1 inline" />
                            Featured
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-2 line-clamp-3">
                        {mention.content}
                      </p>
                      {mention.media_urls && mention.media_urls.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {mention.media_urls.slice(0, 4).map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt={`Media ${i + 1}`}
                              className="h-16 w-16 rounded object-cover"
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5" /> {formatCount(mention.like_count)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5" /> {formatCount(mention.comment_count)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Share2 className="h-3.5 w-3.5" /> {formatCount(mention.share_count)}
                        </span>
                        {mention.view_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" /> {formatCount(mention.view_count)}
                          </span>
                        )}
                        <span>{formatDate(mention.posted_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {mention.moderation_status !== 'approved' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleModerate(mention.id, 'approved')}
                        disabled={actionLoading === mention.id}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    )}
                    {mention.moderation_status !== 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleModerate(mention.id, 'rejected')}
                        disabled={actionLoading === mention.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleFeatured(mention)}
                      disabled={actionLoading === mention.id}
                    >
                      <Star className={`h-4 w-4 mr-1 ${mention.is_featured ? 'fill-current' : ''}`} />
                      {mention.is_featured ? 'Unfeature' : 'Feature'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(mention.id)}
                      disabled={actionLoading === mention.id}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
