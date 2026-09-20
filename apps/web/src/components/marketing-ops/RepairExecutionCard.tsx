'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowUpRight, CheckCircle, Clock, Copy, ExternalLink,
  Loader2, Package, Pencil, ShieldCheck, X,
} from 'lucide-react';
import marketingOpsService, {
  Campaign, RepairExecutionReadModel, RepairPlatformStatusEntry,
} from '@/services/MarketingOpsService';
import { isWebsiteGapCampaign } from './repairCampaignGate';
import {
  ESCALATABLE_STATUSES, REPAIR_PLATFORM_LABELS, REPAIR_PLATFORM_STATUSES,
  REPAIR_STATUS_LABELS, REPAIR_TIER_CATALOG, RepairMode, RepairPlatform,
  RepairPlatformStatus, RepairTier, TRACK_B_ISSUE_TYPES,
} from '@/lib/repairTiers';

interface RepairExecutionCardProps {
  campaign: Campaign;
  onRefresh: () => void;
}

const ALL_PLATFORMS: RepairPlatform[] = ['google', 'facebook', 'yelp', 'bbb', 'apple_maps', 'bing_places'];

function statusChip(status: string): string {
  switch (status) {
    case 'verified':
    case 'done':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'escalated':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'blocked':
    case 'customer_reported':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'in_progress':
    case 'access_granted':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'not_applicable':
      return 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-400';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  }
}

export default function RepairExecutionCard({ campaign, onRefresh }: RepairExecutionCardProps) {
  const [execution, setExecution] = useState<RepairExecutionReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Package config (W2) state
  const [editingConfig, setEditingConfig] = useState(false);
  const [cfgTier, setCfgTier] = useState<RepairTier>('standard');
  const [cfgMode, setCfgMode] = useState<RepairMode>('diy');
  const [cfgPlatforms, setCfgPlatforms] = useState<RepairPlatform[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [accessLink, setAccessLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Escalation modal state
  const [escalatingPlatform, setEscalatingPlatform] = useState<string | null>(null);
  const [escIssueType, setEscIssueType] = useState<string>(TRACK_B_ISSUE_TYPES[0].value);
  const [escNotes, setEscNotes] = useState('');
  const [escSubmitting, setEscSubmitting] = useState(false);
  const [escResult, setEscResult] = useState<{ siblingId: string } | null>(null);

  // Inline platform-status edits
  const [updatingPlatform, setUpdatingPlatform] = useState<string | null>(null);

  const isProfileRepair = campaign.campaign_category === 'profile_repair' && !isWebsiteGapCampaign(campaign);

  const fetchExecution = async () => {
    setLoading(true);
    try {
      const data = await marketingOpsService.getRepairExecution(campaign.id);
      setExecution(data);
    } catch {
      // Non-404 errors surface silently — the card shows configuration state
      // via campaign.repair_fulfillment instead.
      setExecution(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isProfileRepair) fetchExecution();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, isProfileRepair, campaign.repair_fulfillment]);

  if (!isProfileRepair) return null;

  const fulfillment = execution?.repair_fulfillment ?? campaign.repair_fulfillment ?? null;
  const configured = !!(fulfillment && (fulfillment.tier || fulfillment.mode));
  const modeLocked = !!execution?.access_collected_at;
  const platformStatus = execution?.platform_status ?? fulfillment?.platform_status ?? {};

  const openConfigEditor = () => {
    const tier = (fulfillment?.tier as RepairTier) || 'standard';
    setCfgTier(tier);
    setCfgMode((fulfillment?.mode as RepairMode) || 'diy');
    setCfgPlatforms((fulfillment?.platforms as RepairPlatform[]) || [...REPAIR_TIER_CATALOG[tier].platforms]);
    setEditingConfig(true);
    setError(null);
  };

  const handleSaveConfig = async () => {
    if (cfgPlatforms.length === 0) {
      setError('Select at least one platform');
      return;
    }
    setSavingConfig(true);
    setError(null);
    try {
      const result = await marketingOpsService.patchRepairFulfillment(campaign.id, {
        tier: cfgTier,
        mode: cfgMode,
        platforms: cfgPlatforms,
      });
      if (result.access_intake?.shortUrl) setAccessLink(result.access_intake.shortUrl);
      setEditingConfig(false);
      await fetchExecution();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to save package configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleStatusChange = async (platform: string, status: string) => {
    setUpdatingPlatform(platform);
    setError(null);
    try {
      await marketingOpsService.updateRepairPlatformStatus(campaign.id, platform, { status });
      await fetchExecution();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to update platform status');
    } finally {
      setUpdatingPlatform(null);
    }
  };

  const handleEscalate = async () => {
    if (!escalatingPlatform) return;
    setEscSubmitting(true);
    setError(null);
    try {
      const result = await marketingOpsService.escalateRepairPlatform(campaign.id, escalatingPlatform, {
        issue_type: escIssueType,
        notes: escNotes || undefined,
      });
      setEscResult({ siblingId: result.sibling.id });
      setEscalatingPlatform(null);
      await fetchExecution();
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to escalate platform');
      setEscalatingPlatform(null);
    } finally {
      setEscSubmitting(false);
    }
  };

  const handleCopyAccessLink = async () => {
    const link = accessLink || execution?.access_intake?.short_url;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // textarea-free clipboard fallback — ignore
    }
  };

  const slaOverdue = execution?.sla_due_at && new Date(execution.sla_due_at).getTime() < Date.now();
  const platforms = (execution?.platforms?.length ? execution.platforms : fulfillment?.platforms) || [];

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Repair Package Execution</h3>
          {fulfillment?.tier && (
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 uppercase">
              {REPAIR_TIER_CATALOG[fulfillment.tier as RepairTier]?.label ?? fulfillment.tier}
              {fulfillment.mode ? ` · ${fulfillment.mode.toUpperCase()}` : ''}
            </span>
          )}
        </div>
        {configured && !editingConfig && (
          <button
            onClick={openConfigEditor}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
          >
            <Pencil className="w-3 h-3" />
            Configure
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading execution state...
        </div>
      ) : !configured || editingConfig ? (
        /* ── Package configuration (W2) ───────────────────────────────── */
        <div className="space-y-3">
          {!configured && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No repair package configured yet. Choose a tier, delivery mode, and platform scope.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Tier</label>
              <select
                value={cfgTier}
                onChange={(e) => {
                  const tier = e.target.value as RepairTier;
                  setCfgTier(tier);
                  setCfgPlatforms([...REPAIR_TIER_CATALOG[tier].platforms]);
                }}
                className="w-full text-xs rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 px-2.5 py-1.5"
              >
                {Object.values(REPAIR_TIER_CATALOG).map((t) => (
                  <option key={t.tier} value={t.tier}>
                    {t.label} — {t.slaHours}h SLA{t.diyPriceCents ? ` · DIY $${t.diyPriceCents / 100}` : ''} · DFY ${t.dfyPriceCents / 100}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                Mode {modeLocked && <span className="text-amber-600">(locked — access collected)</span>}
              </label>
              <select
                value={cfgMode}
                disabled={modeLocked}
                onChange={(e) => setCfgMode(e.target.value as RepairMode)}
                className="w-full text-xs rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 disabled:opacity-50"
              >
                <option value="diy">DIY — customer applies fixes</option>
                <option value="dfy">DFY — operator applies fixes</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">Platforms</label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_PLATFORMS.map((p) => {
                const inTier = REPAIR_TIER_CATALOG[cfgTier].platforms.includes(p);
                const selected = cfgPlatforms.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!inTier}
                    onClick={() =>
                      setCfgPlatforms((prev) =>
                        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                      )
                    }
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                      selected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : inTier
                          ? 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-neutral-600 hover:border-indigo-400'
                          : 'bg-gray-50 dark:bg-neutral-800 text-gray-400 border-gray-200 dark:border-neutral-700 cursor-not-allowed'
                    }`}
                  >
                    {REPAIR_PLATFORM_LABELS[p]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
              Apple Maps and Bing Places require the Premium tier.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            {editingConfig && (
              <button
                onClick={() => setEditingConfig(false)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg"
            >
              {savingConfig && <Loader2 className="w-3 h-3 animate-spin" />}
              Save Package
            </button>
          </div>
        </div>
      ) : (
        /* ── Execution read model (W7a) ───────────────────────────────── */
        <div className="space-y-4">
          {/* SLA + seed row */}
          <div className="flex flex-wrap gap-3 text-xs">
            {execution?.sla_due_at && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
                slaOverdue
                  ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-gray-50 text-gray-700 dark:bg-neutral-700 dark:text-gray-300'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                SLA due {new Date(execution.sla_due_at).toLocaleString()}
                {slaOverdue && <span className="font-semibold">(overdue)</span>}
              </div>
            )}
            {execution?.seed && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-700 dark:bg-neutral-700 dark:text-gray-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                Seed {execution.seed.link_role} ·{' '}
                {execution.seed.seed_claimed
                  ? `claimed ${execution.seed.claimed_at ? new Date(execution.seed.claimed_at).toLocaleDateString() : ''}`
                  : 'unclaimed'}
                {execution.seed.nap_match_confidence && ` · NAP match: ${execution.seed.nap_match_confidence}`}
              </div>
            )}
          </div>

          {/* Canonical NAP */}
          {execution?.canonical_nap && (
            <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Canonical NAP (owner-confirmed)</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {execution.canonical_nap.business_name && <span className="font-medium">{execution.canonical_nap.business_name} · </span>}
                {[execution.canonical_nap.address, execution.canonical_nap.city, execution.canonical_nap.state, execution.canonical_nap.zip]
                  .filter(Boolean).join(', ')}
                {execution.canonical_nap.phone && ` · ${execution.canonical_nap.phone}`}
                {execution.canonical_nap.website && ` · ${execution.canonical_nap.website}`}
              </p>
            </div>
          )}

          {/* Access intake (DFY) */}
          {fulfillment?.mode === 'dfy' && (
            <div className={`rounded-lg border p-3 ${
              execution?.access_collected_at
                ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-900/10'
                : 'border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-900/10'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                  Delegated-access intake
                  {execution?.access_intake && (
                    <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                      {execution.access_intake.viewed_count} view{execution.access_intake.viewed_count === 1 ? '' : 's'}
                      {execution.access_intake.submitted_at
                        ? ` · submitted ${new Date(execution.access_intake.submitted_at).toLocaleString()}`
                        : ' · not submitted'}
                      {execution.access_intake.attachment_count > 0 &&
                        ` · ${execution.access_intake.attachment_count} attachment${execution.access_intake.attachment_count === 1 ? '' : 's'}`}
                    </span>
                  )}
                </p>
                {(accessLink || execution?.access_intake?.short_url) && (
                  <button
                    onClick={handleCopyAccessLink}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-white/70 dark:bg-neutral-800 rounded-md border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-50"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedLink ? 'Copied!' : 'Copy link'}
                  </button>
                )}
              </div>
              {execution?.access_collected_at && (
                <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Access collected {new Date(execution.access_collected_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Escalation result banner */}
          {escResult && (
            <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50/60 dark:border-purple-800/50 dark:bg-purple-900/10 px-3 py-2">
              <p className="text-[11px] text-purple-700 dark:text-purple-300">
                Track B sibling created: <span className="font-mono">{escResult.siblingId}</span>
              </p>
              <div className="flex items-center gap-1">
                <a
                  href={`/settings/admin/marketing-ops/campaigns/${escResult.siblingId}`}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 hover:underline"
                >
                  Open <ArrowUpRight className="w-3 h-3" />
                </a>
                <button onClick={() => setEscResult(null)} className="p-1 text-purple-400 hover:text-purple-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* Per-platform status table (W7a/W7b) */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">Platform status</p>
            <div className="divide-y divide-gray-100 dark:divide-neutral-700 rounded-lg border border-gray-200 dark:border-neutral-700">
              {platforms.map((platform) => {
                const entry: RepairPlatformStatusEntry = platformStatus[platform] || { status: 'in_progress' };
                const escalatedId = entry.escalated_campaign_id;
                return (
                  <div key={platform} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-32 shrink-0 text-xs font-medium text-gray-700 dark:text-gray-300">
                      {REPAIR_PLATFORM_LABELS[platform as RepairPlatform] ?? platform}
                    </span>
                    {entry.status === 'escalated' ? (
                      <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${statusChip('escalated')}`}>
                        Escalated (Track B)
                      </span>
                    ) : (
                      <select
                        value={entry.status}
                        disabled={updatingPlatform === platform}
                        onChange={(e) => handleStatusChange(platform, e.target.value)}
                        className={`text-[11px] font-medium rounded-full border-0 px-2 py-0.5 cursor-pointer ${statusChip(entry.status)}`}
                      >
                        {REPAIR_PLATFORM_STATUSES.filter((s) => s !== 'escalated').map((s) => (
                          <option key={s} value={s}>{REPAIR_STATUS_LABELS[s as RepairPlatformStatus]}</option>
                        ))}
                      </select>
                    )}
                    {updatingPlatform === platform && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                    <div className="flex-1" />
                    {entry.verified_at && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        verified {new Date(entry.verified_at).toLocaleDateString()}
                      </span>
                    )}
                    {escalatedId ? (
                      <a
                        href={`/settings/admin/marketing-ops/campaigns/${escalatedId}`}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        {escalatedId} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      ESCALATABLE_STATUSES.has(entry.status as RepairPlatformStatus) && (
                        <button
                          onClick={() => {
                            setEscalatingPlatform(platform);
                            setEscIssueType(TRACK_B_ISSUE_TYPES[0].value);
                            setEscNotes(entry.note || '');
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Escalate to Track B
                        </button>
                      )
                    )}
                  </div>
                );
              })}
              {platforms.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-400">No platforms in scope.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Escalation modal (W7c) ─────────────────────────────────────── */}
      {escalatingPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-5 shadow-xl">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Escalate {REPAIR_PLATFORM_LABELS[escalatingPlatform as RepairPlatform] ?? escalatingPlatform} to Track B
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Creates a sibling campaign in the recovery pipeline. The parent campaign and its remaining platforms stay active; the sibling inherits the audit and triage context.
            </p>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Issue type</label>
            <select
              value={escIssueType}
              onChange={(e) => setEscIssueType(e.target.value)}
              className="w-full mb-3 text-xs rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 px-2.5 py-1.5"
            >
              {TRACK_B_ISSUE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={escNotes}
              onChange={(e) => setEscNotes(e.target.value)}
              rows={3}
              placeholder="What the Track B operator needs to know..."
              className="w-full mb-4 text-xs rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300 px-2.5 py-2 resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEscalatingPlatform(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEscalate}
                disabled={escSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg"
              >
                {escSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                Escalate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
