'use client';

import { useState } from 'react';
import { Copy, Check, ArrowRight, Sparkles, StickyNote, Plus, Loader2, X, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Audit } from '@/services/MarketingOpsService';
import AuditImportMetadataBadge from './AuditImportMetadataBadge';

/**
 * CategoryAnalysisAuditCard — structured renderer for market_analysis audits.
 *
 * Market-analysis audits are created by the external-import flow (S2a) when
 * a prompt template declares `output_schema.name = "market_analysis"`. The
 * full validated JSON is stored in `audit.audit_data`. This card renders the
 * structured fields (GBP metrics, top competitors, pain points, opportunity
 * gaps, outreach angle) and provides action buttons:
 *   - Copy outreach angle
 *   - Save to campaign notes (append)
 *   - Create seek prompt deep-link (S3b)
 *   - Derive business-scope child campaign from a discovered competitor
 *     (per-competitor button + custom-name action)
 */

interface MarketAnalysisData {
  market_analysis: {
    location: string;
    industry: string;
    total_approximate_businesses: number;
    average_gbp_metrics: {
      average_rating: number;
      average_review_count: number;
    };
    gbp_claimed_percentage: number;
    website_presence_percentage: number;
    top_5_competitors: {
      name: string;
      approximate_rating: number;
      approximate_review_count: number;
      location_status: string;
    }[];
    common_pain_points: string[];
    opportunity_gaps: string[];
    recommended_outreach_angle: string;
  };
}

function isMarketAnalysisAudit(audit: Audit): boolean {
  return audit.platform === 'category_analysis'
    && audit.audit_data != null
    && typeof audit.audit_data === 'object'
    && 'market_analysis' in audit.audit_data;
}

function parseMarketAnalysis(audit: Audit): MarketAnalysisData | null {
  if (!isMarketAnalysisAudit(audit)) return null;
  return audit.audit_data as MarketAnalysisData;
}

