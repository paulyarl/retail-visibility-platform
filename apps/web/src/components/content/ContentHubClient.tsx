'use client';

/**
 * ContentHubClient — /t/[tenantId]/content hub page.
 *
 * One aggregate fetch (content summary) + one profile fetch (for the
 * completeness score via the same `calculateSEOReadiness` the
 * profile-completeness page used — the two surfaces can't disagree).
 */

import { useCallback, useEffect, useState } from 'react';
import { contentHubService } from '@/services/ContentHubService';
import { tenantDirectoryManagementService } from '@/services/TenantDirectoryManagementService';
import { PlatformHomeSingletonService } from '@/services/PlatformHomeSingletonService';
import { calculateSEOReadiness, type BusinessProfile } from '@/lib/validation/businessProfile';
import { topNudge, type ContentSummaryPayload, type QuickLever } from '@/lib/content-hub';
import ContentChannelCardView from './ContentChannelCardView';
import ContentComposer from './ContentComposer';
import { clientLogger } from '@/lib/client-logger';

export default function ContentHubClient({ tenantId }: { tenantId: string }) {
  const [summary, setSummary] = useState<ContentSummaryPayload | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leverBusy, setLeverBusy] = useState<string | null>(null);
  const [leverError, setLeverError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerBusy, setComposerBusy] = useState(false);
  const [composerFeedback, setComposerFeedback] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, profile] = await Promise.all([
        contentHubService.getSummary(tenantId),
        PlatformHomeSingletonService.getInstance().getTenantProfile(tenantId).catch(() => null),
      ]);
      setSummary(sum);
      if (profile) setScore(calculateSEOReadiness(profile as unknown as BusinessProfile));
      if (!sum) setError('Unable to load your content summary.');
    } catch (err) {
      clientLogger.error('[ContentHub] load failed', { detail: err });
      setError('Unable to load your content summary.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLever = useCallback(
    async (lever: QuickLever) => {
      setLeverBusy(lever.key);
      setLeverError(null);
      try {
        await tenantDirectoryManagementService.updateDirectoryEntryOptions(tenantId, {
          [lever.key]: !lever.value,
        });
        await tenantDirectoryManagementService.invalidateCache(`directory-entry-options-${tenantId}`);
        await contentHubService.invalidateServiceCaches(tenantId);
        const sum = await contentHubService.getSummary(tenantId);
        setSummary(sum);
      } catch (err) {
        clientLogger.error('[ContentHub] lever toggle failed', { detail: err });
        setLeverError(`Couldn't update ${lever.label} — try again from the directory settings page.`);
      } finally {
        setLeverBusy(null);
      }
    },
    [tenantId]
  );

  const submitPost = useCallback(
    async (payload: Parameters<typeof contentHubService.postContent>[1]) => {
      setComposerBusy(true);
      setComposerFeedback(null);
      try {
        const res = await contentHubService.postContent(tenantId, payload);
        if (!res) {
          setComposerFeedback(['Publish failed — no destination accepted the post.']);
          return;
        }
        setComposerFeedback(
          res.results.map((r) => (r.ok ? `✓ ${r.channel}${r.scheduled ? ' — scheduled' : ' — published'}` : `✗ ${r.channel} — ${r.error ?? 'failed'}`))
        );
        if (res.posted > 0) {
          const sum = await contentHubService.getSummary(tenantId);
          setSummary(sum);
          if (res.posted === res.total) setComposerOpen(false);
        }
      } finally {
        setComposerBusy(false);
      }
    },
    [tenantId]
  );

  const nudge = summary ? topNudge(summary.channels) : null;
  const surfaces = summary?.surfaces;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header — completeness + surfaces live */}
      <div className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content</h1>
            <p className="text-sm text-gray-500 mt-1">
              Everything you publish, every channel it reaches.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl px-4 py-2"
          >
            + New post
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {score !== null && (
            <span className="text-gray-700">
              <span className="font-semibold">{score}%</span>{' '}
              <span className="text-gray-500">profile complete</span>
            </span>
          )}
          {surfaces && (
            <span className="text-gray-700">
              <span className="font-semibold">{surfaces.live} of {surfaces.total}</span>{' '}
              <span className="text-gray-500">surfaces live</span>
            </span>
          )}
          {nudge && <span className="text-amber-600">{nudge}</span>}
        </div>

        {score !== null && (
          <div className="mt-2 h-1.5 w-64 max-w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}{' '}
          <button type="button" onClick={load} className="font-medium underline">
            Retry
          </button>
        </div>
      )}
      {leverError && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {leverError}
        </div>
      )}
      {composerFeedback && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-1">
          {composerFeedback.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}

      {/* Channel grid */}
      {loading && !summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {(summary?.channels ?? []).map((card) => (
            <ContentChannelCardView
              key={card.key}
              card={card}
              tenantId={tenantId}
              onToggleLever={toggleLever}
              leverBusy={leverBusy}
            />
          ))}
        </div>
      )}

      {composerOpen && summary && (
        <ContentComposer
          channels={summary.channels}
          busy={composerBusy}
          onClose={() => setComposerOpen(false)}
          onSubmit={submitPost}
        />
      )}
    </div>
  );
}
