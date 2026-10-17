'use client';

import { useMemo, useState } from 'react';
import {
  Star, Send, Trash2, RefreshCw, Sparkles, Flag, AlertCircle, Loader2, X,
} from 'lucide-react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { clientLogger } from '@/lib/client-logger';

export interface GbpReview {
  name: string;
  reviewId: string;
  reviewer: { displayName: string; profilePhotoUrl?: string };
  starRating: string;
  comment?: string;
  createTime: string;
  reviewReply?: { comment: string; updateTime: string };
}

export interface GbpReviewStats {
  averageRating?: number;
  totalReviewCount?: number;
}

interface AiDraft {
  angle: string;
  text: string;
}

const STAR_MAP: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
const starCount = (rating: string) => STAR_MAP[rating] || 0;
const REPLY_MAX = 4096;

type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';

interface GbpReviewsTabProps {
  tenantId: string;
  reviews: GbpReview[];
  stats: GbpReviewStats;
  canUseAiResponse: boolean;
  onRefresh: () => void;
}

/**
 * Reviews tab for the Advanced GBP Features page.
 *
 * Adds filtering/sorting, reply tooling (character budget + delete), AI draft
 * generation (gated by the gbp_ai_response capability) and dispute intake.
 */
export function GbpReviewsTab({ tenantId, reviews, stats, canUseAiResponse, onRefresh }: GbpReviewsTabProps) {
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [unrepliedOnly, setUnrepliedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [draftsByReview, setDraftsByReview] = useState<Record<string, AiDraft[]>>({});
  const [draftPreviewMode, setDraftPreviewMode] = useState<Record<string, boolean>>({});
  const [draftingId, setDraftingId] = useState<string | null>(null);

  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [disputeEmail, setDisputeEmail] = useState('');
  const [disputeStatement, setDisputeStatement] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    let list = [...reviews];
    if (ratingFilter !== null) list = list.filter((r) => starCount(r.starRating) === ratingFilter);
    if (unrepliedOnly) list = list.filter((r) => !r.reviewReply);
    list.sort((a, b) => {
      if (sort === 'highest') return starCount(b.starRating) - starCount(a.starRating);
      if (sort === 'lowest') return starCount(a.starRating) - starCount(b.starRating);
      const at = new Date(a.createTime).getTime();
      const bt = new Date(b.createTime).getTime();
      return sort === 'oldest' ? at - bt : bt - at;
    });
    return list;
  }, [reviews, ratingFilter, unrepliedOnly, sort]);

  async function handleReply(reviewName: string) {
    if (!replyText.trim()) return;
    try {
      setSendingReply(true);
      setError(null);
      await platformHomeService.replyGoogleBusinessReview(tenantId, reviewName, replyText);
      setReplyText('');
      setReplyingTo(null);
      onRefresh();
    } catch (err) {
      clientLogger.error('Failed to reply to review:', { detail: err });
      setError('Failed to publish reply.');
    } finally {
      setSendingReply(false);
    }
  }

  async function handleDeleteReply(reviewName: string) {
    try {
      setError(null);
      await platformHomeService.deleteGoogleBusinessReviewReply(tenantId, reviewName);
      onRefresh();
    } catch (err) {
      clientLogger.error('Failed to delete review reply:', { detail: err });
      setError('Failed to delete reply.');
    }
  }

  async function handleGenerateDrafts(reviewName: string) {
    try {
      setDraftingId(reviewName);
      setError(null);
      const result = await platformHomeService.generateGoogleBusinessReviewDrafts(tenantId, reviewName);
      setDraftsByReview((prev) => ({ ...prev, [reviewName]: result?.drafts || [] }));
      setDraftPreviewMode((prev) => ({ ...prev, [reviewName]: !!result?.previewMode }));
    } catch (err) {
      clientLogger.error('Failed to generate AI drafts:', { detail: err });
      setError('Failed to generate AI drafts.');
    } finally {
      setDraftingId(null);
    }
  }

  async function handleSubmitDispute(reviewName: string) {
    if (!disputeEmail.trim()) {
      setError('An email is required to file a dispute.');
      return;
    }
    try {
      setSubmittingDispute(true);
      setError(null);
      await platformHomeService.submitGoogleBusinessReviewDispute(tenantId, reviewName, {
        ownerEmail: disputeEmail,
        ownerStatement: disputeStatement || undefined,
        evidencePayload: {},
      });
      setDisputingId(null);
      setDisputeEmail('');
      setDisputeStatement('');
      onRefresh();
    } catch (err) {
      clientLogger.error('Failed to submit review dispute:', { detail: err });
      setError('Failed to submit dispute.');
    } finally {
      setSubmittingDispute(false);
    }
  }

  return (
    <div className="space-y-4">
      {stats.totalReviewCount !== undefined && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                {stats.averageRating?.toFixed(1) || '—'}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${star <= (stats.averageRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-300'}`}
                  />
                ))}
              </div>
            </div>
            <div className="text-neutral-600 dark:text-neutral-400">
              <p className="text-lg font-semibold">{stats.totalReviewCount} reviews</p>
              <p className="text-sm">on Google</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
        <div className="flex items-center gap-1">
          {[null, 5, 4, 3, 2, 1].map((r) => (
            <button
              key={String(r)}
              type="button"
              onClick={() => setRatingFilter(r)}
              className={`px-2.5 py-1 text-sm rounded-md border transition-colors ${
                ratingFilter === r
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700'
              }`}
            >
              {r === null ? 'All' : `${r}★`}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <input
            type="checkbox"
            checked={unrepliedOnly}
            onChange={(e) => setUnrepliedOnly(e.target.checked)}
            className="rounded border-neutral-300 dark:border-neutral-600"
          />
          Unreplied only
        </label>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="px-2.5 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            title="Refresh reviews"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Reviews */}
      <div className="space-y-3">
        {visible.map((review) => {
          const drafts = draftsByReview[review.name] || [];
          const previewMode = draftPreviewMode[review.name];
          return (
            <div key={review.name} className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {review.reviewer.profilePhotoUrl ? (
                    <img src={review.reviewer.profilePhotoUrl} alt={review.reviewer.displayName} className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                      <span className="text-neutral-500 font-medium">{review.reviewer.displayName.charAt(0)}</span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">{review.reviewer.displayName}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${star <= starCount(review.starRating) ? 'text-yellow-400 fill-yellow-400' : 'text-neutral-300'}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-neutral-500">{new Date(review.createTime).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {review.comment && <p className="mt-3 text-neutral-700 dark:text-neutral-300">{review.comment}</p>}

              {review.reviewReply && (
                <div className="mt-3 pl-4 border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-r">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Your Reply:</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">{review.reviewReply.comment}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteReply(review.name)}
                      className="p-1 text-blue-500 hover:text-red-600 flex-shrink-0"
                      title="Delete reply"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {!review.reviewReply && (
                <div className="mt-3 space-y-3">
                  {replyingTo === review.name ? (
                    <div className="space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your reply…"
                        maxLength={REPLY_MAX}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm"
                        rows={3}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReply(review.name)}
                          disabled={sendingReply || !replyText.trim()}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                        >
                          {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Send Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReplyingTo(null); setReplyText(''); }}
                          className="px-3 py-1.5 text-neutral-600 hover:text-neutral-800 dark:text-neutral-400 text-sm"
                        >
                          Cancel
                        </button>
                        <span className="ml-auto text-xs text-neutral-400">{replyText.length}/{REPLY_MAX}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => { setReplyingTo(review.name); setReplyText(''); }}
                        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        Reply to this review
                      </button>

                      {canUseAiResponse ? (
                        <button
                          type="button"
                          onClick={() => handleGenerateDrafts(review.name)}
                          disabled={draftingId === review.name}
                          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 disabled:opacity-50"
                        >
                          {draftingId === review.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          AI drafts
                        </button>
                      ) : (
                        <a
                          href={`/t/${tenantId}/settings/feature-store?feature=gbp_ai_response`}
                          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                        >
                          <Sparkles className="w-4 h-4" />
                          AI drafts (GBP Pro)
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => { setDisputingId(review.name); setDisputeEmail(''); setDisputeStatement(''); }}
                        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                      >
                        <Flag className="w-4 h-4" />
                        Dispute
                      </button>
                    </div>
                  )}

                  {/* AI drafts */}
                  {drafts.length > 0 && (
                    <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        <Sparkles className="w-3.5 h-3.5" />
                        {previewMode ? 'Preview draft' : 'AI drafts'}
                        {previewMode && <span className="font-normal text-indigo-500">— upgrade for 3 tone variants</span>}
                      </div>
                      {drafts.map((draft, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => { setReplyingTo(review.name); setReplyText(draft.text); }}
                          className="w-full text-left text-sm p-2 rounded-md bg-white dark:bg-neutral-800 border border-indigo-100 dark:border-indigo-900 hover:border-indigo-400 transition-colors"
                        >
                          <span className="block text-[10px] uppercase tracking-wide text-indigo-500 mb-0.5">{draft.angle}</span>
                          {draft.text}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dispute intake */}
                  {disputingId === review.name && (
                    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Dispute this review</p>
                        <button type="button" onClick={() => setDisputingId(null)} className="p-1 text-neutral-400 hover:text-neutral-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="email"
                        value={disputeEmail}
                        onChange={(e) => setDisputeEmail(e.target.value)}
                        placeholder="Contact email"
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm"
                      />
                      <textarea
                        value={disputeStatement}
                        onChange={(e) => setDisputeStatement(e.target.value)}
                        placeholder="Why is this review a policy violation?"
                        rows={2}
                        className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleSubmitDispute(review.name)}
                        disabled={submittingDispute || !disputeEmail.trim()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                      >
                        {submittingDispute ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                        Submit dispute
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {visible.length === 0 && (
          <div className="text-center py-8 text-neutral-500">
            {reviews.length === 0
              ? 'No reviews found. Reviews will appear here once customers leave them on Google.'
              : 'No reviews match the current filters.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default GbpReviewsTab;
