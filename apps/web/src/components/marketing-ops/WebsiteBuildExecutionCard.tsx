'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle, ClipboardList, Clock, Copy, ExternalLink, Globe, Hammer,
  Link2, Loader2, Store,
} from 'lucide-react';
import marketingOpsService, {
  Campaign, WebsiteBuildDeliveryMode, WebsiteBuildExecutionReadModel,
} from '@/services/MarketingOpsService';
import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';
import { isWebsiteGapCampaign } from './repairCampaignGate';

interface WebsiteBuildExecutionCardProps {
  campaign: Campaign;
  onRefresh: () => void;
  /** Test hook — skips the fetch and renders this read model directly. */
  initialExecution?: WebsiteBuildExecutionReadModel | null;
}

const SCOPE_LABELS: Record<string, string> = {
  new_build: 'New build',
  rebuild: 'Rebuild',
  repair: 'Repair',
  secure_and_refresh: 'Secure & refresh',
};

const MODE_COPY: Record<WebsiteBuildDeliveryMode, { label: string; hint: string }> = {
  dfy: { label: 'DFY', hint: 'we execute the build' },
  diy: { label: 'DIY', hint: 'hand off scope + mockup to owner/dev' },
};

function humanize(v: string | null | undefined): string {
  return (v ?? '').replace(/_/g, ' ');
}

/**
 * Website Build Execution card (PB-08 / A7) — the post-decision tracker.
 *
 * Counterpart of RepairExecutionCard for the website-gap motion. Renders
 * only after the operator confirms a build scope (playbook_decision
 * kind='website_build_scope') — before that, WebsiteGapBriefingPanel carries
 * the decision prompt. Everything here hangs off the confirmed scope:
 *
 *   - delivery mode (dfy/diy) — scope-gated via the read model's scope_modes,
 *     the analog of the repair package's mode select
 *   - the campaign's linked seed (+ an attach path onto the prospect's
 *     shared seed via a 'sibling' link for non-primary siblings)
 *   - the seed-preview storefront (demo tier) — generate/copy/extend
 *   - the website_build owner intake (auto-offered at `paid`, migration 304)
 *   - checklist progress + next steps
 */
