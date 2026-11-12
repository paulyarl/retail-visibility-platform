'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, Ban, Compass, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import type { Audit } from '@/services/MarketingOpsService';
import AuditImportMetadataBadge from './AuditImportMetadataBadge';

/**
 * Engagement Brief card (Pass-2 spine).
 *
 * Renders the `platform = 'engagement_brief'` audit — the ranked
 * pains/assets/capability_fits/verification_gates spine that downstream
 * projections (project plan, proposal, call script) read from. Without this
 * card the Audits tab falls through to the generic review-metrics shell and
 * shows a credible-looking but meaningless 0/0/0 for a brief.
 *
 * Schema: apps/api/src/validators/engagement-brief.schema.ts
 * Spec: docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md
 */

// ─── Helpers (duplicated for isolation — mirrors BusinessAnalysisAuditCard) ──

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
    case 'low': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

/** Evidence-backed confidence (pains/assets) — tri-state vocabulary. */
function evidenceConfidenceColor(c: string | undefined): string {
  switch (c) {
    case 'verified_on_surface': return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    case 'inferred': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
    case 'verify_with_owner': return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300';
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

/** Judgment confidence (capability_fits) — high/medium/low. */
function judgmentConfidenceColor(c: string | undefined): string {
  switch (c) {
    case 'high': return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    case 'medium': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
    case 'low': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

/** Visibility leak-guardrail — internal is operator-only. */
function visibilityColor(v: string | undefined): string {
  switch (v) {
    case 'public_safe': return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    case 'client_safe': return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
    case 'internal': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  }
}

function sideColor(s: string | undefined): string {
  switch (s) {
    case 'competitive': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'emerging': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

/** ref_id chips get a stable hue per spine-block prefix (p/a/cf/w). */
function refChipColor(ref: string | undefined): string {
  const prefix = (ref ?? '').replace(/[0-9].*$/, '');
  switch (prefix) {
    case 'p': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300';
    case 'a': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
    case 'cf': return 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300';
    case 'w': return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

// ─── Component ──────────────────────────────────────────────────────────

interface EngagementBriefAuditCardProps {
  audit: Audit;
  campaignId: string;
}

export default function EngagementBriefAuditCard({ audit }: EngagementBriefAuditCardProps) {
  const [copied, setCopied] = useState(false);
  const d = (audit.audit_data ?? {}) as any;

  const business = d.business ?? {};
  const side = d.side ?? {};
  const evidenceIndex: Record<string, string> = d.evidence_index ?? {};
  const pains: any[] = Array.isArray(d.pains) ? d.pains : [];
  const assets: any[] = Array.isArray(d.assets) ? d.assets : [];
  const fits: any[] = Array.isArray(d.capability_fits) ? d.capability_fits : [];
  const gates: any[] = Array.isArray(d.verification_gates) ? d.verification_gates : [];
  const shape = d.engagement_shape ?? {};
  const doNotClaim: string[] = Array.isArray(shape.do_not_claim) ? shape.do_not_claim : [];

  const evidencePath = (ref: string | undefined) => (ref ? evidenceIndex[ref] : undefined);
  const primaryHook = pains.find((p) => p.ref_id === shape.primary_hook_ref);
  const isEmptySpine = pains.length === 0 && assets.length === 0 && fits.length === 0;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(d, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable — the JSON remains selectable.
    }
  };

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
          {typeof side.classifier_version === 'number' && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">classifier v{side.classifier_version}</span>
          )}
          <AuditImportMetadataBadge audit={audit} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-700"
          >
            <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {(business.name || business.category) && (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">{business.name}</span>
          {business.category && <span className="text-gray-500 dark:text-gray-400"> · {business.category}</span>}
          {business.store_format && <span className="text-gray-400 dark:text-gray-500"> ({business.store_format})</span>}
        </p>
      )}

      {/* Engagement shape — the decisions every projection renders */}
      {(shape.lead_with || shape.primary_hook_ref) && (
        <div className="mt-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-neutral-800/60 p-2.5">
          <p className="text-xs text-gray-700 dark:text-gray-300">
            <span className="font-medium">Lead with:</span> {humanize(shape.lead_with) ?? shape.lead_with}
            {shape.primary_hook_ref && (
              <>
                {' · '}primary hook <Badge cls={refChipColor(shape.primary_hook_ref)}>{shape.primary_hook_ref}</Badge>
              </>
            )}
          </p>
          {primaryHook?.business_consequence && (
            <p className="mt-1 text-xs text-violet-800 dark:text-violet-300">{primaryHook.business_consequence}</p>
          )}
        </div>
      )}

      {isEmptySpine && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Brief persisted with no ranked spine items — see the verification gates and raw JSON below.
        </p>
      )}

      {/* Pains — ranked once here, projected everywhere downstream */}
      {pains.length > 0 && (
        <Section title={`Pains (${pains.length})`} icon={<AlertTriangle className="h-3 w-3" />}>
          <ul className="space-y-2">
            {pains.map((p: any, i: number) => (
              <li key={p.ref_id ?? i} className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {p.ref_id && <Badge cls={refChipColor(p.ref_id)}>{p.ref_id}</Badge>}
                    {shape.primary_hook_ref === p.ref_id && (
                      <Badge cls="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">primary hook</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    {p.severity && <Badge cls={severityColor(p.severity)}>{p.severity}</Badge>}
                    {p.confidence && <Badge cls={evidenceConfidenceColor(p.confidence)}>{humanize(p.confidence)}</Badge>}
                    {p.visibility && <Badge cls={visibilityColor(p.visibility)}>{humanize(p.visibility)}</Badge>}
                  </div>
                </div>
                {p.business_consequence && (
                  <p className="mt-1 text-xs text-gray-800 dark:text-gray-200">{p.business_consequence}</p>
                )}
                {evidencePath(p.evidence_ref ?? p.ref_id) && (
                  <p className="mt-1 text-[10px] font-mono text-gray-400 dark:text-gray-500">
                    → {evidencePath(p.evidence_ref ?? p.ref_id)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Assets */}
      {assets.length > 0 && (
        <Section title={`Assets (${assets.length})`} icon={<ShieldCheck className="h-3 w-3" />}>
          <ul className="space-y-2">
            {assets.map((a: any, i: number) => (
              <li key={a.ref_id ?? i} className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.ref_id && <Badge cls={refChipColor(a.ref_id)}>{a.ref_id}</Badge>}
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{a.asset}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    {a.how_to_use && <Badge cls="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">{a.how_to_use}</Badge>}
                    {a.underexposure === true && <Badge cls="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">underexposed</Badge>}
                    {a.confidence && <Badge cls={evidenceConfidenceColor(a.confidence)}>{humanize(a.confidence)}</Badge>}
                    {a.visibility && <Badge cls={visibilityColor(a.visibility)}>{humanize(a.visibility)}</Badge>}
                  </div>
                </div>
                {evidencePath(a.evidence_ref ?? a.ref_id) && (
                  <p className="mt-1 text-[10px] font-mono text-gray-400 dark:text-gray-500">
                    → {evidencePath(a.evidence_ref ?? a.ref_id)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Capability fits — platform capability → spine item */}
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
                    {f.confidence && <Badge cls={judgmentConfidenceColor(f.confidence)}>{f.confidence}</Badge>}
                    {f.visibility && <Badge cls={visibilityColor(f.visibility)}>{humanize(f.visibility)}</Badge>}
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

      {/* Verification gates — what must be confirmed before it can be claimed */}
      {gates.length > 0 && (
        <Section title={`Verification Gates (${gates.length})`} icon={<KeyRound className="h-3 w-3" />}>
          <ul className="space-y-1.5">
            {gates.map((g: any, i: number) => (
              <li key={i} className="rounded border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 p-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-gray-800 dark:text-gray-200">{g.gate}</p>
                  <div className="flex flex-wrap items-center gap-1 justify-end shrink-0">
                    {g.blocks && <Badge cls={refChipColor(g.blocks)}>blocks {g.blocks}</Badge>}
                    {g.who_can_answer && <Badge cls="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">ask {humanize(g.who_can_answer)}</Badge>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Do-not-claim — affirmative prohibitions every projection must obey */}
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

      {/* Evidence index — ref_id → audit field path (the citation ledger) */}
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
