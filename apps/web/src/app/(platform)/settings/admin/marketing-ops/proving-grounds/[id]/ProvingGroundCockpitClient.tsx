'use client';

/**
 * Proving Ground cockpit (Migration 262, spec §4.10).
 *
 * The PG-01 checklist + the worklist surface the day-to-day; the cockpit is
 * the launch operator's system-state overview: G1–G4 gates, preflight
 * progress, due-today, mid-run gap log, tree children, and the dedup
 * resolution panel (preflight step 1 — duplicateSeedCount must reach 0).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Loader2, RefreshCw, X, ListChecks, GitBranch, AlertTriangle,
  ExternalLink, CheckCircle2, Circle, Link2, Unlink, Phone,
} from 'lucide-react';
import marketingOpsService, {
  type CampaignDetail,
  type CampaignLineageEntry,
  type ProspectQueueEntry,
} from '@/services/MarketingOpsService';
import directoryPresenceAdminService, {
  type CohortFunnelResponse,
  type PotentialDuplicateSeed,
} from '@/services/DirectoryPresenceAdminService';
import CampaignChecklistTab from '@/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignChecklistTab';

interface Props {
  campaignId: string;
}

const GATE_LABELS: Record<string, string> = {
  G1: 'Trust',
  G2: 'Contact',
  G3: 'Claim',
  G4: 'Convert',
};

function gateChip(pass: boolean | null): string {
  if (pass === true) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (pass === false) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-gray-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-400';
}

export default function ProvingGroundCockpitClient({ campaignId }: Props) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [children, setChildren] = useState<CampaignLineageEntry[]>([]);
  const [funnel, setFunnel] = useState<CohortFunnelResponse | null>(null);
  const [dueToday, setDueToday] = useState<ProspectQueueEntry[]>([]);
  const [attachable, setAttachable] = useState<CampaignLineageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attachId, setAttachId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [verdictBusy, setVerdictBusy] = useState<string | null>(null);

  const treeIds = useMemo(
    () => [campaignId, ...children.map((c) => c.id)],
    [campaignId, children],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const camp = await marketingOpsService.getCampaign(campaignId);
      setCampaign(camp);
      const childList = camp.children ?? [];
      setChildren(childList);
      const ids = [campaignId, ...childList.map((c) => c.id)];
      const [funnelReport, queue] = await Promise.all([
        directoryPresenceAdminService.getCohortFunnel({ campaignIds: ids }),
        marketingOpsService.listProspectQueue({
          source_campaign_ids: ids,
          status: ['queued', 'in_thread', 'hold'],
          limit: 200,
        }),
      ]);
      setFunnel(funnelReport);
      const sorted = queue.entries
        .filter((e) => e.seed_id && e.next_touch_at)
        .sort((a, b) => new Date(a.next_touch_at!).getTime() - new Date(b.next_touch_at!).getTime());
      setDueToday(sorted.slice(0, 10));

      // Attachable = unparented intelligence campaigns.
      const intel = await marketingOpsService.listCampaigns({ scope: 'intelligence', limit: 100 });
      setAttachable(
        intel.items
          .filter((c) => !c.parent_campaign_id && !ids.includes(c.id))
          .map((c) => ({ id: c.id, title: c.title, business_name: c.business_name, scope: c.scope, stage: c.stage, category: c.category, city: c.city })),
      );
    } catch (err: any) {
      setError(err.message || 'Failed to load proving ground');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const handleAttach = async () => {
    if (!attachId) return;
    setAttaching(true);
    try {
      await marketingOpsService.attachProvingGroundChild(campaignId, attachId);
      setAttachId('');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to attach child');
    } finally {
      setAttaching(false);
    }
  };

  const handleDetach = async (childId: string) => {
    try {
      await marketingOpsService.detachProvingGroundChild(campaignId, childId);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to detach child');
    }
  };

  const handleVerdict = async (group: PotentialDuplicateSeed, verdict: 'same_entity' | 'distinct') => {
    const key = group.seedIds.join(',');
    setVerdictBusy(key);
    setError(null);
    try {
      await directoryPresenceAdminService.recordDedupVerdict({
        seedIds: group.seedIds,
        matchKey: group.matchKey,
        verdict,
        mergeInto: verdict === 'same_entity' ? group.seedIds[0] : undefined,
      });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to record verdict');
    } finally {
      setVerdictBusy(null);
    }
  };

  if (loading && !campaign) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading proving ground…
      </div>
    );
  }

  if (!campaign) {
    return <div className="text-sm text-red-600 dark:text-red-400 py-8">{error ?? 'Campaign not found'}</div>;
  }

  const combined = funnel?.combined;
  const gates = combined?.gates ?? [];
  const dupGroups = funnel?.potentialDuplicateSeeds ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {campaign.title || `${campaign.category ?? 'Proving Ground'} · ${campaign.city ?? ''}`}
              </h1>
              <span className="rounded bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold uppercase">
                proving ground
              </span>
              <span className="rounded bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300 px-2 py-0.5 text-[10px] font-medium">
                {campaign.stage}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {[campaign.category, campaign.city, campaign.state].filter(Boolean).join(' · ')}
              {' '}· {children.length} intelligence campaign{children.length !== 1 ? 's' : ''} attached
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings/admin/marketing-ops/queue"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
            >
              <Phone className="w-3.5 h-3.5" />
              Open Worklist
            </Link>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Gate chips */}
        {gates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-neutral-700">
            {gates.map((g) => (
              <span
                key={g.gate}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium ${gateChip(g.pass)}`}
                title={`${g.description} — value ${g.value ?? 'n/a'} vs threshold ${g.threshold}`}
              >
                {g.pass === true ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                {g.gate} {GATE_LABELS[g.gate] ? `· ${GATE_LABELS[g.gate]}` : ''}
              </span>
            ))}
            <span className="text-[10px] text-gray-400 ml-1">
              {combined?.grade === 'decision_grade' ? 'decision-grade' : 'directional'} grade
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-2 text-sm text-red-800 dark:text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Funnel metrics + due-today */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4" /> Tree funnel (combined)
          </h2>
          {combined ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Seeds', combined.metrics.seeds],
                ['Verified', combined.metrics.verified],
                ['Touches', combined.metrics.touches],
                ['Invites', combined.metrics.invitesSent],
                ['Claimed', combined.metrics.claimed],
                ['CAC est.', combined.metrics.cacEstimate != null ? `$${combined.metrics.cacEstimate.toFixed(0)}` : '—'],
              ].map(([label, val]) => (
                <div key={label as string} className="rounded-lg bg-gray-50 dark:bg-neutral-700/30 px-2 py-2">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{val}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No funnel data — link seeds via the preflight seeding step.</p>
          )}
          {funnel && (
            <p className="text-[10px] text-gray-400 mt-2">
              {funnel.duplicateSeedCount} unresolved duplicate group{funnel.duplicateSeedCount !== 1 ? 's' : ''}
              {combined?.medianDaysToClaim != null && ` · median ${combined.medianDaysToClaim}d to claim`}
            </p>
          )}
        </div>

        {/* Due today */}
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <ListChecks className="w-4 h-4" /> Due today
          </h2>
          {dueToday.length === 0 ? (
            <p className="text-xs text-gray-400">Nothing due — seed prospects from preflight step 2 to populate the worklist.</p>
          ) : (
            <ul className="space-y-1.5">
              {dueToday.map((e) => {
                const due = e.next_touch_at ? new Date(e.next_touch_at).getTime() <= Date.now() : false;
                return (
                  <li key={e.id} className="flex items-center justify-between text-xs">
                    <Link href="/settings/admin/marketing-ops/queue" className="text-gray-800 dark:text-gray-200 hover:underline">
                      {e.title || e.business_name || 'prospect'}
                    </Link>
                    <span className={`text-[10px] ${due ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-gray-400'}`}>
                      {due ? '● due now' : e.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Preflight checklist — PG-01 attaches directly, no triage needed */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Preflight checklist (PG-01)</h2>
        <CampaignChecklistTab campaignId={campaignId} currentStage={campaign.stage} />
      </div>

      {/* Duplicate resolution — preflight step 1's data surface */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4" /> Duplicate seed groups
        </h2>
        {dupGroups.length === 0 ? (
          <p className="text-xs text-green-700 dark:text-green-400">
            No unresolved duplicate groups — the funnel identity gate is clean.
          </p>
        ) : (
          <ul className="space-y-2">
            {dupGroups.map((g) => (
              <li key={g.seedIds.join(',')} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2">
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  <span className="font-mono text-[10px] uppercase text-gray-400 mr-2">{g.matchKey}</span>
                  {g.names.join('  ↔  ')}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleVerdict(g, 'same_entity')}
                    disabled={verdictBusy === g.seedIds.join(',')}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                    title="Same entity — merges identity into the first seed"
                  >
                    {verdictBusy === g.seedIds.join(',') ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                    Same entity
                  </button>
                  <button
                    onClick={() => handleVerdict(g, 'distinct')}
                    disabled={verdictBusy === g.seedIds.join(',')}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 disabled:opacity-50"
                  >
                    <Unlink className="w-3 h-3" />
                    Distinct
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Children */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Intelligence campaigns ({children.length})
        </h2>
        {children.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {children.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-xs">
                <Link
                  href={`/settings/admin/marketing-ops/campaigns/${c.id}`}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  {c.title || c.business_name || `${c.category ?? ''} · ${c.city ?? ''}`}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">{c.stage}</span>
                  <button
                    onClick={() => handleDetach(c.id)}
                    className="text-[10px] text-gray-400 hover:text-red-600"
                    title="Detach from this proving ground (breadcrumbs only)"
                  >
                    detach
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <select
            value={attachId}
            onChange={(e) => setAttachId(e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
          >
            <option value="">Attach an unparented intelligence campaign…</option>
            {attachable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title || c.business_name || `${c.category ?? ''} · ${c.city ?? ''}`}
              </option>
            ))}
          </select>
          <button
            onClick={handleAttach}
            disabled={!attachId || attaching}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {attaching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            Attach
          </button>
        </div>
      </div>

      {/* Gap log */}
      {campaign.gap_log && campaign.gap_log.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Gap log</h2>
          <ul className="space-y-1.5">
            {[...campaign.gap_log].reverse().map((g, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2">
                <span className={`mt-0.5 inline-block w-1.5 h-1.5 rounded-full ${
                  g.severity === 'critical' ? 'bg-red-500' : g.severity === 'important' ? 'bg-amber-500' : 'bg-gray-400'
                }`} />
                <span>
                  <span className="text-gray-400">{new Date(g.timestamp).toLocaleDateString()}</span>
                  {' '}<span className="font-medium">[{g.field}]</span> {g.description}
                  <span className="text-gray-400"> — {g.resolver}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