export default function WebsiteBuildExecutionCard({ campaign, onRefresh, initialExecution }: WebsiteBuildExecutionCardProps) {
  const [execution, setExecution] = useState<WebsiteBuildExecutionReadModel | null>(initialExecution ?? null);
  const [loading, setLoading] = useState(initialExecution === undefined);
  const [error, setError] = useState<string | null>(null);

  const [savingMode, setSavingMode] = useState(false);
  const [attachingSeed, setAttachingSeed] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState<'generate' | 'extend' | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const isWebsiteGap = isWebsiteGapCampaign(campaign);

  const fetchExecution = async () => {
    setLoading(true);
    try {
      const data = await marketingOpsService.getWebsiteBuildExecution(campaign.id);
      setExecution(data);
    } catch {
      // Non-blocking — the card can still render decision + mode state from
      // campaign.playbook_decision when the read model is unavailable.
      setExecution(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isWebsiteGap && initialExecution === undefined) fetchExecution();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, isWebsiteGap, campaign.playbook_decision]);

  if (!isWebsiteGap) return null;

  const decision = execution?.decision ?? campaign.playbook_decision ?? null;
  if (!decision || decision.kind !== 'website_build_scope') return null;

  const scope = decision.confirmed_scope;
  const deliveryMode = execution?.delivery_mode ?? decision.delivery_mode ?? null;
  const scopeModes = execution?.scope_modes?.length ? execution.scope_modes : (['dfy', 'diy'] as WebsiteBuildDeliveryMode[]);
  const seed = execution?.seed ?? null;
  const linkableSeeds = execution?.linkable_seeds ?? [];
  const preview = execution?.preview ?? null;
  const intake = execution?.intake ?? null;
  const checklist = execution?.checklist ?? null;

  const handleSetMode = async (mode: WebsiteBuildDeliveryMode) => {
    if (mode === deliveryMode) return;
    setSavingMode(true);
    setError(null);
    try {
      await marketingOpsService.updateWebsiteBuildDeliveryMode(campaign.id, mode);
      await fetchExecution();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to set delivery mode');
    } finally {
      setSavingMode(false);
    }
  };

  const handleAttachSeed = async (seedId: string) => {
    setAttachingSeed(seedId);
    setError(null);
    try {
      await directoryPresenceAdminService.linkCampaign(seedId, campaign.id, 'sibling');
      await fetchExecution();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to link seed');
    } finally {
      setAttachingSeed(null);
    }
  };

  const handleGeneratePreview = async () => {
    if (!seed) return;
    setPreviewBusy('generate');
    setError(null);
    try {
      const result = await directoryPresenceAdminService.generateSeedPreview(seed.seed_id);
      if (!result.ok) {
        setError(result.error === 'not_pb08_eligible'
          ? 'Not eligible — needs a confirmed PB-08 website-build decision.'
          : `Failed to generate preview: ${result.error}`);
        return;
      }
      await fetchExecution();
    } catch {
      setError('Failed to generate preview storefront.');
    } finally {
      setPreviewBusy(null);
    }
  };

  const handleExtendPreview = async () => {
    if (!seed) return;
    setPreviewBusy('extend');
    setError(null);
    try {
      const result = await directoryPresenceAdminService.extendSeedPreview(seed.seed_id);
      if (!result.ok) {
        setError('Extension cap reached (28-day maximum).');
        return;
      }
      await fetchExecution();
    } catch {
      setError('Failed to extend preview.');
    } finally {
      setPreviewBusy(null);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    if (typeof window === 'undefined') return;
    const absolute = text.startsWith('/') ? `${window.location.origin}${text}` : text;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard may be unavailable — link remains selectable.
    }
  };

  const previewDaysLeft = preview?.expires_at
    ? Math.max(0, Math.ceil((new Date(preview.expires_at).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Hammer className="w-5 h-5 text-sky-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Website Build Execution</h3>
          <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 uppercase">
            {SCOPE_LABELS[scope] ?? humanize(scope)}
            {deliveryMode ? ` · ${deliveryMode.toUpperCase()}` : ''}
          </span>
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="space-y-4">
        {/* Delivery mode — the dfy/diy analog of the repair package mode.
            Options come from the read model's scope_modes so a scope can
            restrict to a single lane. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Delivery mode</span>
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-neutral-600 p-0.5">
            {scopeModes.map((mode) => (
              <button
                key={mode}
                onClick={() => handleSetMode(mode)}
                disabled={savingMode}
                title={MODE_COPY[mode].hint}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  deliveryMode === mode
                    ? 'bg-sky-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700'
                } disabled:opacity-50`}
              >
                {MODE_COPY[mode].label} — {MODE_COPY[mode].hint}
              </button>
            ))}
          </div>
          {savingMode && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />}
          {!deliveryMode && !savingMode && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">choose who executes the build</span>
          )}
        </div>

        {/* Linked seed */}
        {seed ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-700 dark:bg-neutral-700 dark:text-gray-300">
              <Link2 className="w-3.5 h-3.5" />
              Seed linked · {seed.link_role}
              {seed.seed_status && ` · ${seed.seed_status}`}
              {seed.seed_claimed
                ? ` · claimed${seed.claimed_at ? ` ${new Date(seed.claimed_at).toLocaleDateString()}` : ''}`
                : ' · unclaimed'}
              {seed.nap_match_confidence && ` · NAP match: ${seed.nap_match_confidence}`}
            </span>
            <a
              href={`/settings/admin/directory/presence-seeds/${seed.seed_id}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-300 hover:underline"
            >
              Open seed <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : linkableSeeds.length > 0 ? (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Shared prospect seed found — attach to run the preview storefront through it.
            </p>
            {linkableSeeds.map((s) => (
              <div key={s.seed_id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-700 dark:text-gray-300">
                  {s.business_name ?? s.seed_id}
                  {s.city ? ` · ${s.city}${s.state ? `, ${s.state}` : ''}` : ''}
                  <span className="ml-1.5 text-[10px] text-gray-400">via {s.linked_via_campaign_id} ({s.linked_via_role})</span>
                </span>
                <button
                  onClick={() => handleAttachSeed(s.seed_id)}
                  disabled={attachingSeed !== null}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-md"
                >
                  {attachingSeed === s.seed_id && <Loader2 className="w-3 h-3 animate-spin" />}
                  Attach (sibling link)
                </button>
              </div>
            ))}
          </div>
        ) : !loading ? (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            No seed linked — attach one from the seed's Linked Campaigns panel to unlock the preview storefront.
          </p>
        ) : null}

        {/* Preview storefront (demo tier) — only meaningful with a linked seed */}
        {seed && preview && (
          <div className="rounded-lg border border-sky-200 dark:border-sky-800/50 bg-sky-50/40 dark:bg-sky-950/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                Preview storefront
                {preview.page_views > 0 && (
                  <span className="font-normal text-gray-500 dark:text-gray-400">· {preview.page_views} view{preview.page_views === 1 ? '' : 's'}</span>
                )}
              </p>
              <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 font-medium dark:text-amber-300 dark:bg-amber-900/40">
                Sample catalog — not real inventory
              </span>
            </div>
            {preview.storefront_url ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <a
                  href={preview.storefront_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline font-mono dark:text-blue-400"
                >
                  <ExternalLink className="w-3 h-3" />
                  {preview.storefront_url}
                </a>
                <button
                  onClick={() => copyToClipboard(preview.storefront_url!, 'preview')}
                  className="px-2 py-0.5 border border-gray-300 rounded text-gray-700 hover:bg-white dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {copied === 'preview' ? 'Copied!' : 'Copy link'}
                </button>
                {previewDaysLeft !== null && (
                  <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <Clock className="w-3 h-3" />
                    {previewDaysLeft}d left
                  </span>
                )}
                <button
                  onClick={handleExtendPreview}
                  disabled={previewBusy !== null || preview.extensions_used >= 2}
                  className="px-2 py-0.5 border border-sky-300 rounded text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:border-sky-700 dark:text-sky-300"
                >
                  {previewBusy === 'extend' ? 'Extending…' : `Extend +7d (${preview.extensions_used}/2)`}
                </button>
              </div>
            ) : preview.eligible ? (
              <div className="mt-2 flex items-center gap-3">
                <p className="text-[11px] text-gray-600 dark:text-gray-400 flex-1">
                  Build a live sample storefront from the linked seed as proof-of-work for the website-gap fix.
                </p>
                <button
                  onClick={handleGeneratePreview}
                  disabled={previewBusy !== null}
                  className="px-3 py-1.5 bg-sky-600 text-white rounded text-xs font-medium hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {previewBusy === 'generate' ? 'Generating…' : 'Generate preview'}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                Not eligible — the seed needs a linked campaign with a confirmed PB-08 build-scope decision.
              </p>
            )}
          </div>
        )}

        {/* website_build owner intake (auto-offered at `paid`, migration 304) */}
        <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
          <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" />
            Website build intake
            {intake && (
              <span className="font-normal text-gray-500 dark:text-gray-400">
                {intake.viewed_count} view{intake.viewed_count === 1 ? '' : 's'}
                {intake.submitted_at
                  ? ` · submitted ${new Date(intake.submitted_at).toLocaleString()}`
                  : ' · not submitted'}
                {intake.attachment_count > 0 &&
                  ` · ${intake.attachment_count} attachment${intake.attachment_count === 1 ? '' : 's'}`}
              </span>
            )}
          </p>
          {intake ? (
            <div className="mt-1.5 flex items-center gap-2">
              {intake.short_url && (
                <button
                  onClick={() => copyToClipboard(intake.short_url!, 'intake')}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-white/70 dark:bg-neutral-800 rounded-md border border-sky-200 dark:border-sky-800/50 hover:bg-sky-50"
                >
                  <Copy className="w-3 h-3" />
                  {copied === 'intake' ? 'Copied!' : 'Copy intake link'}
                </button>
              )}
              {intake.submitted_at && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Owner inputs collected
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Auto-offered to the owner when the campaign reaches <span className="font-medium">paid</span> — collects domain, assets, hours, and voice for the build.
            </p>
          )}
        </div>

        {/* Checklist progress — same resolved view the Checklist tab checks off */}
        {checklist && checklist.steps_total > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" />
                Playbook checklist
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                {checklist.steps_completed} of {checklist.steps_total} complete
                {checklist.required_total > 0 && ` · ${checklist.required_completed} of ${checklist.required_total} required`}
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-neutral-700 overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all"
                style={{ width: `${checklist.required_total > 0 ? Math.round((checklist.required_completed / checklist.required_total) * 100) : 0}%` }}
              />
            </div>
            {checklist.next_steps.length > 0 && (
              <ul className="mt-2 space-y-1">
                {checklist.next_steps.map((s) => (
                  <li key={s.id} className="text-[11px] text-gray-600 dark:text-gray-400">
                    <span className="text-gray-400 font-mono mr-1.5">{s.step_order}.</span>
                    {s.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
