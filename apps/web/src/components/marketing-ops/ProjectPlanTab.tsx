'use client';

/**
 * ProjectPlanTab — data-loading wrapper for PlanCockpitPanel (sprint 7.3).
 *
 * The plan is prospect-keyed: resolved by the viewed campaign's
 * `business_prospect_id`; a null-prospect campaign fetches itself as a
 * singleton (?campaignId= fallback on the API). Every sibling mounts the
 * same cockpit — it is not a per-campaign artifact.
 *
 * Loads the sibling family too (7.4a) so the prospect strip shows every
 * member with its stage chip, contributing or not.
 *
 * Tab-ready wrapper (proposal spec §18): `window.location.hash` picks the
 * surface — `#plan` today; `#proposal` and `#execution` land here later
 * without restructuring the campaign detail page.
 */

import { useCallback, useEffect, useState } from 'react';
import marketingOpsService from '@/services/MarketingOpsService';
import type { ProjectPhasePlanResponse } from '@/services/MarketingOpsService';
import PlanCockpitPanel, { type PlanSiblingSummary } from './PlanCockpitPanel';
import { Loader2 } from 'lucide-react';

type PlanSurface = 'plan' | 'proposal' | 'execution';

const PLAN_SURFACES: { key: PlanSurface; label: string; live: boolean }[] = [
  { key: 'plan', label: 'Plan', live: true },
  { key: 'proposal', label: 'Proposal', live: false },
  { key: 'execution', label: 'Execution', live: false },
];

export default function ProjectPlanTab({ campaign }: { campaign: any }) {
  const [surface, setSurface] = useState<PlanSurface>('plan');
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace('#', '');
      setSurface((PLAN_SURFACES.some((s) => s.key === h) ? h : 'plan') as PlanSurface);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const [data, setData] = useState<ProjectPhasePlanResponse | null>(null);
  const [siblings, setSiblings] = useState<PlanSiblingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!campaign?.id) return;
    setLoading(true);
    setError(null);
    try {
      const prospectKey = campaign.business_prospect_id ?? campaign.id;
      const [plan, sib] = await Promise.all([
        marketingOpsService.getProjectPlan(
          prospectKey,
          campaign.business_prospect_id ? undefined : campaign.id,
        ),
        marketingOpsService.listSiblings(campaign.id).catch(() => [] as any[]),
      ]);
      setData(plan);
      setSiblings(
        (sib ?? []).map((s: any) => ({
          id: s.id,
          businessName: s.businessName ?? s.business_name ?? null,
          stage: s.stage,
          isPrimarySibling: !!(s.isPrimarySibling ?? s.is_primary_sibling),
          engagementCycle: s.engagementCycle ?? s.engagement_cycle ?? 1,
          archetype: s.archetype ?? null,
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [campaign?.id, campaign?.business_prospect_id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {PLAN_SURFACES.map((s) => (
          <a
            key={s.key}
            href={s.live ? `#${s.key}` : undefined}
            aria-disabled={!s.live}
            className={`px-3 py-1.5 text-xs font-medium -mb-px border-b-2 ${
              surface === s.key
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : s.live
                  ? 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  : 'border-transparent text-gray-300 cursor-not-allowed dark:text-gray-600'
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
      {surface === 'plan' ? (
        loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Computing project plan…
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-400">
            Failed to load the project plan: {error}
            <button type="button" onClick={load} className="ml-2 underline">Retry</button>
          </div>
        ) : data ? (
          <PlanCockpitPanel plan={data.plan} gate={data.gate} siblings={siblings} />
        ) : null
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          The {surface} surface lands in a later sprint — the plan is already loaded beside this slot.
        </div>
      )}
    </div>
  );
}
