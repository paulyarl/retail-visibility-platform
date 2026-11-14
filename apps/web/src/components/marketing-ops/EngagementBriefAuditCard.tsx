'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, Ban, Check, CheckCircle2, Compass, Copy, KeyRound, ShieldCheck, SkipForward } from 'lucide-react';
import type { Audit } from '@/services/MarketingOpsService';
import { marketingOpsService } from '@/services/MarketingOpsService';
import AuditImportMetadataBadge from './AuditImportMetadataBadge';

/**
 * Engagement Brief card (Pass-2 spine) — renders "the play," not the schema.
 *
 * Spec: docs/LocalBiz/ENGAGEMENT_BRIEF_SPINE_SPRINT_PLAN.md (D9)
 *
 * Read path: hook panel (primary pain + spoken lines + guardrails +
 * addressing capabilities) → ranked pains with inline addressed-by chips
 * and gate warnings → assets → capability fits → gate checklist
 * (operator-clearable first, resolvable in place) → do-not-claim →
 * collapsed evidence index. Badges triage: only non-default states badge —
 * verified_on_surface and client_safe are the expected state and stay
 * silent; inferred/verify_with_owner/internal/provenance_broken surface.
 */

// ─── Helpers ────────────────────────────────────────────────────────────

function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 dark:border-gray-700 py-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

function humanize(v: string | null | undefined): string {
  return (v ?? '').replace(/_/g, ' ');
}