export default function CategoryAnalysisAuditCard({
  audit,
  campaignId,
}: {
  audit: Audit;
  campaignId: string;
}) {
  const ma = parseMarketAnalysis(audit);
  const [copiedAngle, setCopiedAngle] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);
  const [derivingIdx, setDerivingIdx] = useState<number | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [showCustomDerive, setShowCustomDerive] = useState(false);
  const [customName, setCustomName] = useState('');
  const [derivingCustom, setDerivingCustom] = useState(false);
  const [queueingIdx, setQueueingIdx] = useState<number | null>(null);
  const [queuedFeedback, setQueuedFeedback] = useState<Record<number, 'queued' | 'exists' | 'already'>>({});
  const router = useRouter();

  if (!ma) return null;
  const data = ma.market_analysis;

  const handleDeriveFromCompetitor = async (idx: number) => {
    const c = data.top_5_competitors[idx];
    if (!c) return;
    setDerivingIdx(idx);
    setDeriveError(null);
    try {
      const { default: service } = await import('@/services/MarketingOpsService');
      const child = await service.deriveBusinessCampaign(campaignId, {
        business_name: c.name,
        rating: c.approximate_rating,
        review_count: c.approximate_review_count,
        location: c.location_status,
      });
      router.push(`/settings/admin/marketing-ops/campaigns/${child.id}`);
    } catch (err: any) {
      setDeriveError(err.message || 'Failed to create campaign');
      setDerivingIdx(null);
    }
  };

  const handleDeriveCustom = async () => {
    const name = customName.trim();
    if (!name) return;
    setDerivingCustom(true);
    setDeriveError(null);
    try {
      const { default: service } = await import('@/services/MarketingOpsService');
      const child = await service.deriveBusinessCampaign(campaignId, {
        business_name: name,
      });
      router.push(`/settings/admin/marketing-ops/campaigns/${child.id}`);
    } catch (err: any) {
      setDeriveError(err.message || 'Failed to create campaign');
      setDerivingCustom(false);
    }
  };

  const handleAddToQueue = async (idx: number) => {
    const c = data.top_5_competitors[idx];
    if (!c) return;
    setQueueingIdx(idx);
    setDeriveError(null);
    try {
      const { default: service } = await import('@/services/MarketingOpsService');
      const result = await service.addToQueue({
        business_name: c.name,
        title: c.name,
        source_kind: 'category_analysis',
        source_campaign_id: campaignId,
        source_audit_id: audit.id,
        audit_date: audit.created_at,
        business_snapshot: {
          rating: c.approximate_rating,
          review_count: c.approximate_review_count,
          location: c.location_status,
        },
      } as any);
      setQueuedFeedback((prev) => ({
        ...prev,
        [idx]: result.kind === 'campaign_exists' ? 'exists' : result.kind === 'already_queued' ? 'already' : 'queued',
      }));
    } catch (err: any) {
      setDeriveError(err.message || 'Failed to add to queue');
    } finally {
      setQueueingIdx(null);
    }
  };

  const handleCopyAngle = () => {
    navigator.clipboard.writeText(data.recommended_outreach_angle);
    setCopiedAngle(true);
    setTimeout(() => setCopiedAngle(false), 2000);
  };

  const handleSaveToNotes = () => {
    // Append the outreach angle to campaign notes via the update campaign API.
    // This is a fire-and-forget action; the parent component handles errors.
    const noteText = `[${new Date(audit.created_at).toLocaleDateString()}] Outreach angle: ${data.recommended_outreach_angle}`;
    // Emit a custom event the parent can listen for, or call the service directly.
    // We call the service directly here for simplicity.
    import('@/services/MarketingOpsService').then(({ default: service }) => {
      // We need the current notes to append. Fetch the campaign first.
      service.getCampaign(campaignId).then((campaign) => {
        const existingNotes = campaign.notes || '';
        const newNotes = existingNotes
          ? `${existingNotes}\n${noteText}`
          : noteText;
        service.updateCampaign(campaignId, { notes: newNotes }).then(() => {
          setSavedNotes(true);
          setTimeout(() => setSavedNotes(false), 3000);
        });
      });
    });
  };

  // Build the seek-prompt deep-link (S3b contract: ?campaignId=&angle=)
  const seekPromptHref = `/settings/admin/marketing-ops/prompts?campaignId=${encodeURIComponent(campaignId)}&angle=${encodeURIComponent(data.recommended_outreach_angle)}`;

  return (
    <div className="border border-violet-200 dark:border-violet-800 rounded-lg p-4 bg-violet-50/30 dark:bg-violet-900/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span className="font-medium text-gray-900 dark:text-white">Category Analysis</span>
          <span className="text-xs text-gray-400">
            {data.industry} · {data.location}
          </span>
          <AuditImportMetadataBadge audit={audit} />
        </div>
        <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
      </div>

      {/* GBP metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Metric label="Total businesses" value={String(data.total_approximate_businesses)} />
        <Metric label="Avg rating" value={Number(data.average_gbp_metrics.average_rating).toFixed(1)} />
        <Metric label="Avg reviews" value={String(data.average_gbp_metrics.average_review_count)} />
        <Metric label="GBP claimed" value={`${data.gbp_claimed_percentage}%`} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Metric label="Website presence" value={`${data.website_presence_percentage}%`} />
        <Metric label="Reviews (audit)" value={audit.review_count?.toString() ?? '—'} />
        <Metric label="Avg rating (audit)" value={audit.average_rating != null ? Number(audit.average_rating).toFixed(1) : '—'} />
        <Metric label="Photos (audit)" value={audit.photo_count?.toString() ?? '—'} />
      </div>

      {/* Top competitors */}
      {data.top_5_competitors.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Top competitors</p>
          <div className="space-y-1">
            {data.top_5_competitors.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-white dark:bg-neutral-800 rounded px-2 py-1.5 border border-gray-200 dark:border-neutral-700">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-gray-900 dark:text-white truncate">{c.name}</span>
                  <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {Number(c.approximate_rating).toFixed(1)} ★ · {c.approximate_review_count} reviews · {c.location_status}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <button
                    onClick={() => handleAddToQueue(i)}
                    disabled={queueingIdx !== null || queuedFeedback[i] === 'queued'}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-900/40 disabled:opacity-50"
                    title={queuedFeedback[i] === 'queued' ? 'Added to queue' : `Add ${c.name} to the prospect queue for later`}
                  >
                    {queueingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : queuedFeedback[i] === 'queued' ? <Check className="w-3 h-3 text-green-600" /> : <Inbox className="w-3 h-3" />}
                    {queuedFeedback[i] === 'queued' ? 'Queued' : 'Queue'}
                  </button>
                  {queuedFeedback[i] === 'already' && (
                    <span className="text-[10px] text-slate-400" title="Already in the queue">already queued</span>
                  )}
                  {queuedFeedback[i] === 'exists' && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400" title="A campaign already exists for this business">campaign exists</span>
                  )}
                  <button
                    onClick={() => handleDeriveFromCompetitor(i)}
                    disabled={derivingIdx !== null}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800 dark:hover:bg-violet-900/40 disabled:opacity-50"
                    title={`Create a business-scope campaign for ${c.name}`}
                  >
                    {derivingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Campaign
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pain points + opportunity gaps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {data.common_pain_points.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Common pain points</p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-0.5">
              {data.common_pain_points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
        {data.opportunity_gaps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Opportunity gaps</p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-0.5">
              {data.opportunity_gaps.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Outreach angle */}
      <div className="mb-4 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-3">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Recommended outreach angle</p>
        <p className="text-sm text-gray-900 dark:text-white">{data.recommended_outreach_angle}</p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleCopyAngle}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
        >
          {copiedAngle ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedAngle ? 'Copied!' : 'Copy angle'}
        </button>
        <button
          onClick={handleSaveToNotes}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
        >
          <StickyNote className="w-3.5 h-3.5" />
          {savedNotes ? 'Saved!' : 'Save to notes'}
        </button>
        <button
          onClick={() => setShowCustomDerive((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-700 bg-white border border-violet-300 rounded-lg hover:bg-violet-50 dark:bg-neutral-800 dark:text-violet-300 dark:border-violet-800 dark:hover:bg-violet-900/20"
        >
          <Plus className="w-3.5 h-3.5" />
          {showCustomDerive ? 'Cancel' : 'Business campaign…'}
        </button>
        <Link
          href={seekPromptHref}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Create seek prompt
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Custom business-name derive form */}
      {showCustomDerive && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Business name (e.g. Acme HVAC)"
            className="flex-1 min-w-[200px] px-3 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            onKeyDown={(e) => { if (e.key === 'Enter') handleDeriveCustom(); }}
          />
          <button
            onClick={handleDeriveCustom}
            disabled={derivingCustom || !customName.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {derivingCustom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
            Create
          </button>
          <button
            onClick={() => { setShowCustomDerive(false); setCustomName(''); setDeriveError(null); }}
            className="inline-flex items-center px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Derive error */}
      {deriveError && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{deriveError}</p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
