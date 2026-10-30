'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { apiRequest } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import {
  ArrowLeft,
  ChevronRight,
  Image as ImageIcon,
  MessageSquare,
  Star,
  Settings2,
  Plus,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  X,
  Copy,
  ClipboardPaste,
} from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';
import { GbpReviewsTab, type GbpReview } from './GbpReviewsTab';
import { GbpPhotoUploadPicker } from './GbpPhotoUploadPicker';
import { GbpAttributesTab } from './GbpAttributesTab';

type TabId = 'reviews' | 'posts' | 'photos' | 'attributes';

export default function GBPAdvancedFeaturesPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const { hasAccess, loading: accessLoading } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const { data: capabilities } = useAllCapabilities(tenantId || null);
  const gbp = capabilities?.gbpManagement;
  const canUseAiResponse = !!gbp?.canUseAiResponse;
  const canUsePostsScheduler = !!gbp?.canUsePostsScheduler;
  const canUseMediaUpload = !!gbp?.canUseMediaUpload;
  const canUseAttributes = !!gbp?.canUseAttributes;

  const [activeTab, setActiveTab] = useState<TabId>('reviews');
  const [loading, setLoading] = useState(true);
  const [gbpConnected, setGbpConnected] = useState(false);

  // Photos state
  const [media, setMedia] = useState<any[]>([]);

  // Posts state
  const [posts, setPosts] = useState<any[]>([]);
  const [creatingPost, setCreatingPost] = useState(false);
  const [newPostSummary, setNewPostSummary] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [schedulingPost, setSchedulingPost] = useState(false);
  const [attachedPhoto, setAttachedPhoto] = useState<any | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestTone, setSuggestTone] = useState('friendly');
  const [suggestTheme, setSuggestTheme] = useState('announcement');
  const [suggestCta, setSuggestCta] = useState('visit');
  const [postRecurrence, setPostRecurrence] = useState('');
  const [renderedPrompt, setRenderedPrompt] = useState('');
  const [renderingPrompt, setRenderingPrompt] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<GbpReview[]>([]);
  const [reviewStats, setReviewStats] = useState<{ averageRating?: number; totalReviewCount?: number }>({});

  const fetchMedia = useCallback(async () => {
    try {
      const data = await platformHomeService.getGoogleBusinessMedia(tenantId);
      setMedia(data || []);
    } catch (error) {
      clientLogger.error('Failed to fetch media:', { detail: error });
    }
  }, [tenantId]);

  const fetchPosts = useCallback(async () => {
    try {
      const data = await platformHomeService.getGoogleBusinessPosts(tenantId);
      setPosts(data || []);
    } catch (error) {
      clientLogger.error('Failed to fetch posts:', { detail: error });
    }
  }, [tenantId]);

  const fetchScheduledPosts = useCallback(async () => {
    try {
      const res = await apiRequest(`/api/google/business/posts/scheduled?tenantId=${tenantId}`);
      const body = await res.json();
      if (body?.success) setScheduledPosts(body.data.posts || []);
    } catch (error) {
      clientLogger.error('Failed to fetch scheduled posts:', { detail: error });
    }
  }, [tenantId]);

  async function handleSchedulePost() {
    if (!newPostSummary || !scheduledAt) return;
    try {
      setSchedulingPost(true);
      await apiRequest(`/api/google/business/posts/schedule`, {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          summary: newPostSummary,
          topicType: 'STANDARD',
          scheduledFor: new Date(scheduledAt).toISOString(),
          ...(postRecurrence ? { recurrence: { freq: postRecurrence } } : {}),
          ...(attachedPhoto?.googleUrl ? { media: { url: attachedPhoto.googleUrl } } : {}),
        }),
      });
      setNewPostSummary('');
      setScheduledAt('');
      setAttachedPhoto(null);
      setPostRecurrence('');
      await fetchScheduledPosts();
    } catch (error) {
      clientLogger.error('Failed to schedule post:', { detail: error });
    } finally {
      setSchedulingPost(false);
    }
  }

  async function handleSuggestCopy() {
    try {
      setSuggesting(true);
      const res = await apiRequest(`/api/google/business/posts/suggest`, {
        method: 'POST',
        body: JSON.stringify(suggestRequestBody()),
      });
      const body = await res.json();
      if (body?.success && body.data?.summary) setNewPostSummary(body.data.summary);
    } catch (error) {
      clientLogger.error('Failed to suggest post copy:', { detail: error });
    } finally {
      setSuggesting(false);
    }
  }

  function togglePhotoPicker() {
    const next = !showPhotoPicker;
    setShowPhotoPicker(next);
    if (next && media.length === 0) fetchMedia();
  }

  // Dual AI pattern (same as marketing-ops briefings): Suggest copy = internal
  // one-click resolve; Copy prompt = take the built prompt to an external LLM;
  // Import = paste that output back into the composer.
  const suggestRequestBody = () => ({
    tenantId,
    photoDescription:
      attachedPhoto?.description || attachedPhoto?.locationAssociation?.category || null,
    tone: suggestTone,
    theme: suggestTheme,
    cta: suggestCta,
  });

  async function handleRenderPrompt() {
    try {
      setRenderingPrompt(true);
      const res = await apiRequest(`/api/google/business/posts/suggest`, {
        method: 'POST',
        body: JSON.stringify({ ...suggestRequestBody(), renderOnly: true }),
      });
      const body = await res.json();
      if (body?.success && body.data?.prompt) {
        setRenderedPrompt(`${body.data.system}\n\n${body.data.prompt}`);
      }
    } catch (error) {
      clientLogger.error('Failed to render prompt:', { detail: error });
    } finally {
      setRenderingPrompt(false);
    }
  }

  async function handleCopyPrompt() {
    if (!renderedPrompt) return;
    await navigator.clipboard.writeText(renderedPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 1500);
  }

  async function handleImportCopy() {
    const text = importText.trim();
    if (!text) return;
    try {
      setImporting(true);
      setImportWarnings([]);
      const res = await apiRequest(`/api/google/business/posts/suggest/external`, {
        method: 'POST',
        body: JSON.stringify({ tenantId, text }),
      });
      const body = await res.json();
      if (body?.success && body.data?.summary) {
        setNewPostSummary(body.data.summary);
        setImportWarnings(body.data.warnings || []);
        setImportText('');
        setShowImport(false);
      }
    } catch (error) {
      clientLogger.error('Failed to import post copy:', { detail: error });
    } finally {
      setImporting(false);
    }
  }

  async function handleCancelScheduled(postId: string) {
    try {
      await apiRequest(`/api/google/business/posts/${postId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
      await fetchScheduledPosts();
    } catch (error) {
      clientLogger.error('Failed to cancel scheduled post:', { detail: error });
    }
  }

  const fetchReviews = useCallback(async () => {
    try {
      const data = await platformHomeService.getGoogleBusinessReviews(tenantId);
      setReviews(data?.reviews || []);
      setReviewStats({
        averageRating: data?.averageRating,
        totalReviewCount: data?.totalReviewCount,
      });
    } catch (error) {
      clientLogger.error('Failed to fetch reviews:', { detail: error });
    }
  }, [tenantId]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const gbpData = await platformHomeService.getGoogleGBPStatus(tenantId);
        setGbpConnected(gbpData?.isConnected || false);
        if (gbpData?.isConnected) {
          await fetchReviews();
        }
      } catch (error) {
        clientLogger.error('Failed to fetch data:', { detail: error });
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
      fetchData();
    }
  }, [tenantId, fetchReviews]);

  async function handleCreatePost() {
    if (!newPostSummary) return;
    try {
      setCreatingPost(true);
      await platformHomeService.createGoogleBusinessPost(
        tenantId,
        newPostSummary,
        'STANDARD',
        attachedPhoto?.googleUrl ? { url: attachedPhoto.googleUrl } : undefined
      );
      setNewPostSummary('');
      setAttachedPhoto(null);
      await fetchPosts();
    } catch (error) {
      clientLogger.error('Failed to create post:', { detail: error });
    } finally {
      setCreatingPost(false);
    }
  }

  function selectTab(id: TabId) {
    setActiveTab(id);
    if (id === 'photos') fetchMedia();
    if (id === 'posts') {
      fetchPosts();
      if (canUsePostsScheduler) fetchScheduledPosts();
    }
    if (id === 'reviews') fetchReviews();
  }

  if (accessLoading || loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
          <div className="h-64 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">You don&apos;t have access to this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
        <Link href={`/t/${tenantId}/settings`} className="hover:text-neutral-700 dark:hover:text-neutral-300">
          Settings
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/t/${tenantId}/settings/integrations/google`} className="hover:text-neutral-700 dark:hover:text-neutral-300">
          Google
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-neutral-900 dark:text-neutral-100">Advanced Features</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/t/${tenantId}/settings/integrations/google`}
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Google Integrations
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Advanced GBP Features
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Manage photos, posts, reviews, and business attributes on Google Business Profile
        </p>
        <Link
          href={`/t/${tenantId}/settings/integrations/google/gbp-options`}
          className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Display settings →
        </Link>
      </div>

      {!gbpConnected && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <p className="text-amber-800 dark:text-amber-200">
              Google Business Profile not connected. Please connect first to use these features.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-neutral-200 dark:border-neutral-700">
        {[
          { id: 'reviews' as const, label: 'Reviews', icon: Star },
          { id: 'posts' as const, label: 'Posts', icon: MessageSquare },
          { id: 'photos' as const, label: 'Photos', icon: ImageIcon },
          { id: 'attributes' as const, label: 'Attributes', icon: Settings2 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <GbpReviewsTab
          tenantId={tenantId}
          reviews={reviews}
          stats={reviewStats}
          canUseAiResponse={canUseAiResponse}
          onRefresh={fetchReviews}
        />
      )}

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Create New Post</h3>
            <textarea
              value={newPostSummary}
              onChange={(e) => setNewPostSummary(e.target.value)}
              placeholder="What's new at your business? Share an update, offer, or event..."
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              rows={3}
            />
            {attachedPhoto && (
              <div className="flex items-center gap-3 mt-3">
                <img
                  src={attachedPhoto.googleUrl}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover border border-neutral-200 dark:border-neutral-600"
                />
                <button
                  onClick={() => setAttachedPhoto(null)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <X className="w-3 h-3" /> Remove photo
                </button>
              </div>
            )}

            {canUsePostsScheduler && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  onClick={togglePhotoPicker}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <ImageIcon className="w-4 h-4" /> Photo
                </button>
                <button
                  onClick={handleSuggestCopy}
                  disabled={suggesting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-purple-300 dark:border-purple-700 rounded-lg text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 disabled:opacity-50"
                >
                  {suggesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Suggest copy
                </button>
                <select
                  value={suggestTone}
                  onChange={(e) => setSuggestTone(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
                >
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="playful">Playful</option>
                  <option value="urgent">Urgent</option>
                  <option value="informative">Informative</option>
                </select>
                <select
                  value={suggestTheme}
                  onChange={(e) => setSuggestTheme(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
                >
                  <option value="announcement">Announcement</option>
                  <option value="problem_solution">Problem → Solution</option>
                  <option value="offer">Offer</option>
                  <option value="tip">Tip</option>
                  <option value="seasonal">Seasonal</option>
                  <option value="feature_highlight">Feature highlight</option>
                </select>
                <select
                  value={suggestCta}
                  onChange={(e) => setSuggestCta(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
                >
                  <option value="visit">CTA: Visit</option>
                  <option value="call">CTA: Call</option>
                  <option value="learn_more">CTA: Learn more</option>
                  <option value="order">CTA: Order</option>
                  <option value="book">CTA: Book</option>
                  <option value="none">No CTA</option>
                </select>
                <button
                  onClick={handleRenderPrompt}
                  disabled={renderingPrompt}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                >
                  {renderingPrompt ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  Copy prompt
                </button>
                <button
                  onClick={() => setShowImport((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <ClipboardPaste className="w-4 h-4" /> Import
                </button>
              </div>
            )}

            {renderedPrompt && (
              <div className="mt-3 space-y-2">
                <textarea
                  readOnly
                  value={renderedPrompt}
                  rows={5}
                  className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 text-xs font-mono"
                />
                <button
                  onClick={handleCopyPrompt}
                  className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
                >
                  {copiedPrompt ? 'Copied!' : 'Copy to clipboard — paste it into your AI of choice'}
                </button>
              </div>
            )}

            {showImport && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste your external AI's post copy here..."
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm"
                />
                <button
                  onClick={handleImportCopy}
                  disabled={!importText.trim() || importing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
                >
                  {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
                  Use this copy
                </button>
              </div>
            )}

            {importWarnings.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {importWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-amber-600 dark:text-amber-400">
                    {w}
                  </li>
                ))}
              </ul>
            )}

            {showPhotoPicker && (
              <div className="mt-3">
                {media.length === 0 ? (
                  <p className="text-sm text-neutral-500 py-4 text-center">
                    No photos on your profile yet — upload one in the Photos tab first.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                    {media.map((item, idx) => (
                      <button
                        key={item.name || item.googleUrl || idx}
                        onClick={() => {
                          setAttachedPhoto(item);
                          setShowPhotoPicker(false);
                        }}
                        className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-500 focus:border-blue-500"
                      >
                        {item.googleUrl && (
                          <img src={item.googleUrl} alt="" className="w-full h-full object-cover" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 mt-3">
              {!canUsePostsScheduler ? (
                <Link
                  href={`/t/${tenantId}/settings/feature-store?feature=gbp_posts_scheduler`}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Scheduling is part of GBP Pro
                </Link>
              ) : (
                <>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm"
                  />
                  <select
                    value={postRecurrence}
                    onChange={(e) => setPostRecurrence(e.target.value)}
                    className="px-2 py-2 text-sm border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300"
                  >
                    <option value="">Once</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <button
                    onClick={handleSchedulePost}
                    disabled={schedulingPost || !newPostSummary || !scheduledAt}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-medium rounded-lg disabled:opacity-50"
                  >
                    {schedulingPost ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Schedule
                  </button>
                </>
              )}
              <button
                onClick={handleCreatePost}
                disabled={creatingPost || !newPostSummary}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {creatingPost ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Post to Google
              </button>
            </div>
          </div>

          {canUsePostsScheduler && scheduledPosts.length > 0 && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Scheduled</h3>
              {scheduledPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between border border-neutral-200 dark:border-neutral-700 rounded-lg p-3"
                >
                  <div>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">{post.summary}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {post.scheduled_for && new Date(post.scheduled_for).toLocaleString()}
                      {post.status && ` · ${post.status.toLowerCase()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelScheduled(post.id)}
                    className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {posts.map((post, idx) => (
              <div
                key={post.name || idx}
                className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4"
              >
                <p className="text-neutral-700 dark:text-neutral-300">{post.summary}</p>
                <p className="text-xs text-neutral-500 mt-2">
                  {post.createTime && new Date(post.createTime).toLocaleDateString()}
                </p>
              </div>
            ))}

            {posts.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                No posts yet. Create your first post above!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <div className="space-y-4">
          <GbpPhotoUploadPicker tenantId={tenantId} onUploaded={fetchMedia} canUpload={canUseMediaUpload} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {media.map((item, idx) => (
              <div
                key={item.name || idx}
                className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden relative group"
              >
                {item.googleUrl && <img src={item.googleUrl} alt="" className="w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs px-2 py-1 bg-black/50 rounded">
                    {item.locationAssociation?.category || 'Photo'}
                  </span>
                </div>
              </div>
            ))}

            {media.length === 0 && (
              <div className="col-span-full text-center py-8 text-neutral-500">
                No photos uploaded yet. Add photos to enhance your Google listing!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attributes Tab */}
      {activeTab === 'attributes' && (
        <GbpAttributesTab tenantId={tenantId} canUseAttributes={canUseAttributes} />
      )}
    </div>
  );
}
