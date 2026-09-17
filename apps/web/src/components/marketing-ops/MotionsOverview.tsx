'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, Funnel, Brain, RefreshCw, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import marketingOpsService, { type IntelligenceCoverage } from '@/services/MarketingOpsService';
import directoryPresenceAdminService, { type CohortFunnelResponse } from '@/services/DirectoryPresenceAdminService';

/**
 * MotionsOverview — the dashboard's "what is the module actually doing" row.
 *
 * The legacy dashboard only tracked the prospect-campaign pipeline. The module
 * now runs three distinct motions that never show up in those cards:
 *   1. Proving Grounds  — city/category market-launch workspaces
 *   2. Seed Funnel      — directory-seed GTM + G1–G4 benchmark gates
 *   3. Intelligence     — profile coverage driving discovery/establishment
 *
 * Each card fetches its own summary and deep-links into the owning surface.
 */

type LoadState = 'loading' | 'ready' | 'error';

interface PgSummary {
  total: number;
  markets: number;
}

interface SeedSummary {
  seeds: number;
  claimed: number;
  converted: number;
  grade: 'directional' | 'decision_grade';
  gatesPassed: number;
  gatesTotal: number;
  ruleMet: boolean;
}

interface CoverageSummary {
  categories: number;
  activeProfiles: number;
  discoveryExecuted: number;
  gaps: number;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

export default function MotionsOverview() {
  const [pgState, setPgState] = useState<LoadState>('loading');
  const [pg, setPg] = useState<PgSummary | null>(null);
  const [seedState, setSeedState] = useState<LoadState>('loading');
  const [seed, setSeed] = useState<SeedSummary | null>(null);
  const [covState, setCovState] = useState<LoadState>('loading');
  const [cov, setCov] = useState<CoverageSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    marketingOpsService
      .listCampaigns({ campaignCategory: 'proving_ground', limit: 200 })
      .then(({ items, total }) => {
        if (cancelled) return;
        const markets = new Set(items.map((c) => `${c.city ?? ''},${c.state ?? ''}`)).size;
        setPg({ total: total || items.length, markets });
        setPgState('ready');
      })
      .catch(() => { if (!cancelled) setPgState('error'); });

    directoryPresenceAdminService
      .getCohortFunnel()
      .then((report: CohortFunnelResponse | null) => {
        if (cancelled) return;
        if (!report) { setSeedState('error'); return; }
        const m = report.combined.metrics;
        setSeed({
          seeds: m.seeds,
          claimed: m.claimed,
          converted: m.converted,
          grade: report.combined.grade,
          gatesPassed: report.combined.gates.filter((g) => g.pass === true).length,
          gatesTotal: report.combined.gates.length,
          ruleMet: report.scalingReadiness.ruleMet,
        });
        setSeedState('ready');
      })
      .catch(() => { if (!cancelled) setSeedState('error'); });

    marketingOpsService
      .getIntelligenceCoverage()
      .then((coverage: IntelligenceCoverage) => {
        if (cancelled) return;
        const slots = coverage.categories.flatMap((c) => c.slots);
        setCov({
          categories: coverage.categories.length,
          activeProfiles: slots.filter((s) => s.status === 'active').length,
          discoveryExecuted: slots.filter((s) => s.discovery_status === 'executed').length,
          gaps: slots.filter((s) => s.discovery_status === 'pending').length,
        });
        setCovState('ready');
      })
      .catch(() => { if (!cancelled) setCovState('error'); });

    return () => { cancelled = true; };
  }, []);

  const cards = [
    {
      key: 'pg',
      href: '/settings/admin/marketing-ops/proving-grounds',
      icon: <FlaskConical className="w-5 h-5 text-violet-500" />,
      title: 'Proving Grounds',
      subtitle: 'City/category market launches',
      state: pgState,
      body: pg && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Workspaces" value={pg.total} />
          <Stat label="Markets" value={pg.markets} />
        </div>
      ),
    },
    {
      key: 'seed',
      href: '/settings/admin/directory/funnel',
      icon: <Funnel className="w-5 h-5 text-emerald-500" />,
      title: 'Seed Funnel',
      subtitle: 'Directory-seed GTM + benchmark gates',
      state: seedState,
      body: seed && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Seeds" value={seed.seeds} />
            <Stat label="Claimed" value={seed.claimed} />
            <Stat label="Converted" value={seed.converted} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            {seed.ruleMet ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Scaling rule met
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                <AlertTriangle className="w-3.5 h-3.5" /> {seed.gatesPassed}/{seed.gatesTotal} gates passing
              </span>
            )}
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {seed.grade === 'decision_grade' ? 'Decision grade' : 'Directional'}
            </span>
          </div>
        </>
      ),
    },
    {
      key: 'coverage',
      href: '/settings/admin/marketing-ops/coverage',
      icon: <Brain className="w-5 h-5 text-blue-500" />,
      title: 'Intelligence',
      subtitle: 'Profile coverage across categories',
      state: covState,
      body: cov && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Categories" value={cov.categories} />
            <Stat label="Active profiles" value={cov.activeProfiles} />
            <Stat label="Discovery run" value={cov.discoveryExecuted} />
          </div>
          {cov.gaps > 0 && (
            <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">
              {cov.gaps} discovery gap{cov.gaps === 1 ? '' : 's'} pending
            </p>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Link
          key={card.key}
          href={card.href}
          className="group bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {card.icon}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{card.title}</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{card.subtitle}</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 dark:text-neutral-600 group-hover:text-violet-500 transition-colors" />
          </div>
          {card.state === 'loading' ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : card.state === 'error' ? (
            <p className="py-4 text-sm text-gray-400">Unavailable</p>
          ) : (
            card.body
          )}
        </Link>
      ))}
    </div>
  );
}