function severityColor(s: string | undefined): string {
  switch (s) {
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

/** Badge triage — only non-default states return a badge class. */
function triageBadge(item: any): { label: string; cls: string } | null {
  if (item?.provenance_broken) {
    return { label: 'provenance broken', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
  }
  if (item?.confidence === 'inferred') {
    return { label: 'inferred', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' };
  }
  if (item?.confidence === 'verify_with_owner') {
    return { label: 'verify w/ owner', cls: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300' };
  }
  return null;
}

const internalBadge = { label: 'internal', cls: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200' };

function sideColor(s: string | undefined): string {
  switch (s) {
    case 'competitive': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'emerging': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function refChipColor(ref: string | undefined): string {
  const prefix = (ref ?? '').replace(/[0-9].*$/, '');
  switch (prefix) {
    case 'p': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
    case 'a': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
    case 'cf': return 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300';
    default: return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }
}

function gateStatusBadge(status: string | undefined): { label: string; cls: string } {
  switch (status) {
    case 'answered': return { label: 'answered', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
    case 'skipped': return { label: 'skipped', cls: 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300' };
    case 'needs_reconfirmation': return { label: 're-confirm', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
    default: return { label: 'pending', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' };
  }
}

const whoRank: Record<string, number> = { operator: 0, public_source: 1, owner: 2 };

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch { /* clipboard unavailable */ }
      }}
      title={`Copy ${label}`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-700"
    >
      {ok ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {ok ? 'copied' : label}
    </button>
  );
}

// ─── Component ──────────────────────────────────────────────────────────

interface EngagementBriefAuditCardProps {
  audit: Audit;
  campaignId: string;
}

export default function EngagementBriefAuditCard({ audit, campaignId }: EngagementBriefAuditCardProps) {
  const d = (audit.audit_data ?? {}) as any;

  const business = d.business ?? {};
  const side = d.side ?? {};
  const evidenceIndex: Record<string, string> = d.evidence_index ?? {};
  const pains: any[] = Array.isArray(d.pains) ? d.pains : [];
  const assets: any[] = Array.isArray(d.assets) ? d.assets : [];
  const fits: any[] = Array.isArray(d.capability_fits) ? d.capability_fits : [];
  const [gateStates, setGateStates] = useState<any[]>(
    Array.isArray(d.verification_gates) ? d.verification_gates : [],
  );
  const [gateBusy, setGateBusy] = useState<number | null>(null);
  const shape = d.engagement_shape ?? {};
  const doNotClaim: string[] = Array.isArray(shape.do_not_claim) ? shape.do_not_claim : [];

  const evidencePath = (ref: string | undefined) => (ref ? evidenceIndex[ref] : undefined);
  const primaryHook = pains.find((p) => p.ref_id === shape.primary_hook_ref);
  const isEmptySpine = pains.length === 0 && assets.length === 0 && fits.length === 0;

  // Joins the operator otherwise does by eye: which fits fix this pain,
  // which gates block it.
  const fitsFor = (ref: string) => fits.filter((f) => f.addresses_ref === ref);
  const gatesFor = (ref: string) => gateStates.filter((g) => g.blocks === ref);

  // Gates sorted operator-clearable first (persisted model briefs may not
  // arrive pre-sorted; the assembler already orders its own).
  const gates = [...gateStates].sort(
    (a, b) => (whoRank[a.who_can_answer] ?? 3) - (whoRank[b.who_can_answer] ?? 3),
  );

  const resolveGate = async (
    displayedIdx: number,
    status: 'answered' | 'skipped' | 'pending' | 'needs_reconfirmation',
  ) => {
    const gate = gates[displayedIdx];
    const spineIdx = gateStates.indexOf(gate);
    setGateBusy(spineIdx);
    try {
      await marketingOpsService.resolveBriefGate(campaignId, spineIdx, status);
      setGateStates((prev) =>
        prev.map((g, i) => (i === spineIdx ? { ...g, status } : g)),
      );
    } catch {
      // resolution write failed — gate stays as rendered
    } finally {
      setGateBusy(null);
    }
  };

  const hookFits = primaryHook ? fitsFor(primaryHook.ref_id) : [];

  return (
    <div className="border border-violet-200 dark:border-violet-800 rounded-lg p-4 bg-violet-50/40 dark:bg-violet-900/10">
      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Compass className="h-3.5 w-3.5 text-violet-700 dark:text-violet-300" />
          <span className="font-medium text-violet-900 dark:text-violet-200">Engagement Brief</span>
          {side.value && (
            <Badge cls={sideColor(side.value)}>
              {side.value}
              {typeof side.density_score === 'number' && ` · density ${side.density_score}`}
            </Badge>
          )}
          {d.staleness === 'stale' && (
            <Badge cls="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">stale — newer audit evidence</Badge>
          )}
          {d.staleness !== 'stale' && d.assembly && (
            <Badge cls="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">{d.assembly}</Badge>
          )}
          {d.archetype_domain && (
            <Badge cls="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">ranked for {d.archetype_domain}</Badge>
          )}
          <AuditImportMetadataBadge audit={audit} />
        </div>
        <span className="text-xs text-gray-400 shrink-0">{new Date(audit.created_at).toLocaleDateString()}</span>
      </div>

      {(business.name || business.category) && (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">{business.name}</span>
          {business.category && <span className="text-gray-500 dark:text-gray-400"> · {business.category}</span>}
          {business.store_format && <span className="text-gray-400 dark:text-gray-500"> ({business.store_format})</span>}
        </p>
      )}

      {/* THE PLAY — hook + spoken lines + guardrails + fixes in one panel */}
      {primaryHook && (
        <div className="mt-2 rounded-lg border-2 border-violet-300 dark:border-violet-700 bg-white dark:bg-neutral-800/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              The play — {humanize(shape.lead_with) ?? 'pain'} first
            </p>
            <div className="flex items-center gap-1">
              <Badge cls={refChipColor(primaryHook.ref_id)}>{primaryHook.ref_id}</Badge>
              {primaryHook.severity && <Badge cls={severityColor(primaryHook.severity)}>{primaryHook.severity}</Badge>}
            </div>
          </div>
          <p className="mt-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
            {primaryHook.business_consequence}
          </p>
          {(primaryHook.regular || primaryHook.hook || primaryHook.fix) && (
            <div className="mt-2 space-y-1">
              {primaryHook.regular && (
                <p className="flex items-center justify-between gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <span><span className="font-medium text-gray-500">Say: </span>{primaryHook.regular}</span>
                  <CopyBtn text={primaryHook.regular} label="line" />
                </p>
              )}
              {primaryHook.hook && (
                <p className="flex items-center justify-between gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <span><span className="font-medium text-gray-500">Hook: </span>{primaryHook.hook}</span>
                  <CopyBtn text={primaryHook.hook} label="hook" />
                </p>
              )}
              {primaryHook.fix && (
                <p className="flex items-center justify-between gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <span><span className="font-medium text-gray-500">Fix: </span>{primaryHook.fix}</span>
                  <CopyBtn text={primaryHook.fix} label="fix" />
                </p>
              )}
            </div>
          )}
          {hookFits.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">fixes:</span>
              {hookFits.map((f: any, i: number) => (
                <Badge key={i} cls="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                  {humanize(f.capability)}
                </Badge>
              ))}
            </div>
          )}
          {doNotClaim.length > 0 && (
            <div className="mt-2 rounded border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 px-2 py-1.5">
              <p className="flex items-start gap-1.5 text-[11px] text-red-700 dark:text-red-300">
                <Ban className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{doNotClaim[0]}{doNotClaim.length > 1 && ` (+${doNotClaim.length - 1} more guardrails below)`}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {isEmptySpine && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Brief persisted with no ranked spine items — see the verification gates and raw JSON below.
        </p>
      )}

      {/* Pains — ranked, joined to their fixes and gates */}
      {pains.length > 0 && (
        <Section title={`Ranked Pains (${pains.length})`} icon={<AlertTriangle className="h-3 w-3" />}>
          <ul className="space-y-2">
            {pains.map((p: any, i: number) => {
              const isPrimary = shape.primary_hook_ref === p.ref_id;
              const myFits = fitsFor(p.ref_id);
              const myGates = gatesFor(p.ref_id).filter((g) => (g.status ?? 'pending') === 'pending' || g.status === 'needs_reconfirmation');
              const triage = triageBadge(p);
              return (
                <li key={p.ref_id ?? i} className={`rounded-lg border p-2.5 ${isPrimary ? 'border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/10' : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-gray-400">#{i + 1}</span>
                      {p.ref_id && <Badge cls={refChipColor(p.ref_id)}>{p.ref_id}</Badge>}
                      {isPrimary && <Badge cls="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">primary hook</Badge>}
                      {p.domain && <span className="text-[10px] text-gray-400">{humanize(p.domain)}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 justify-end">
                      {p.severity && <Badge cls={severityColor(p.severity)}>{p.severity}</Badge>}
                      {triage && <Badge cls={triage.cls}>{triage.label}</Badge>}
                      {p.visibility === 'internal' && <Badge cls={internalBadge.cls}>{internalBadge.label}</Badge>}
                    </div>
                  </div>
                  {p.business_consequence && (
                    <p className="mt-1 text-xs text-gray-800 dark:text-gray-200">{p.business_consequence}</p>
                  )}
                  {p.hook && !isPrimary && (
                    <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                      <span><span className="font-medium">Hook: </span>{p.hook}</span>
                      <CopyBtn text={p.hook} label="hook" />
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {myFits.map((f: any, j: number) => (
                      <Badge key={j} cls="bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
                        fixes: {humanize(f.capability)}
                      </Badge>
                    ))}
                    {myGates.map((g: any, j: number) => (
                      <Badge key={`g${j}`} cls="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                        gated: {humanize(g.who_can_answer)}
                      </Badge>
                    ))}
                    {p.regular && <CopyBtn text={p.regular} label="line" />}
                  </div>
                  {evidencePath(p.evidence_ref ?? p.ref_id) && (
                    <p className="mt-1 text-[10px] font-mono text-gray-400 dark:text-gray-500">
                      → {evidencePath(p.evidence_ref ?? p.ref_id)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Assets */}
      {assets.length > 0 && (
        <Section title={`Assets (${assets.length})`} icon={<ShieldCheck className="h-3 w-3" />}>
          <ul className="space-y-2">
            {assets.map((a: any, i: number) => {
              const triage = triageBadge(a);
              return (
                <li key={a.ref_id ?? i} className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {a.ref_id && <Badge cls={refChipColor(a.ref_id)}>{a.ref_id}</Badge>}
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{a.asset}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 justify-end">
                      {a.how_to_use && <Badge cls="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{a.how_to_use}</Badge>}
                      {a.underexposure === true && <Badge cls="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">underexposed</Badge>}
                      {triage && <Badge cls={triage.cls}>{triage.label}</Badge>}
                      {a.visibility === 'internal' && <Badge cls={internalBadge.cls}>{internalBadge.label}</Badge>}
                    </div>
                  </div>
                  {evidencePath(a.evidence_ref ?? a.ref_id) && (
                    <p className="mt-1 text-[10px] font-mono text-gray-400 dark:text-gray-500">
                      → {evidencePath(a.evidence_ref ?? a.ref_id)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Capability fits */}
      {fits.length > 0 && (
        <Section title={`Capability Fits (${fits.length})`}>
          <ul className="space-y-2">
            {fits.map((f: any, i: number) => (
              <li key={i} className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{humanize(f.capability)}</span>
                    {f.addresses_ref && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
                        <ArrowRight className="h-2.5 w-2.5" />
                        <Badge cls={refChipColor(f.addresses_ref)}>{f.addresses_ref}</Badge>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    {f.confidence && f.confidence !== 'high' && (
                      <Badge cls={f.confidence === 'medium' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}>{f.confidence}</Badge>
                    )}
                    {f.visibility === 'internal' && <Badge cls={internalBadge.cls}>{internalBadge.label}</Badge>}
                    {f.provenance_broken && <Badge cls="bg-red-100 text-red-700">provenance broken</Badge>}
                  </div>
                </div>
                {f.why_it_fits && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{f.why_it_fits}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Verification gates — actionable checklist, operator-clearable first */}
      {gates.length > 0 && (
        <Section title={`Verification Gates (${gates.length})`} icon={<KeyRound className="h-3 w-3" />}>
          <ul className="space-y-1.5">
            {gates.map((g: any, i: number) => {
              const status = gateStatusBadge(g.status);
              const resolved = g.status === 'answered' || g.status === 'skipped';
              const spineIdx = gateStates.indexOf(g);
              return (
                <li key={i} className={`rounded border p-2 ${resolved ? 'border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/40 opacity-70' : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-gray-800 dark:text-gray-200">{g.gate}</p>
                    <div className="flex flex-wrap items-center gap-1 justify-end shrink-0">
                      <Badge cls={status.cls}>{status.label}</Badge>
                      {g.blocks && <Badge cls={refChipColor(g.blocks)}>blocks {g.blocks}</Badge>}
                      {g.who_can_answer && <Badge cls="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">ask {humanize(g.who_can_answer)}</Badge>}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {!resolved && campaignId && (
                      <>
                        <button
                          disabled={gateBusy === spineIdx}
                          onClick={() => resolveGate(i, 'answered')}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3 w-3" /> mark answered
                        </button>
                        <button
                          disabled={gateBusy === spineIdx}
                          onClick={() => resolveGate(i, 'skipped')}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-neutral-700 disabled:opacity-50"
                        >
                          <SkipForward className="h-3 w-3" /> skip
                        </button>
                      </>
                    )}
                    <CopyBtn text={g.gate} label="question" />
                    {g.resolution_note && (
                      <span className="text-[10px] text-gray-500 italic">note: {g.resolution_note}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Do-not-claim — quarantined prohibitions */}
      {doNotClaim.length > 0 && (
        <Section title={`Do Not Claim (${doNotClaim.length})`} icon={<Ban className="h-3 w-3" />}>
          <ul className="space-y-1">
            {doNotClaim.map((rule: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
                <Ban className="mt-0.5 h-3 w-3 shrink-0 text-red-400 dark:text-red-500" />
                {rule}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Evidence index — the citation ledger */}
      {Object.keys(evidenceIndex).length > 0 && (
        <details className="border-t border-gray-100 dark:border-gray-700 pt-3">
          <summary className="cursor-pointer text-xs text-violet-700 dark:text-violet-300 hover:underline">
            Evidence index ({Object.keys(evidenceIndex).length} refs)
          </summary>
          <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
            {Object.entries(evidenceIndex).map(([ref, path]) => (
              <p key={ref} className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-600 dark:text-gray-300">{ref}</span>
                {' → '}
                {path}
              </p>
            ))}
          </div>
        </details>
      )}

      {d.source_audit_id && (
        <p className="mt-2 text-[10px] font-mono text-gray-400 dark:text-gray-500">
          source audit: {d.source_audit_id}
        </p>
      )}
    </div>
  );
}
