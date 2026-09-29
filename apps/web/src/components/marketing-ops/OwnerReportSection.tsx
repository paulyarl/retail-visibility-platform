'use client';

/**
 * OwnerReportSection — the campaign-panel home of the Business Visibility
 * Report (spec §5.5a). Lives on the campaign because each sibling is
 * self-aware of its own chapter — seeds are not.
 *
 * Controls per spec §5.4:
 *   - Composite preview — renders exactly what the recipient will see for
 *     the current chapter/tier/page-plan selection
 *   - Chapter checkboxes — default = THIS campaign's chapter; siblings one
 *     click away
 *   - Include-detailed-page-plan toggle — default off (signed into the link)
 *   - Per-channel share — one mkt_prospect_report_links row per click:
 *     Email / Text / Social / Print QR (in_person)
 *   - Copy link / Copy text / Download PDF — reuse the minted code
 *
 * A free-tier link leads with the selected chapter list but renders only
 * chapter 1 + locked teasers — "the rest is in the full assessment" is the
 * upsell surface, not a panel surprise.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Loader2,
  Mail,
  MessageSquare,
  Printer,
  RefreshCw,
  Share2,
  Smartphone,
} from 'lucide-react';
import marketingOpsService, {
  CampaignDetail,
  ProspectReportChannel,
  ProspectReportShare,
} from '@/services/MarketingOpsService';
import { ProspectReport } from '@/services/ProspectReportPublicService';
import ProspectReportView from './ProspectReportView';

interface OwnerReportSectionProps {
  campaign: CampaignDetail;
}

const CHAPTER_LABELS: Record<string, string> = {
  website: 'Website story',
  repair: 'Public profiles',
};



const CHANNEL_BUTTONS: { channel: ProspectReportChannel; label: string; icon: typeof Mail }[] = [
  { channel: 'email', label: 'Email', icon: Mail },
  { channel: 'text', label: 'Text', icon: Smartphone },
  { channel: 'social', label: 'Social', icon: Share2 },
  { channel: 'in_person', label: 'Print QR', icon: Printer },
];

export default function OwnerReportSection({ campaign }: OwnerReportSectionProps) {
  const [preview, setPreview] = useState<{ report: ProspectReport; available: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<string[]>(['website']);
  const [tier, setTier] = useState<'free' | 'full'>('free');
  const [includePagePlan, setIncludePagePlan] = useState(false);
  const [shares, setShares] = useState<Partial<Record<ProspectReportChannel, ProspectReportShare>>>({});
  const [sharingChannel, setSharingChannel] = useState<ProspectReportChannel | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const available = preview?.available ?? ['website'];

  const loadPreview = async (sel = chapters, t = tier, pp = includePagePlan) => {
    setLoading(true);
    setError(null);
    const res = await marketingOpsService.getProspectReport(campaign.id, {
      chapters: sel,
      tier: t,
      includePagePlan: pp,
    });
    if (!res) {
      setError('No reportable audit on file yet — run the positioning audit first.');
      setPreview(null);
    } else {
      setPreview({ report: res.report, available: res.available_chapters });
    }
    setLoading(false);
  };

  // Initial load — defaults reflect what CAN be shared (available_chapters).
  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await marketingOpsService.getProspectReport(campaign.id, { tier });
      if (res) {
        setPreview({ report: res.report, available: res.available_chapters });
        // Default = THIS campaign's own chapter(s) — the audit rows it
        // produced (chapter_campaigns attribution; §5.5a). A campaign with
        // no chapter-owning audit (e.g. a derived sibling) falls back to
        // every available chapter so the section is still useful.
        const own = res.available_chapters.filter(
          (c) => res.chapter_campaigns[c] === campaign.id,
        );
        setChapters(own.length > 0 ? own : res.available_chapters);
      }
      // No reportable audit → section renders nothing (silent).
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  // Selection changes re-render the recipient view — the preview always
  // shows exactly what the signed link will render (§5.4).
  const firstSelectionChange = useRef(true);
  const selectionKey = `${chapters.join(',')}|${tier}|${includePagePlan}`;
  useEffect(() => {
    if (firstSelectionChange.current) {
      firstSelectionChange.current = false;
      return;
    }
    void loadPreview(chapters, tier, includePagePlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const refreshPreview = () => loadPreview();

  const share = async (channel: ProspectReportChannel) => {
    setSharingChannel(channel);
    setError(null);
    try {
      const res = await marketingOpsService.getProspectReportShare(campaign.id, {
        chapters,
        tier,
        channel,
        includePagePlan,
      });
      setShares((prev) => ({ ...prev, [channel]: res }));
    } catch (e: any) {
      setError(e?.message || 'Failed to create share link');
    }
    setSharingChannel(null);
  };

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  const copyText = async (shareUrl: string) => {
    const lead = preview?.report.short_version.lead;
    const name = preview?.report.business_name || campaign.business_name;
    const text = `${name ?? 'Your business'} — we put together a report on your web presence. ${lead ? `${lead} ` : ''}See the full picture here: ${shareUrl}`;
    await copy('text', text);
  };

  const emailShare = shares.email;
  const qrShare = shares.in_person;

  // Silent when nothing reportable exists yet — the card appears on the
  // overview the moment any sibling audit can produce a chapter (§5.5a —
  // mounted stage-independently; a Seed-stage A5 with no visible triage UI
  // still has its report home here).
  if (!preview) return null;

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-sky-500" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Owner Report</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              The shareable Business Visibility Report — what the owner sees for the selected chapters.
            </p>
          </div>
        </div>
        {preview && (
          <button
            onClick={refreshPreview}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100/70 dark:hover:bg-sky-900/30 rounded-md disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh preview
          </button>
        )}
      </div>

      <div className="space-y-3">
      {/* Selection controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {available.map((c) => (
            <label key={c} className="inline-flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={chapters.includes(c)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...chapters, c]
                    : chapters.filter((x) => x !== c);
                  setChapters(next);
                }}
                className="rounded border-gray-300"
              />
              {CHAPTER_LABELS[c] ?? c}
            </label>
          ))}
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={includePagePlan}
            onChange={(e) => setIncludePagePlan(e.target.checked)}
            className="rounded border-gray-300"
          />
          Include detailed page plan
        </label>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as 'free' | 'full')}
          className="px-2 py-0.5 text-xs rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200"
        >
          <option value="free">Free tier (chapter 1 + teasers)</option>
          <option value="full">Full diagnostic</option>
        </select>
      </div>

      {/* Share row — one code per click per channel */}
      <div className="flex flex-wrap items-center gap-2">
        {CHANNEL_BUTTONS.map(({ channel, label, icon: Icon }) => (
          <button
            key={channel}
            onClick={() => share(channel)}
            disabled={!preview || chapters.length === 0 || sharingChannel !== null}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-300 bg-white dark:bg-neutral-800 border border-sky-300 dark:border-sky-800/60 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-md disabled:opacity-50"
          >
            {sharingChannel === channel ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Icon className="w-3 h-3" />
            )}
            {label}
          </button>
        ))}
      </div>

      {/* Minted links — copy + pdf reuse the same code */}
      {(emailShare || qrShare) && (
        <div className="space-y-1.5">
          {emailShare && (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white dark:bg-neutral-900 border border-sky-200 dark:border-sky-800/60 px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300">
                {emailShare.url}
              </code>
              <button
                onClick={() => copy('link', emailShare.url)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100/70 dark:hover:bg-sky-900/30 rounded-md"
              >
                <Copy className="w-3 h-3" />
                {copiedKey === 'link' ? 'Copied!' : 'Copy link'}
              </button>
              <button
                onClick={() => copyText(emailShare.url)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100/70 dark:hover:bg-sky-900/30 rounded-md"
              >
                <Copy className="w-3 h-3" />
                {copiedKey === 'text' ? 'Copied!' : 'Copy text'}
              </button>
            </div>
          )}
          {qrShare && (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white dark:bg-neutral-900 border border-sky-200 dark:border-sky-800/60 px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300">
                {qrShare.qr_url}
              </code>
              <a
                href={qrShare.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100/70 dark:hover:bg-sky-900/30 rounded-md"
              >
                <Download className="w-3 h-3" />
                Download PDF
              </a>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {/* Composite preview — recipient view for the current selection */}
      {loading && !preview && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Assembling owner report…
        </div>
      )}
      {preview && (
        <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
          <ProspectReportView report={preview.report} />
        </div>
      )}
      </div>
    </div>
  );
}
