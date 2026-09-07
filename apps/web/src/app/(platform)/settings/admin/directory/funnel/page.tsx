'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  type CohortFunnelResponse,
  type CohortFunnelReport,
  type GateResult,
  type CohortFunnelMetrics,
  type PotentialDuplicateSeed,
} from '@/services/DirectoryPresenceAdminService';
import { TrendingUp, Funnel, AlertTriangle, CheckCircle, XCircle, MinusCircle, Download, Link2, Unlink, Loader2, FlaskConical } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function SeedFunnelPage() {
  const [report, setReport] = useState<CohortFunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    category: '',
    city: '',
    state: '',
    focus: '',
  });

  const fetchFunnel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cleanFilters: Record<string, string> = {};
      if (filters.category.trim()) cleanFilters.category = filters.category.trim();
      if (filters.city.trim()) cleanFilters.city = filters.city.trim();
      if (filters.state.trim()) cleanFilters.state = filters.state.trim();
      if (filters.focus.trim()) cleanFilters.focus = filters.focus.trim();
      const data = await directoryPresenceAdminService.getCohortFunnel(cleanFilters);
      setReport(data);
    } catch (err: any) {
      setError(err?.message || 'failed_to_load');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchFunnel();
  }, [fetchFunnel]);

  const [verdictBusy, setVerdictBusy] = useState<string | null>(null);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFunnel();
  };

  // Dedup verdict — same as the proving-ground cockpit's panel: records a
  // same_entity/distinct verdict on the group; resolved groups drop out of
  // duplicateSeedCount on the next fetch (Migration 262, spec §4.9).
  const handleVerdict = async (group: PotentialDuplicateSeed, verdict: 'same_entity' | 'distinct') => {
    const key = group.seedIds.join(',');
    setVerdictBusy(key);
    try {
      await directoryPresenceAdminService.recordDedupVerdict({
        seedIds: group.seedIds,
        matchKey: group.matchKey,
        verdict,
        mergeInto: verdict === 'same_entity' ? group.seedIds[0] : undefined,
      });
      await fetchFunnel();
    } catch (err: any) {
      setError(err?.message || 'Failed to record verdict');
    } finally {
      setVerdictBusy(null);
    }
  };

  if (loading && !report) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Seed Funnel" description="Benchmark gates and cohort analytics" />
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading funnel analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Seed Funnel" description="Benchmark gates and cohort analytics" />
        <div className="py-12 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchFunnel}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader title="Seed Funnel" description="Benchmark gates and cohort analytics (spec §6, §10)" />

      <div className="mb-6 flex items-center gap-3 text-sm">
        <Link href="/settings/admin/directory" className="text-blue-600 hover:underline">
          ← Directory Panel
        </Link>
        <span className="text-gray-400">|</span>
        <Link href="/settings/admin/directory/presence-seeds" className="text-blue-600 hover:underline">
          Presence Seeds →
        </Link>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilterSubmit} className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
            <input
              type="text"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              placeholder="e.g. Indian Grocery"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">City</label>
            <input
              type="text"
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              placeholder="e.g. Madison"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">State</label>
            <input
              type="text"
              value={filters.state}
              onChange={(e) => setFilters({ ...filters, state: e.target.value })}
              placeholder="e.g. WI"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Focus</label>
            <select
              value={filters.focus}
              onChange={(e) => setFilters({ ...filters, focus: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Any</option>
              <option value="emerging">Emerging</option>
              <option value="competitive">Competitive</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Apply Filters'}
          </button>
        </div>
      </form>

      {report && (
        <>
          {/* Combined Summary */}
          <FunnelSummaryCard report={report.combined} title="Combined Cohort" />

          {/* Funnel Stages Bar */}
          <FunnelBar metrics={report.combined.metrics} />

          {/* Scaling Readiness */}
          <ScalingReadinessCard
            citiesPassing={report.scalingReadiness.citiesPassing}
            categoriesPassing={report.scalingReadiness.categoriesPassing}
            ruleMet={report.scalingReadiness.ruleMet}
            note={report.scalingReadiness.note}
            medianDaysToClaim={report.medianDaysToClaim}
          />

          {/* Per-Campaign Cohorts */}
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Per-Campaign Cohorts</h2>
          </div>
          {report.cohorts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-8 text-center">
              <Funnel className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                No cohorts match the current filters. Cohorts appear once seeds are linked to a
                campaign — typically via a proving ground's preflight seeding step.
              </p>
              <div className="flex items-center justify-center gap-3 text-sm">
                <Link
                  href="/settings/admin/marketing-ops/proving-grounds"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  Proving Grounds
                </Link>
                <Link
                  href="/settings/admin/directory/presence-seeds"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                >
                  Presence Seeds →
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 mb-8">
              {report.cohorts.map((cohort) => (
                <CohortCard key={cohort.cohortKey} cohort={cohort} />
              ))}
            </div>
          )}

          {/* Category Rollups */}
          {report.categoryRollups.length > 0 && (
            <>
              <div className="mb-4 mt-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Category Rollups</h2>
              </div>
              <div className="space-y-4 mb-8">
                {report.categoryRollups.map((rollup) => (
                  <CohortCard
                    key={`cat-${rollup.category}`}
                    cohort={{
                      cohortKey: rollup.category,
                      metrics: rollup.metrics,
                      gates: rollup.gates,
                      grade: rollup.grade,
                      deferredGates: [],
                      conversionScoreBreakdown: rollup.conversionScoreBreakdown,
                      category: rollup.category,
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Duplicate Detection */}
          {report.duplicateSeedCount > 0 && (
            <div className="mt-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
                  Potential Duplicate Seeds ({report.duplicateSeedCount})
                </h2>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                Detection-only — no auto-merge. Record a verdict to resolve each group; resolved
                groups drop out of this count (spec §3.1 / §4.9).
              </p>
              <div className="space-y-2">
                {report.potentialDuplicateSeeds.map((dup, i) => {
                  const key = dup.seedIds.join(',');
                  return (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <span className="text-xs font-medium text-amber-600 uppercase">{dup.matchKey}</span>
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            {dup.names.join(' ↔ ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex gap-1 mr-2">
                            {dup.seedIds.map((sid) => (
                              <Link
                                key={sid}
                                href={`/settings/admin/directory/presence-seeds/${sid}`}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {sid.slice(0, 8)}…
                              </Link>
                            ))}
                          </div>
                          <button
                            onClick={() => handleVerdict(dup, 'same_entity')}
                            disabled={verdictBusy === key}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                            title="Same entity — merges identity into the first seed"
                          >
                            {verdictBusy === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                            Same entity
                          </button>
                          <button
                            onClick={() => handleVerdict(dup, 'distinct')}
                            disabled={verdictBusy === key}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 disabled:opacity-50"
                          >
                            <Unlink className="w-3 h-3" />
                            Distinct
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function FunnelSummaryCard({ report, title }: { report: CohortFunnelReport; title: string }) {
  const m = report.metrics;
  const gradeColor =
    report.grade === 'decision_grade'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Funnel className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${gradeColor}`}>
          {report.grade === 'decision_grade' ? 'Decision Grade' : 'Directional'}
        </span>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-3">
        <StatCell label="Seeds" value={m.seeds} />
        <StatCell label="Contactable" value={m.contactable} />
        <StatCell label="Invited" value={m.invited} />
        <StatCell label="Claimed" value={m.claimed} />
        <StatCell label="Claimed 30d" value={m.claimed30d} />
        <StatCell label="NAP Verified" value={m.napVerified} />
        <StatCell label="Converted" value={m.converted} />
        <StatCell label="Retention 90d" value={m.retention90d} />
        <StatCell label="Touches" value={m.touches} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <StatCell
          label="CAC Estimate"
          value={m.cacEstimate !== null ? `$${m.cacEstimate}` : '—'}
          sub="touches × $15 / converted"
        />
        <StatCell
          label="Invite Scan Rate"
          value={m.inviteScanRate !== null ? `${(m.inviteScanRate * 100).toFixed(1)}%` : '—'}
          sub={`${m.inviteScans} scans / ${m.invited} invited`}
        />
        <StatCell
          label="Median Days to Claim"
          value={report.medianDaysToClaim !== null && report.medianDaysToClaim !== undefined ? `${report.medianDaysToClaim}d` : '—'}
        />
        <StatCell
          label="Owner Corrections"
          value={m.ownerCorrected}
          sub="NAP diffs after claim"
        />
      </div>
    </div>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function FunnelBar({ metrics }: { metrics: CohortFunnelMetrics }) {
  const stages = [
    { label: 'Seeds', value: metrics.seeds, color: 'bg-blue-500' },
    { label: 'Contactable', value: metrics.contactable, color: 'bg-indigo-500' },
    { label: 'Invited', value: metrics.invited, color: 'bg-purple-500' },
    { label: 'Claimed', value: metrics.claimed, color: 'bg-pink-500' },
    { label: 'NAP Verified', value: metrics.napVerified, color: 'bg-teal-500' },
    { label: 'Converted', value: metrics.converted, color: 'bg-green-500' },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Funnel Stages</h2>
      <div className="space-y-2">
        {stages.map((stage) => (
          <div key={stage.label} className="flex items-center gap-3">
            <div className="w-28 text-sm text-gray-600 dark:text-gray-400 text-right">{stage.label}</div>
            <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-7 relative overflow-hidden">
              <div
                className={`${stage.color} h-full rounded-full transition-all flex items-center justify-end pr-2`}
                style={{ width: `${Math.max((stage.value / max) * 100, 2)}%` }}
              >
                <span className="text-xs font-medium text-white">{stage.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScalingReadinessCard({
  citiesPassing,
  categoriesPassing,
  ruleMet,
  note,
  medianDaysToClaim,
}: {
  citiesPassing: string[];
  categoriesPassing: string[];
  ruleMet: boolean;
  note: string;
  medianDaysToClaim: number | null;
}) {
  return (
    <div
      className={`mb-6 rounded-xl shadow border p-6 ${
        ruleMet
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className={`w-5 h-5 ${ruleMet ? 'text-green-600' : 'text-gray-500'}`} />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Scaling Readiness</h2>
        {ruleMet ? (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Ready
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            Not Yet
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{note}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cities Passing</div>
          {citiesPassing.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {citiesPassing.map((c) => (
                <span key={c} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-gray-400">None yet</span>
          )}
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Categories Passing</div>
          {categoriesPassing.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {categoriesPassing.map((c) => (
                <span key={c} className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-gray-400">None yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CohortCard({ cohort }: { cohort: CohortFunnelReport }) {
  const m = cohort.metrics;
  const gradeColor =
    cohort.grade === 'decision_grade'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {cohort.campaignId ? (
              <Link
                href={`/settings/admin/marketing-ops/campaigns/${cohort.campaignId}`}
                className="hover:underline hover:text-blue-600 dark:hover:text-blue-400"
                title="Open campaign"
              >
                {cohort.displayId || cohort.cohortKey}
              </Link>
            ) : (
              cohort.displayId || cohort.cohortKey
            )}
          </h3>
          {cohort.category && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {cohort.category}
              {cohort.city ? ` · ${cohort.city}` : ''}
              {cohort.focus ? ` · ${cohort.focus}` : ''}
            </p>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gradeColor}`}>
          {cohort.grade === 'decision_grade' ? 'Decision' : 'Directional'}
        </span>
      </div>

      {/* Gate badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {cohort.gates.map((gate) => (
          <GateBadge key={gate.gate} gate={gate} />
        ))}
        {cohort.deferredGates.map((dg) => (
          <span
            key={dg.gate}
            className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            title={dg.reason}
          >
            {dg.gate} (deferred)
          </span>
        ))}
      </div>

      {/* Compact metrics row */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-center">
        <MiniStat label="Seeds" value={m.seeds} />
        <MiniStat label="Contactable" value={m.contactable} />
        <MiniStat label="Invited" value={m.invited} />
        <MiniStat label="Claimed" value={m.claimed} />
        <MiniStat label="NAP" value={m.napVerified} />
        <MiniStat label="Converted" value={m.converted} />
        <MiniStat label="Touches" value={m.touches} />
        <MiniStat
          label="CAC"
          value={m.cacEstimate !== null ? `$${m.cacEstimate}` : '—'}
        />
      </div>

      {/* Conversion score breakdown */}
      {cohort.conversionScoreBreakdown && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Conversion Score (threshold: {cohort.conversionScoreBreakdown.threshold})
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { label: 'S1 Paid', value: cohort.conversionScoreBreakdown.s1 },
              { label: 'S2 BSaaS', value: cohort.conversionScoreBreakdown.s2 },
              { label: 'S3 Revenue', value: cohort.conversionScoreBreakdown.s3 },
              { label: 'S4 Orders', value: cohort.conversionScoreBreakdown.s4 },
              { label: 'W1 Stock', value: cohort.conversionScoreBreakdown.w1 },
              { label: 'W2 Login', value: cohort.conversionScoreBreakdown.w2 },
              { label: 'W3 Storefront', value: cohort.conversionScoreBreakdown.w3 },
              { label: 'W4 GBP', value: cohort.conversionScoreBreakdown.w4 },
            ].map((sig) => (
              <span
                key={sig.label}
                className={`px-1.5 py-0.5 text-[10px] rounded ${
                  sig.value > 0
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                }`}
              >
                {sig.label}: {sig.value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GateBadge({ gate }: { gate: GateResult }) {
  const icon =
    gate.pass === true ? (
      <CheckCircle className="w-3 h-3" />
    ) : gate.pass === false ? (
      <XCircle className="w-3 h-3" />
    ) : (
      <MinusCircle className="w-3 h-3" />
    );

  const color =
    gate.pass === true
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : gate.pass === false
        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';

  const valueStr = gate.value !== null ? `${(gate.value * 100).toFixed(0)}%` : 'n/a';
  const thresholdStr = `${(gate.threshold * 100).toFixed(0)}%`;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${color}`}
      title={`${gate.description}: ${valueStr} vs ${thresholdStr} threshold`}
    >
      {icon}
      {gate.gate.replace(/_/g, ' ')}
      <span className="font-mono text-[10px] opacity-75">
        {valueStr}/{thresholdStr}
      </span>
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{value}</div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}
