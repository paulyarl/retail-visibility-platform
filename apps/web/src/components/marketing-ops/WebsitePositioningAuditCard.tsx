'use client';

import { useState } from 'react';
import { AlertTriangle, Copy, ExternalLink, Globe, Layers, ShieldCheck } from 'lucide-react';
import type { Audit } from '@/services/MarketingOpsService';
import marketingOpsService from '@/services/MarketingOpsService';
import AuditImportMetadataBadge from './AuditImportMetadataBadge';
import OutreachProblemsSection from './OutreachProblemsSection';

/**
 * Website Positioning Audit card (PB-08 / A7).
 *
 * Renders the `platform = 'website_positioning'` audit — the depth-first
 * positioning pass for website-gap campaigns. Mirrors the visual patterns of
 * BusinessAnalysisAuditCard (Section/Badge helpers, shared
 * OutreachProblemsSection, AuditImportMetadataBadge) so the Audits tab reads
 * consistently across audit types.
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC.md §6.2 / OQ-9
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

function presenceColor(cls: string): string {
  switch (cls) {
    case 'present': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'no_presence': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'third_party_only':
    case 'broken': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'builder_subdomain':
    case 'parked':
    case 'unfinished': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function ownershipColor(o: string): string {
  switch (o) {
    case 'owned_domain': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'platform_hosted': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'none': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function buildScopeColor(r: string): string {
  switch (r) {
    case 'repair':
    case 'secure_and_refresh': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'rebuild': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'new_build': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function severityColor(s: string | undefined): string {
  return s === 'non_negotiable'
    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
}

function humanize(v: string | null | undefined): string {
  return (v ?? '').replace(/_/g, ' ');
}

// ─── Component ──────────────────────────────────────────────────────────

interface WebsitePositioningAuditCardProps {
  audit: Audit;
  campaignId: string;
}

export default function WebsitePositioningAuditCard({ audit, campaignId }: WebsitePositioningAuditCardProps) {
  const [copied, setCopied] = useState(false);
  const d = (audit.audit_data ?? {}) as any;

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
    <div className="border border-sky-200 dark:border-sky-800 rounded-lg p-4 bg-sky-50/40 dark:bg-sky-900/10">
      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-sky-700 dark:text-sky-300" />
          <span className="font-medium text-sky-900 dark:text-sky-200">Website Positioning Audit</span>
          {d.presence_classification && (
            <Badge cls={presenceColor(d.presence_classification)}>{humanize(d.presence_classification)}</Badge>
          )}
          {d.ownership && <Badge cls={ownershipColor(d.ownership)}>{humanize(d.ownership)}</Badge>}
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

      {d.summary && <p className="text-sm text-gray-700 dark:text-gray-300">{d.summary}</p>}

      {/* Conversion-framed issues */}
      {Array.isArray(d.issues) && d.issues.length > 0 && (
        <Section title="Issues & Conversion Impact" icon={<AlertTriangle className="h-3 w-3" />}>
          <ul className="space-y-2">
            {d.issues.map((iss: any, i: number) => (
              <li key={i} className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{iss.issue}</p>
                  {iss.severity && <Badge cls={severityColor(iss.severity)}>{humanize(iss.severity)}</Badge>}
                </div>
                {iss.conversion_implication && (
                  <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">
                    <span className="font-medium">Costs you: </span>
                    {iss.conversion_implication}
                  </p>
                )}
                {iss.evidence && (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">Evidence</summary>
                    <p className="mt-1 pl-3 text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-neutral-700">{iss.evidence}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Positioning gaps vs. the gold standard */}
      {Array.isArray(d.positioning_gaps) && d.positioning_gaps.length > 0 && (
        <Section title={`Positioning Gaps (${d.positioning_gaps.length})`} icon={<Layers className="h-3 w-3" />}>
          <div className="space-y-1.5">
            {d.positioning_gaps.map((g: any, i: number) => (
              <div key={i} className="rounded border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{g.field}</span>
                  {g.severity && <Badge cls={severityColor(g.severity)}>{humanize(g.severity)}</Badge>}
                </div>
                {(g.expected != null || g.actual != null) && (
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    expected <span className="text-gray-700 dark:text-gray-300">{String(g.expected)}</span>
                    {' · '}actual <span className="text-gray-700 dark:text-gray-300">{String(g.actual)}</span>
                  </p>
                )}
                {g.gap_description && <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{g.gap_description}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Build scope — the seed of the FITD deliverable */}
      {d.build_scope && (
        <Section title="Recommended Build">
          <div className="flex items-center gap-2">
            <Badge cls={buildScopeColor(d.build_scope.recommended)}>{humanize(d.build_scope.recommended)}</Badge>
          </div>
          {d.build_scope.scope_notes && (
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{d.build_scope.scope_notes}</p>
          )}
          {Array.isArray(d.build_scope.must_have_pages) && d.build_scope.must_have_pages.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {d.build_scope.must_have_pages.map((p: string, i: number) => (
                <Badge key={i} cls="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{p}</Badge>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Detected signals */}
      {Array.isArray(d.detected_signals) && d.detected_signals.length > 0 && (
        <Section title="Detected Signals" icon={<ShieldCheck className="h-3 w-3" />}>
          <div className="flex flex-wrap gap-1">
            {d.detected_signals.map((s: string, i: number) => (
              <Badge key={i} cls="bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">{s}</Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Competitive frame */}
      {Array.isArray(d.competitive_frame) && d.competitive_frame.length > 0 && (
        <Section title="How Exemplar Sites Position">
          <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside space-y-0.5">
            {d.competitive_frame.map((c: string, i: number) => <li key={i}>{c}</li>)}
          </ul>
        </Section>
      )}

      {/* Outreach ammunition — the problem/regular/hook/solution contract */}
      {Array.isArray(d.outreach_problems) && d.outreach_problems.length > 0 && (
        <Section title="Outreach Ammunition">
          <OutreachProblemsSection
            problems={d.outreach_problems}
            onUseAsOpener={async (line, problem) => {
              const result = await marketingOpsService.createOpenerFromBriefing({
                campaign_id: campaignId,
                opener_text: line,
                primary_angle: problem,
                source_briefing: 'website_audit',
                execution_id: (audit as any).execution_id ?? undefined,
              });
              const issues = (result as any)?.qualityGate?.issues ?? (result as any)?.quality_gate_issues;
              return { warnings: Array.isArray(issues) && issues.length > 0 ? issues : undefined };
            }}
          />
        </Section>
      )}

      {/* Data quality */}
      {(d.data_quality?.verified_fields?.length || d.data_quality?.unavailable_fields?.length || d.data_quality?.limitations?.length) && (
        <Section title="Data Quality">
          {d.data_quality?.verified_fields?.length > 0 && (
            <div className="mb-1">
              <span className="text-[10px] text-green-600 dark:text-green-400">Verified:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {d.data_quality.verified_fields.map((f: string) => <Badge key={f} cls="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">{f}</Badge>)}
              </div>
            </div>
          )}
          {d.data_quality?.unavailable_fields?.length > 0 && (
            <div className="mb-1">
              <span className="text-[10px] text-red-600 dark:text-red-400">Unavailable:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {d.data_quality.unavailable_fields.map((f: string) => <Badge key={f} cls="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">{f}</Badge>)}
              </div>
            </div>
          )}
          {d.data_quality?.limitations?.length > 0 && (
            <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 list-disc list-inside">
              {d.data_quality.limitations.map((l: string, i: number) => <li key={i}>{l}</li>)}
            </ul>
          )}
        </Section>
      )}

      {d.website_url && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
          <a
            href={d.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-sky-700 dark:text-sky-300 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> {d.website_url}
          </a>
        </div>
      )}
    </div>
  );
}
