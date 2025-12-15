'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { 
  ArrowLeft,
  ChevronRight,
  Image,
  MessageSquare,
  Star,
  Settings2,
  Upload,
  Trash2,
  Send,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Wifi,
  Accessibility,
  CreditCard,
  Car,
  Heart,
  PawPrint
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface Review {
  name: string;
  reviewId: string;
  reviewer: { displayName: string; profilePhotoUrl?: string };
  starRating: string;
  comment?: string;
  createTime: string;
  reviewReply?: { comment: string; updateTime: string };
}

export default function GBPAdvancedFeaturesPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const { hasAccess, loading: accessLoading } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [activeTab, setActiveTab] = useState<'photos' | 'posts' | 'reviews' | 'attributes'>('reviews');
  const [loading, setLoading] = useState(true);
  const [gbpConnected, setGbpConnected] = useState(false);

  // Photos state
  const [media, setMedia] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoCategory, setPhotoCategory] = useState('ADDITIONAL');

  // Posts state
  const [posts, setPosts] = useState<any[]>([]);
  const [creatingPost, setCreatingPost] = useState(false);
  const [newPostSummary, setNewPostSummary] = useState('');

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState<{ averageRating?: number; totalReviewCount?: number }>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Attributes state
  const [attributes, setAttributes] = useState<any[]>([]);
  const [savingAttributes, setSavingAttributes] = useState(false);
  const [commonAttrs, setCommonAttrs] = useState({
    hasWifi: false,
    wheelchairAccessible: false,
    acceptsCreditCards: false,
    hasParking: false,
    lgbtqFriendly: false,
    petFriendly: false,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Check GBP connection
        const gbpRes = await api.get(`${API_BASE_URL}/api/google/business/status?tenantId=${tenantId}`);
        const gbpData = gbpRes.ok ? await gbpRes.json() : null;
        setGbpConnected(gbpData?.data?.isConnected || false);

        if (gbpData?.data?.isConnected) {
          // Fetch reviews by default
          await fetchReviews();
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
      fetchData();
    }
  }, [tenantId]);

  async function fetchMedia() {
    try {
      const res = await api.get(`${API_BASE_URL}/api/google/business/media?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setMedia(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch media:', error);
    }
  }

  async function fetchPosts() {
    try {
      const res = await api.get(`${API_BASE_URL}/api/google/business/posts?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
  }

  async function fetchReviews() {
    try {
      const res = await api.get(`${API_BASE_URL}/api/google/business/reviews?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.data?.reviews || []);
        setReviewStats({
          averageRating: data.data?.averageRating,
          totalReviewCount: data.data?.totalReviewCount,
        });
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    }
  }

  async function fetchAttributes() {
    try {
      const res = await api.get(`${API_BASE_URL}/api/google/business/attributes?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setAttributes(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch attributes:', error);
    }
  }

  async function handleUploadPhoto() {
    if (!photoUrl) return;
    try {
      setUploadingPhoto(true);
      const res = await api.post(`${API_BASE_URL}/api/google/business/media`, {
        tenantId,
        photoUrl,
        category: photoCategory,
      });
      if (res.ok) {
        setPhotoUrl('');
        await fetchMedia();
      }
    } catch (error) {
      console.error('Failed to upload photo:', error);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleCreatePost() {
    if (!newPostSummary) return;
    try {
      setCreatingPost(true);
      const res = await api.post(`${API_BASE_URL}/api/google/business/posts`, {
        tenantId,
        summary: newPostSummary,
        topicType: 'STANDARD',
      });
      if (res.ok) {
        setNewPostSummary('');
        await fetchPosts();
      }
    } catch (error) {
      console.error('Failed to create post:', error);
    } finally {
      setCreatingPost(false);
    }
  }

  async function handleReplyToReview(reviewName: string) {
    if (!replyText) return;
    try {
      setSendingReply(true);
      const res = await api.post(`${API_BASE_URL}/api/google/business/reviews/${encodeURIComponent(reviewName)}/reply`, {
        tenantId,
        comment: replyText,
      });
      if (res.ok) {
        setReplyText('');
        setReplyingTo(null);
        await fetchReviews();
      }
    } catch (error) {
      console.error('Failed to reply to review:', error);
    } finally {
      setSendingReply(false);
    }
  }

  async function handleSaveCommonAttributes() {
    try {
      setSavingAttributes(true);
      const res = await api.post(`${API_BASE_URL}/api/google/business/attributes/common`, {
        tenantId,
        ...commonAttrs,
      });
      if (res.ok) {
        await fetchAttributes();
      }
    } catch (error) {
      console.error('Failed to save attributes:', error);
    } finally {
      setSavingAttributes(false);
    }
  }

  function getStarRating(rating: string): number {
    const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    return map[rating] || 0;
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
          <p className="text-red-800 dark:text-red-200">You don't have access to this page.</p>
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
          { id: 'reviews', label: 'Reviews', icon: Star },
          { id: 'posts', label: 'Posts', icon: MessageSquare },
          { id: 'photos', label: 'Photos', icon: Image },
          { id: 'attributes', label: 'Attributes', icon: Settings2 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'photos') fetchMedia();
              if (tab.id === 'posts') fetchPosts();
              if (tab.id === 'reviews') fetchReviews();
              if (tab.id === 'attributes') fetchAttributes();
            }}
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
        <div className="space-y-4">
          {/* Stats */}
          {reviewStats.totalReviewCount !== undefined && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                    {reviewStats.averageRating?.toFixed(1) || '—'}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= (reviewStats.averageRating || 0)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-neutral-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="text-neutral-600 dark:text-neutral-400">
                  <p className="text-lg font-semibold">{reviewStats.totalReviewCount} reviews</p>
                  <p className="text-sm">on Google</p>
                </div>
              </div>
            </div>
          )}

          {/* Reviews List */}
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.name}
                className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {review.reviewer.profilePhotoUrl ? (
                      <img
                        src={review.reviewer.profilePhotoUrl}
                        alt={review.reviewer.displayName}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                        <span className="text-neutral-500 font-medium">
                          {review.reviewer.displayName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        {review.reviewer.displayName}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= getStarRating(review.starRating)
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-neutral-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-neutral-500">
                          {new Date(review.createTime).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {review.comment && (
                  <p className="mt-3 text-neutral-700 dark:text-neutral-300">{review.comment}</p>
                )}

                {/* Existing Reply */}
                {review.reviewReply && (
                  <div className="mt-3 pl-4 border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-r">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Your Reply:</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">{review.reviewReply.comment}</p>
                  </div>
                )}

                {/* Reply Form */}
                {!review.reviewReply && (
                  <div className="mt-3">
                    {replyingTo === review.name ? (
                      <div className="space-y-2">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write your reply..."
                          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReplyToReview(review.name)}
                            disabled={sendingReply || !replyText}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                          >
                            {sendingReply ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Send Reply
                          </button>
                          <button
                            onClick={() => { setReplyingTo(null); setReplyText(''); }}
                            className="px-3 py-1.5 text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReplyingTo(review.name)}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Reply to this review
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {reviews.length === 0 && (
              <div className="text-center py-8 text-neutral-500">
                No reviews found. Reviews will appear here once customers leave them on Google.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          {/* Create Post */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Create New Post</h3>
            <textarea
              value={newPostSummary}
              onChange={(e) => setNewPostSummary(e.target.value)}
              placeholder="What's new at your business? Share an update, offer, or event..."
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              rows={3}
            />
            <div className="flex justify-end mt-3">
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

          {/* Posts List */}
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
          {/* Upload Photo */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Upload Photo</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="Enter photo URL (must be publicly accessible)"
                className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              />
              <select
                value={photoCategory}
                onChange={(e) => setPhotoCategory(e.target.value)}
                className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option value="ADDITIONAL">Additional</option>
                <option value="COVER">Cover</option>
                <option value="PROFILE">Profile</option>
                <option value="LOGO">Logo</option>
                <option value="EXTERIOR">Exterior</option>
                <option value="INTERIOR">Interior</option>
                <option value="PRODUCT">Product</option>
              </select>
              <button
                onClick={handleUploadPhoto}
                disabled={uploadingPhoto || !photoUrl}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {uploadingPhoto ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload
              </button>
            </div>
          </div>

          {/* Media Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {media.map((item, idx) => (
              <div
                key={item.name || idx}
                className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden relative group"
              >
                {item.googleUrl && (
                  <img src={item.googleUrl} alt="" className="w-full h-full object-cover" />
                )}
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
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Business Attributes</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              Set common attributes that appear on your Google Business Profile
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: 'hasWifi', label: 'Free WiFi', icon: Wifi },
                { key: 'wheelchairAccessible', label: 'Wheelchair Accessible', icon: Accessibility },
                { key: 'acceptsCreditCards', label: 'Accepts Credit Cards', icon: CreditCard },
                { key: 'hasParking', label: 'Parking Available', icon: Car },
                { key: 'lgbtqFriendly', label: 'LGBTQ+ Friendly', icon: Heart },
                { key: 'petFriendly', label: 'Pet Friendly', icon: PawPrint },
              ].map((attr) => (
                <label
                  key={attr.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    commonAttrs[attr.key as keyof typeof commonAttrs]
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={commonAttrs[attr.key as keyof typeof commonAttrs]}
                    onChange={(e) => setCommonAttrs({ ...commonAttrs, [attr.key]: e.target.checked })}
                    className="sr-only"
                  />
                  <attr.icon className={`w-5 h-5 ${
                    commonAttrs[attr.key as keyof typeof commonAttrs]
                      ? 'text-blue-600'
                      : 'text-neutral-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    commonAttrs[attr.key as keyof typeof commonAttrs]
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }`}>
                    {attr.label}
                  </span>
                  {commonAttrs[attr.key as keyof typeof commonAttrs] && (
                    <CheckCircle className="w-4 h-4 text-blue-600 ml-auto" />
                  )}
                </label>
              ))}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleSaveCommonAttributes}
                disabled={savingAttributes}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
              >
                {savingAttributes ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save to Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
