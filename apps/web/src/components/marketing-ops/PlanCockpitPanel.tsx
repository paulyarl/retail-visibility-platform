'use client';

/**
 * PlanCockpitPanel — the operator project-plan view (spec §13, sprint 7.2).
 *
 * Renders the internal plan: header band (tier, cycle, lane, predicate
 * version, source audit, gate badge), the wedge seed card, the
 * public-surfaces strip, and the five-phase board with status / confidence /
 * severity / signal / suppression chips, dependency markers, contributing-
 * sibling links, and collapsed suppressed rows.
 *
 * The prospect-family strip shows EVERY sibling under the
 * business_prospect_id — contributing or not (7.4a). All chips are links or
 * carry state; suppressed regions show counts. Read-only: actions link out
 * to their owning surfaces.
 *
 * Presentational — data loading lives in the tab wrapper; render via
 * renderToStaticMarkup + props in tests (AGENTS.md convention).
 */

import Link from 'next/link';
import { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Users,
  Link2,
  Copy,
  History,
} from 'lucide-react';
import type {
  ProjectPhase,
  ProjectPhasePlan,
  ProjectPhaseGateResult,
  SeedFidelity,
} from '@/services/MarketingOpsService';
import { StageBadge } from './StageBadge';

// ─── Chips ───────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<ProjectPhase['status'], string> = {
  not_started: 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  complete: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const CONFIDENCE_CHIP: Record<ProjectPhase['confidence'], string> = {
  verified: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  suggested: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const SUPPRESSED_CHIP: Record<string, string> = {
  pain_tier_cap: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  capability_disabled: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  not_triggered: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400',
};

const FIDELITY_CHIP: Record<SeedFidelity, string> = {
  aligned: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  thin: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  misaligned: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  unknown: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400',
};

const SEVERITY_LABELS = ['none', 'low', 'moderate', 'high', 'critical'] as const;

/** §6 dependency edges — mirrors PHASE_DEPENDENCIES in the API evaluator. */
const PHASE_DEPENDENCIES: Partial<Record<ProjectPhase['key'], string>> = {
  findability: 'foundation',
};

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────

export interface PlanSiblingSummary {
  id: string;
  businessName: string | null;
  stage: string;
  isPrimarySibling: boolean;
  engagementCycle: number;
  archetype?: string | null;
}

export interface PlanCockpitPanelProps {
  plan: ProjectPhasePlan;
  gate: ProjectPhaseGateResult;
  /** Full sibling family for the prospect — contributing or not (7.4a). */
  siblings?: PlanSiblingSummary[];
}

// ─── Panel ───────────────────────────────────────────────────────────────

export default function PlanCockpitPanel({ plan, gate, siblings = [] }: PlanCockpitPanelProps) {
  const contributing = new Set(plan.phases.flatMap((p) => p.contributingCampaignIds));

  return (
    <div className="space-y-4">
      <PlanHeader plan={plan} gate={gate} />
      <ProspectFamilyStrip plan={plan} siblings={siblings} contributing={contributing} />
      <WedgeCard plan={plan} />
      <SurfacesStrip plan={plan} />
      <PhaseBoard plan={plan} />
      <PriorCycleHistory plan={plan} siblings={siblings} />
    </div>
  );
}

// ─── Header band ─────────────────────────────────────────────────────────

function PlanHeader({ plan, gate }: { plan: ProjectPhasePlan; gate: ProjectPhaseGateResult }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Project Plan</h3>
        <Chip className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
          {plan.estimatedTier ?? 'tier unknown'}
        </Chip>
        <Chip className="bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300">
          cycle {plan.engagementCycle}
        </Chip>
        <Chip
          className={
            plan.lane === 'full'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              : plan.lane === 'partial'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400'
          }
        >
          {plan.lane} lane
        </Chip>
        <Chip className="bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400">
          predicates v{plan.predicateSeedVersion}
        </Chip>
        {gate.passed ? (
          <Chip className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
            <ShieldCheck className="mr-1 h-3 w-3" /> gate passed
          </Chip>
        ) : (
          <Chip className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
            <ShieldAlert className="mr-1 h-3 w-3" /> gate: {gate.issues.length} issue{gate.issues.length === 1 ? '' : 's'}
          </Chip>
        )}
        {plan.sourceAuditId && (
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            source audit <code className="font-mono">{plan.sourceAuditId}</code>
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-400 dark:text-gray-500">
        <span>
          prospect <code className="font-mono">{plan.businessProspectId ?? 'singleton'}</code>
        </span>
        <span>generated {new Date(plan.generatedAt).toLocaleString()}</span>
      </div>
      {!gate.passed && (
        <ul className="mt-2 space-y-0.5 text-xs text-red-600 dark:text-red-400">
          {gate.issues.map((i) => (
            <li key={i}>• {i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Prospect family strip (7.4a) ────────────────────────────────────────

function ProspectFamilyStrip({
  plan,
  siblings,
  contributing,
}: {
  plan: ProjectPhasePlan;
  siblings: PlanSiblingSummary[];
  contributing: Set<string>;
}) {
  // Prefer the richer siblings payload; fall back to contributing ids only.
  const family: PlanSiblingSummary[] =
    siblings.length > 0
      ? siblings
      : [...contributing].map((id) => ({
          id,
          businessName: null,
          stage: 'seed',
          isPrimarySibling: false,
          engagementCycle: plan.engagementCycle,
        }));

  if (family.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Users className="h-3.5 w-3.5" /> Prospect family · {family.length}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {family.map((s) => (
          <Link
            key={s.id}
            href={`/settings/admin/marketing-ops/campaigns/${s.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {s.isPrimarySibling && <span className="text-amber-500" title="Primary sibling">★</span>}
            <span className="max-w-40 truncate">{s.businessName ?? s.id}</span>
            <StageBadge stage={s.stage} />
            {contributing.has(s.id) && (
              <span className="text-emerald-600 dark:text-emerald-400" title="Contributes to the plan">
                <Link2 className="h-3 w-3" />
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Wedge card ──────────────────────────────────────────────────────────

function WedgeCard({ plan }: { plan: ProjectPhasePlan }) {
  const seed = plan.seedClaim;
  if (!seed) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2">
        <MapPin className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Listing wedge</span>
        <Chip className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
          {seed.status}
        </Chip>
        <Chip className={FIDELITY_CHIP[seed.fidelity]}>fidelity: {seed.fidelity}</Chip>
        <span className="ml-auto flex items-center gap-3 text-xs">
          {seed.placeUrl && (
            <Link href={seed.placeUrl} className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">
              place page <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {seed.claimUrl && (
            <>
              <Link href={seed.claimUrl} className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">
                claim link <ExternalLink className="h-3 w-3" />
              </Link>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(seed.claimUrl ?? '')}
                className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Copy className="h-3 w-3" /> copy
              </button>
            </>
          )}
        </span>
      </div>
      {(seed.fidelity === 'misaligned' || seed.fidelity === 'unknown') && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {seed.fidelity === 'misaligned'
            ? 'Claim CTA suppressed — the listing details do not match the verified footprint. Repair the listing before sharing.'
            : 'Seed fidelity unknown — verify the listing before sharing the claim link.'}
        </p>
      )}
    </div>
  );
}

// ─── Public surfaces strip (7.5) ─────────────────────────────────────────

function SurfacesStrip({ plan }: { plan: ProjectPhasePlan }) {
  const live = plan.publicSurfaces.filter(
    (s) => s.seed != null || s.demoStorefrontUrl != null,
  );
  const retired = plan.publicSurfaces.flatMap((s) => s.retiredSeeds ?? []);
  if (live.length === 0 && retired.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <Globe className="h-3.5 w-3.5" /> Public surfaces
      </div>
      <div className="flex flex-wrap gap-2">
        {live.map((s) => (
          <span key={s.campaignId} className="inline-flex items-center gap-2 text-xs">
            {s.seed && (
              <Link
                href={s.seed.placeUrl}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-blue-600 hover:bg-gray-50 dark:border-gray-600 dark:text-blue-400 dark:hover:bg-gray-700"
              >
                seed · {s.seed.status} <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            {s.demoStorefrontUrl && (
              <Link
                href={s.demoStorefrontUrl}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-blue-600 hover:bg-gray-50 dark:border-gray-600 dark:text-blue-400 dark:hover:bg-gray-700"
              >
                demo storefront <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </span>
        ))}
        {/* Suppressed seeds — operator audit history, never a live link target. */}
        {retired.map((r) => (
          <span
            key={r.seedId}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-400 dark:border-gray-600 dark:text-gray-500"
            title="Suppressed seed — retired history"
          >
            retired seed · {r.status}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Phase board ─────────────────────────────────────────────────────────

function PhaseRow({ phase }: { phase: ProjectPhase }) {
  const [open, setOpen] = useState(false);
  const suppressed = !!phase.suppressedReason;
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${suppressed ? 'opacity-70' : ''}`}
      data-phase={phase.key}
      data-status={phase.status}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center gap-2 p-3 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{phase.name}</span>
        <Chip className={STATUS_CHIP[phase.status]}>{phase.status.replace('_', ' ')}</Chip>
        <Chip className={CONFIDENCE_CHIP[phase.confidence]}>{phase.confidence}</Chip>
        <Chip className="bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-400">
          severity: {SEVERITY_LABELS[phase.severity] ?? phase.severity}
        </Chip>
        {phase.capability.required.length > 0 && !phase.capability.enabled && (
          <Chip className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
            needs {phase.capability.required.join(', ')}
          </Chip>
        )}
        {phase.suppressedReason && (
          <Chip className={SUPPRESSED_CHIP[phase.suppressedReason]}>{phase.suppressedReason}</Chip>
        )}
        {PHASE_DEPENDENCIES[phase.key] && (
          <Chip
            className={
              phase.status === 'blocked'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400'
            }
          >
            depends on {PHASE_DEPENDENCIES[phase.key]}
          </Chip>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {phase.triggerSignals.length} signal{phase.triggerSignals.length === 1 ? '' : 's'} ·{' '}
          {phase.contributingCampaignIds.length} campaign{phase.contributingCampaignIds.length === 1 ? '' : 's'} ·{' '}
          {phase.evidence.length} evidence
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-100 p-3 text-xs dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-300">{phase.goal}</p>
          {phase.triggerSignals.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {phase.triggerSignals.map((s) => (
                <code key={s} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  {s}
                </code>
              ))}
            </div>
          )}
          {phase.contributingCampaignIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {phase.contributingCampaignIds.map((cid) => (
                <Link
                  key={cid}
                  href={`/settings/admin/marketing-ops/campaigns/${cid}`}
                  className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-blue-600 hover:bg-gray-50 dark:border-gray-600 dark:text-blue-400"
                >
                  <Link2 className="h-3 w-3" /> {cid}
                </Link>
              ))}
            </div>
          )}
          {phase.evidence.length > 0 && (
            <ul className="space-y-1">
              {phase.evidence.map((e, i) => (
                <li key={i} className="text-gray-600 dark:text-gray-300">
                  <span className="font-mono text-[10px] text-gray-400">{e.field}</span> —{' '}
                  {e.isQuote ? (
                    <em>"{e.value}"{e.attribution ? ` — ${e.attribution}` : ''}</em>
                  ) : (
                    e.value
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-gray-500 dark:text-gray-400">
            <span className="font-medium">Done when:</span> {phase.exitCriterion.copy}
            {phase.exitCriterion.predicate ? (
              <code className="ml-1 font-mono text-[10px]">({phase.exitCriterion.predicate})</code>
            ) : null}
          </p>
        </div>
      )}
    </div>
  );
}

function PhaseBoard({ plan }: { plan: ProjectPhasePlan }) {
  // All five catalog phases always render internally — suppressed and
  // not_triggered rows stay on the board, dimmed and collapsed (§13).
  const suppressed = plan.phases.filter((p) => !!p.suppressedReason).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Phase board · {plan.phases.length} phases
        </h4>
        {suppressed > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {suppressed} suppressed
          </span>
        )}
      </div>
      {plan.phases.map((p) => (
        <PhaseRow key={p.key} phase={p} />
      ))}
    </div>
  );
}

/** Prior-cycle history — siblings on an earlier engagement cycle render as
 *  completed-work history below the board (§13; multi-gallery semantics). */
function PriorCycleHistory({
  plan,
  siblings,
}: {
  plan: ProjectPhasePlan;
  siblings: PlanSiblingSummary[];
}) {
  const prior = siblings.filter((s) => s.engagementCycle < plan.engagementCycle);
  if (prior.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <History className="h-3.5 w-3.5" /> Prior-cycle history · {prior.length}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {prior.map((s) => (
          <Link
            key={s.id}
            href={`/settings/admin/marketing-ops/campaigns/${s.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <span className="max-w-40 truncate">{s.businessName ?? s.id}</span>
            <StageBadge stage={s.stage} />
            <span className="text-[10px] text-gray-400">cycle {s.engagementCycle}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
