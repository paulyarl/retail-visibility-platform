'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, Loader2, Inbox, Check, ChevronDown, ChevronRight, MapPin, AlertTriangle, Phone, Flag } from 'lucide-react';
import Link from 'next/link';
import type { Audit, ProspectQueueEntry } from '@/services/MarketingOpsService';
import AuditImportMetadataBadge from './AuditImportMetadataBadge';

/**
 * IntelligenceDiscoveryAuditCard — structured renderer for intelligence_discovery audits.
 *
 * Intelligence-discovery audits are created by the external-import flow when a
 * prompt template declares `output_schema.name = "intelligence_discovery"`.
 * The full validated JSON is stored in `audit.audit_data`. This card renders
 * the discovered/qualifying businesses with discovery assessment fields and
 * provides per-business action buttons:
 *   - Derive business-scope child campaign (spawn from discovery)
 *   - Add to prospect queue (with intelligence_seek source_kind + discovery columns)
 *
 * Hold-priority businesses (identity_confidence=low or category_fit=insufficient)
 * are rendered with a flag so the operator can see they need verification before
 * promotion.
 */

interface DiscoveryProvenance {
  source?: string;
  role?: string;
  evidence_types?: string[];
  url?: string;
  accessed_at?: string;
  [key: string]: any;
}

export interface DiscoveredBusiness {
  business_name: string;
  category: string;
  city: string;
  state?: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  gbp_url?: string | null;
  location_status: 'inside_city' | 'adjacent_city' | 'metro_area' | 'outside_market';
  ownership_type: string;
  category_fit: 'verified' | 'probable' | 'insufficient';
  identity_confidence: 'high' | 'medium' | 'low';
  discovery_signals: string[];
  discovery_provenance: DiscoveryProvenance[];
  business_seek_recommended: boolean;
  business_seek_priority: 'high' | 'medium' | 'low' | 'hold';
  rating?: number | null;
  review_count?: number | null;
  /** Sourced attribute chips observed on the business's platform profiles
   *  (migration 267 contract — recorded by the analyst, never inferred). */
  observed_attributes?: Array<{
    key: string;
    label: string;
    platform?: string;
    source_url?: string;
    as_of?: string;
  }>;
  /** Bronze Standard attribution (spec §7.4) — the catalog reason(s)
   *  directly responsible for surfacing this business, emitted only when a
   *  bronze market-calibration block was injected into the scan prompt. */
  bronze_attribution?: Array<{
    reason_key: string;
    basis?: string | null;
  }> | null;
  /** Competitive weakness attribution (COMPETITIVE_WEAKNESS_ATTRIBUTION_SPEC
   *  §6) — the incumbent's named exposures, emitted only under competitive
   *  focus. The pitch wedge: "we see you — can we help with this?" */
  competitive_weaknesses?: Array<{
    weakness_key: string;
    basis?: string | null;
  }> | null;
  /** Optional benchmark marker — a leader observed as reference point, not
   *  a prospect (spec §3). Card-display only. */
  benchmark_only?: boolean | null;
  notes?: string;
  [key: string]: any;
}

// ─── Scan contract types (Discovery Scan Contract Spec §3) ───────────────
//
// Persisted in audit_data.scan_contract by the import gate; violations stamp
// to audit_data.scan_contract_violations. Legacy audits (pre-contract) carry
// neither and render as coverage-unverified.

interface SweepLedgerRow {
  unit_id: string;
  unit_type?: 'zip_label_matrix' | 'corridor' | 'dataset_geography';
  unit?: string;
  platforms_swept?: string[];
  labels_swept?: string[];
  status?: 'executed_with_findings' | 'executed_empty' | 'not_executed' | 'blocked';
  findings_count?: number | null;
  candidate_keys?: string[];
  executed_at?: string;
  blocked_reason?: string | null;
  [key: string]: any;
}

interface CoverageAttestation {
  units_total?: number;
  units_executed?: number;
  units_executed_empty?: number;
  units_not_executed?: number;
  units_blocked?: number;
  vectors_total?: number;
  vectors_executed?: number;
  vectors_not_executed?: number;
  coverage_ratio?: number;
  completeness_claim?: 'verified_full' | 'verified_partial' | 'unverified';
  uncovered_municipalities?: string[];
  unexecuted_vector_list?: Array<{ vector: string; reason?: string }>;
  attestation_basis?: string;
  [key: string]: any;
}

interface MunicipalityCoverageRow {
  municipality: string;
  shared_zip?: string;
  status?: 'covered' | 'platform_only' | 'uncovered';
  [key: string]: any;
}

interface ScanContract {
  contract_version?: string;
  sweep_ledger?: SweepLedgerRow[];
  coverage_attestation?: CoverageAttestation;
  municipality_coverage?: MunicipalityCoverageRow[];
  reconciliation?: {
    operator_supplied_members?: string[];
    matched_to_candidates?: string[];
    added_this_pass?: string[];
    unmatched?: string[];
    excluded_with_reason?: Array<{ member: string; reason?: string }>;
    [key: string]: any;
  } | null;
  [key: string]: any;
}

interface ContractViolation {
  invariant: string;
  path?: string;
  message: string;
}

interface IntelligenceDiscoveryData {
  intelligence_mode: 'profile' | 'generic_fallback';
  category: string;
  city: string;
  state?: string;
  focus: 'emerging' | 'competitive' | 'gold_standards';
  discovered_businesses: DiscoveredBusiness[];
  qualifying_businesses: DiscoveredBusiness[];
  candidate_count: number;
  qualifying_count: number;
  hold_count: number;
  category_definition?: string;
  geographic_classification_notes?: string;
  ownership_exclusion_notes?: string;
  profile_id?: string | null;
  profile_version?: number | null;
  scan_contract?: ScanContract | null;
  scan_contract_violations?: ContractViolation[];
}

function isIntelligenceDiscoveryAudit(audit: Audit): boolean {
  return audit.platform === 'intelligence_discovery'
    && audit.audit_data != null
    && typeof audit.audit_data === 'object'
    && 'discovered_businesses' in audit.audit_data;
}

function parseDiscovery(audit: Audit): IntelligenceDiscoveryData | null {
  if (!isIntelligenceDiscoveryAudit(audit)) return null;
  return audit.audit_data as IntelligenceDiscoveryData;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  low: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  hold: 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700',
};

const FIT_STYLES: Record<string, string> = {
  verified: 'text-green-600 dark:text-green-400',
  probable: 'text-amber-600 dark:text-amber-400',
  insufficient: 'text-red-600 dark:text-red-400',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'text-green-600 dark:text-green-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-red-600 dark:text-red-400',
};

const CLAIM_STYLES: Record<string, string> = {
  verified_full: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  verified_partial: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  unverified: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
};

const CLAIM_LABELS: Record<string, string> = {
  verified_full: 'verified full',
  verified_partial: 'verified partial',
  unverified: 'unverified',
};

const LEDGER_STATUS_STYLES: Record<string, string> = {
  executed_with_findings: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  executed_empty: 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  not_executed: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  blocked: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
};

const MUNICIPALITY_STATUS_STYLES: Record<string, string> = {
  covered: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  platform_only: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  uncovered: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

export default function IntelligenceDiscoveryAuditCard({
  audit,
  campaignId,
  onLogGap,
  onQueued,
  queueEntries,
  siblingAudits,
}: {
  audit: Audit;
  campaignId: string;
  /** Optional per-business gap logging (proving-ground cockpit). When provided,
   *  a "Gap" button renders next to Queue/Verify/Campaign so the operator can
   *  log a data gap against a specific prospect on the parent campaign. */
  onLogGap?: (biz: DiscoveredBusiness) => void;
  /** Optional callback fired after a business lands in the prospect queue
   *  (Queue or Verify path) so host pages can refresh queue-backed panels. */
  onQueued?: () => void;
  /** Optional queue awareness (proving-ground cockpit): the host's
   *  tree-scoped prospect queue. A discovered business whose identity
   *  (business_name + city) matches a live queue row renders "In queue"
   *  — plus a campaign link when the row already graduated — instead of
   *  the Queue/Verify/Campaign actions. */
  queueEntries?: ProspectQueueEntry[];
  /** Other audits on the same campaign — used for focus-pair parity
   *  (spec §7.1: a market is green-lit only when BOTH focus ledgers pass).
   *  The card picks the intelligence_discovery audit with the opposite
   *  focus and renders its attestation beside this one's. */
  siblingAudits?: Audit[];
}) {
  const data = parseDiscovery(audit);
  const [derivingIdx, setDerivingIdx] = useState<number | null>(null);
  const [queueingIdx, setQueueingIdx] = useState<number | null>(null);
  const [queuedFeedback, setQueuedFeedback] = useState<Record<number, 'queued' | 'verify' | 'exists' | 'already'>>({});
  const [queuedEntryId, setQueuedEntryId] = useState<Record<number, string>>({});
  const [derivedCampaignId, setDerivedCampaignId] = useState<Record<number, string>>({});
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'qualifying' | 'hold'>('all');
  const [expandedProvenance, setExpandedProvenance] = useState<Set<number>>(new Set());
  const [showNotes, setShowNotes] = useState<number | null>(null);

  // Sort all discovered businesses: recommended first, then by priority, holds last.
  // `discovered_businesses` is the superset (includes qualifying + hold/low candidates);
  // `qualifying_businesses` is the recommended subset. We render the superset so
  // operators can see every candidate the discovery pass surfaced, not just the
  // ones that passed qualification filters.
  const sortedBusinesses = useMemo(() => {
    if (!data) return [];
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, hold: 3 };
    return [...data.discovered_businesses].sort((a, b) => {
      const aRec = a.business_seek_recommended ? 0 : 1;
      const bRec = b.business_seek_recommended ? 0 : 1;
      if (aRec !== bRec) return aRec - bRec;
      return (priorityOrder[a.business_seek_priority] ?? 9) - (priorityOrder[b.business_seek_priority] ?? 9);
    });
  }, [data]);

  // Queue awareness — collapse the host's queue rows to the most-advanced
  // entry per business identity (same business_name|city key + seeded >
  // campaign_created > live rank as the cockpit's promote panel) so each
  // discovered business can resolve its queue state.
  const queueByIdentity = useMemo(() => {
    const rank = (e: ProspectQueueEntry) =>
      e.seed_id ? 3 : e.status === 'campaign_created' ? 2 : 1;
    const m = new Map<string, ProspectQueueEntry>();
    for (const e of queueEntries ?? []) {
      if (e.status === 'dismissed' || !e.business_name) continue;
      const key = `${e.business_name.toLowerCase().trim()}|${(e.city ?? '').toLowerCase().trim()}`;
      const existing = m.get(key);
      if (!existing || rank(e) > rank(existing)) m.set(key, e);
    }
    return m;
  }, [queueEntries]);

  if (!data) return null;

  const filteredBusinesses = useMemo(() => {
    if (filter === 'qualifying') return sortedBusinesses.filter((b) => b.business_seek_recommended);
    if (filter === 'hold') return sortedBusinesses.filter((b) => b.business_seek_priority === 'hold');
    return sortedBusinesses;
  }, [sortedBusinesses, filter]);

  const visibleBusinesses = showAll ? filteredBusinesses : filteredBusinesses.slice(0, 8);

  const handleDerive = async (biz: DiscoveredBusiness) => {
    const idx = sortedBusinesses.indexOf(biz);
    setDerivingIdx(idx);
    setDeriveError(null);
    try {
      const { default: service } = await import('@/services/MarketingOpsService');
      // Two-lane triage (discovery = partial verdict): hand the candidate's
      // discovery evidence through as discovery_context — the server
      // validates it (validateDiscoveryContext) and translates the named
      // findings into audit-family signals for the stub audit. INT_* codes
      // are NEVER copied into detected_signals — they pass through the
      // deterministic mapper, which emits only canonical codes.
      //
      // NAP handoff (Migration 253 — GAP-E4): forward the discovery pass's
      // phone/email/website/gbp_url/address onto the derived campaign so the
      // operator doesn't have to re-key NAP the discovery already produced.
      // The flat `address` string is sent as both `address` (→ addressLine1
      // fallback) and `location` (notes line) for backward compatibility.
      const child = await service.deriveBusinessCampaign(campaignId, {
        business_name: biz.business_name,
        rating: biz.rating ?? undefined,
        review_count: biz.review_count ?? undefined,
        location: biz.address || biz.location_status,
        phone: biz.phone ?? undefined,
        email: biz.email ?? undefined,
        website: biz.website ?? undefined,
        gbp_url: biz.gbp_url ?? undefined,
        address: biz.address ?? undefined,
        address_city: biz.city ?? undefined,
        address_state: biz.state ?? undefined,
        discovery_context: {
          // focus is enum-gated (emerging|competitive) — omit for
          // gold_standards audits rather than failing context validation.
          focus: data.focus === 'emerging' || data.focus === 'competitive' ? data.focus : undefined,
          discovered_at: audit.created_at,
          business_seek_priority: biz.business_seek_priority,
          category_fit: biz.category_fit,
          identity_confidence: biz.identity_confidence,
          location_status: biz.location_status,
          discovery_signals: biz.discovery_signals,
          discovery_provenance: biz.discovery_provenance,
          bronze_attribution: Array.isArray(biz.bronze_attribution) ? biz.bronze_attribution : undefined,
          competitive_weaknesses: Array.isArray(biz.competitive_weaknesses) ? biz.competitive_weaknesses : undefined,
        },
        intelligence_run_id: audit.import_metadata?.run_id ?? undefined,
      });
      setDerivedCampaignId((prev) => ({ ...prev, [idx]: child.id }));
    } catch (err: any) {
      setDeriveError(err.message || 'Failed to create campaign');
    } finally {
      setDerivingIdx(null);
    }
  };

  const handleQueue = async (biz: DiscoveredBusiness, initialStatus?: 'queued' | 'verify_then_outreach') => {
    const idx = sortedBusinesses.indexOf(biz);
    setQueueingIdx(idx);
    setDeriveError(null);
    try {
      const { default: service } = await import('@/services/MarketingOpsService');
      const result = await service.addToQueue({
        business_name: biz.business_name,
        title: biz.business_name,
        category: biz.category,
        city: biz.city,
        state: biz.state,
        source_kind: 'intelligence_seek',
        source_campaign_id: campaignId,
        source_audit_id: audit.id,
        audit_date: audit.created_at,
        business_snapshot: {
          rating: biz.rating,
          review_count: biz.review_count,
          location: biz.location_status,
          address: biz.address,
          phone: biz.phone,
          email: biz.email,
          website: biz.website,
          gbp_url: biz.gbp_url,
          ownership_type: biz.ownership_type,
          // Sourced attributes ride the snapshot so queue → campaign → seed
          // carries the analyst-recorded evidence (migration 267).
          attributes: Array.isArray(biz.observed_attributes) ? biz.observed_attributes : [],
          // Bronze reason attribution rides the snapshot so queue →
          // campaign → audit ("Discovery leads") preserves which catalog
          // reason surfaced this prospect (spec §7.4).
          bronze_attribution: Array.isArray(biz.bronze_attribution) ? biz.bronze_attribution : undefined,
          // Competitive weaknesses ride the same snapshot — the incumbent's
          // named exposures become the downstream pitch wedge (spec §7).
          competitive_weaknesses: Array.isArray(biz.competitive_weaknesses) ? biz.competitive_weaknesses : undefined,
        },
        priority: biz.business_seek_priority === 'high' ? 'high' : 'normal',
        // Intelligence discovery columns
        category_fit: biz.category_fit,
        identity_confidence: biz.identity_confidence,
        location_status: biz.location_status,
        discovery_provenance: biz.discovery_provenance,
        discovery_signals: biz.discovery_signals,
        business_seek_priority: biz.business_seek_priority,
        initial_status: initialStatus,
      } as any);
      const successKind = initialStatus === 'verify_then_outreach' ? 'verify' : 'queued';
      setQueuedFeedback((prev) => ({
        ...prev,
        [idx]: result.kind === 'campaign_exists' ? 'exists' : result.kind === 'already_queued' ? 'already' : successKind,
      }));
      if (result.kind === 'created' || result.kind === 'already_queued') {
        setQueuedEntryId((prev) => ({ ...prev, [idx]: result.entry.id }));
        onQueued?.();
      } else if (result.kind === 'campaign_exists') {
        // A campaign already exists for this business — surface it on the
        // Campaign button (link to the existing campaign) instead of the
        // tiny "exists" text next to an active button.
        setDerivedCampaignId((prev) => ({ ...prev, [idx]: result.campaignId }));
      }
    } catch (err: any) {
      setDeriveError(err.message || 'Failed to add to queue');
    } finally {
      setQueueingIdx(null);
    }
  };

  const toggleProvenance = (idx: number) => {
    setExpandedProvenance((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="border border-cyan-200 dark:border-cyan-800 rounded-lg p-4 bg-cyan-50/30 dark:bg-cyan-900/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="font-medium text-gray-900 dark:text-white">
            Intelligence Discovery
          </span>
          <span className="text-xs text-gray-400">
            {data.focus} · {data.category} · {data.city}{data.state ? `, ${data.state}` : ''}
          </span>
          <AuditImportMetadataBadge audit={audit} />
        </div>
        <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Metric label="Candidates" value={String(data.candidate_count)} />
        <Metric label="Qualifying" value={String(data.qualifying_count)} />
        <Metric label="On hold" value={String(data.hold_count)} />
        <Metric label="Mode" value={data.intelligence_mode === 'profile' ? 'Profile' : 'Generic'} />
      </div>

      {/* Coverage attestation (Discovery Scan Contract §3) — derived
          coverage, not the model's claim. Legacy audits carry no
          scan_contract and render as unverified. */}
      <ScanContractSection data={data} audit={audit} siblingAudits={siblingAudits} />

      {/* Category definition (collapsible) */}
      {data.category_definition && (
        <details className="mb-3 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-3">
          <summary className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
            Category definition
          </summary>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{data.category_definition}</p>
        </details>
      )}

      {/* Geographic classification notes (collapsible) */}
      {data.geographic_classification_notes && (
        <details className="mb-3 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-3">
          <summary className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
            Geographic classification notes
          </summary>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{data.geographic_classification_notes}</p>
        </details>
      )}

      {/* Ownership exclusion notes (collapsible) */}
      {data.ownership_exclusion_notes && (
        <details className="mb-3 rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-3">
          <summary className="text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
            Ownership exclusion notes
          </summary>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{data.ownership_exclusion_notes}</p>
        </details>
      )}

      {/* Discovered businesses list */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Discovered businesses ({data.discovered_businesses.length})
            <span className="ml-1.5 text-gray-400 font-normal">
              · {data.qualifying_count} qualifying · {data.hold_count} on hold
            </span>
          </p>
          {/* Filter toggle */}
          <div className="inline-flex rounded-md border border-gray-200 dark:border-neutral-700 overflow-hidden text-[10px]">
            {(['all', 'qualifying', 'hold'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => { setFilter(opt); setShowAll(false); }}
                className={`px-2 py-0.5 capitalize transition-colors ${
                  filter === opt
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {visibleBusinesses.length === 0 && (
            <p className="text-xs text-gray-400 italic py-2">
              No businesses match this filter.
            </p>
          )}
          {visibleBusinesses.map((biz) => {
            const idx = sortedBusinesses.indexOf(biz);
            const isHold = biz.business_seek_priority === 'hold';
            const isLowConfidence = biz.identity_confidence === 'low';
            const isInsufficientFit = biz.category_fit === 'insufficient';
            const provenanceOpen = expandedProvenance.has(idx);
            // Queue match (host-provided awareness) — a live queue row for
            // this business suppresses Queue/Verify, and a graduated row
            // links to its campaign instead of offering derive.
            const queueEntry = queueByIdentity.get(
              `${(biz.business_name ?? '').toLowerCase().trim()}|${(biz.city ?? '').toLowerCase().trim()}`,
            );
            const linkedCampaignId = queueEntry?.processed_campaign_id ?? derivedCampaignId[idx];
            return (
              <div
                key={`${biz.business_name}-${idx}`}
                className={`rounded-lg border p-3 ${
                  isHold
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/10'
                    : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                }`}
              >
                {/* Business header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {biz.business_name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[biz.business_seek_priority] || PRIORITY_STYLES.hold}`}>
                        {biz.business_seek_priority}
                      </span>
                      {biz.business_seek_recommended && !isHold && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
                          recommended
                        </span>
                      )}
                      {isHold && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> hold
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {biz.location_status.replace('_', ' ')}
                      </span>
                      <span>·</span>
                      <span>{biz.ownership_type}</span>
                      <span>·</span>
                      <span className={FIT_STYLES[biz.category_fit]}>
                        fit: {biz.category_fit}
                      </span>
                      <span>·</span>
                      <span className={CONFIDENCE_STYLES[biz.identity_confidence]}>
                        confidence: {biz.identity_confidence}
                      </span>
                      {biz.rating != null && (
                        <>
                          <span>·</span>
                          <span>{Number(biz.rating).toFixed(1)} ★</span>
                        </>
                      )}
                      {biz.review_count != null && (
                        <>
                          <span>·</span>
                          <span>{biz.review_count} reviews</span>
                        </>
                      )}
                    </div>
                    {/* Address + phone */}
                    {(biz.address || biz.phone) && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {biz.address && <div>{biz.address}</div>}
                        {biz.phone && <div>{biz.phone}</div>}
                      </div>
                    )}
                    {/* Discovery signals */}
                    {biz.discovery_signals.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1.5">
                        {biz.discovery_signals.map((sig, si) => (
                          <span
                            key={si}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800"
                          >
                            {sig}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Bronze reason attribution — which catalog blind spot
                        surfaced this business (spec §7.4) */}
                    {Array.isArray(biz.bronze_attribution) && biz.bronze_attribution.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1.5">
                        {biz.bronze_attribution.map((attr, ai) => (
                          <span
                            key={ai}
                            title={attr.basis ?? undefined}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                          >
                            bronze: {attr.reason_key}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Competitive weaknesses — the incumbent's named
                        exposures, the pitch wedge (spec §7) */}
                    {(Array.isArray(biz.competitive_weaknesses) && biz.competitive_weaknesses.length > 0) || biz.benchmark_only ? (
                      <div className="flex items-center gap-1 flex-wrap mt-1.5">
                        {biz.benchmark_only && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                            benchmark
                          </span>
                        )}
                        {(biz.competitive_weaknesses ?? []).map((w, wi) => (
                          <span
                            key={wi}
                            title={w.basis ?? undefined}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700"
                          >
                            weakness: {w.weakness_key}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {/* Notes (e.g. disambiguation notes) */}
                    {biz.notes && (
                      <div className="mt-1.5">
                        <button
                          onClick={() => setShowNotes((v) => v === idx ? null : idx)}
                          className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showNotes === idx ? 'Hide note' : 'Show note'}
                        </button>
                        {showNotes === idx && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{biz.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {onLogGap && (
                      <button
                        onClick={() => onLogGap(biz)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800 dark:hover:bg-violet-900/40"
                        title={`Log a data gap for ${biz.business_name} on the proving ground gap log`}
                      >
                        <Flag className="w-3 h-3" />
                        Gap
                      </button>
                    )}
                    {queueEntry ? (
                      <Link
                        href={`/settings/admin/marketing-ops/queue?status=${queueEntry.status}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700/70 bg-green-50/60 border border-green-200/70 rounded dark:bg-green-900/10 dark:text-green-300/70 dark:border-green-800/60"
                        title={`Already in the prospect queue (status: ${queueEntry.status}) — click to view`}
                      >
                        <Check className="w-3 h-3" />
                        In queue
                      </Link>
                    ) : queuedFeedback[idx] === 'queued' && queuedEntryId[idx] ? (
                      <Link
                        href={`/settings/admin/marketing-ops/queue?status=queued`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/40"
                        title="Added to queue — click to view in the prospect queue"
                      >
                        <Check className="w-3 h-3" />
                        Queued
                      </Link>
                    ) : queuedFeedback[idx] === 'already' ? (
                      <Link
                        href={`/settings/admin/marketing-ops/queue?status=queued`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700/70 bg-green-50/60 border border-green-200/70 rounded dark:bg-green-900/10 dark:text-green-300/70 dark:border-green-800/60"
                        title="Already in the prospect queue — click to view"
                      >
                        <Check className="w-3 h-3" />
                        In queue
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleQueue(biz)}
                        disabled={queueingIdx !== null || queuedFeedback[idx] === 'verify'}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-900/40 disabled:opacity-50"
                        title={`Add ${biz.business_name} to the prospect queue`}
                      >
                        {queueingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Inbox className="w-3 h-3" />}
                        Queue
                      </button>
                    )}
                    {!queueEntry && (queuedFeedback[idx] === 'verify' && queuedEntryId[idx] ? (
                      <Link
                        href={`/settings/admin/marketing-ops/queue?status=verify_then_outreach`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/40"
                        title="Sent to verification queue — click to view in the prospect queue"
                      >
                        <Check className="w-3 h-3" />
                        Sent
                      </Link>
                    ) : queuedFeedback[idx] === 'already' ? null : (
                      <button
                        onClick={() => handleQueue(biz, 'verify_then_outreach')}
                        disabled={queueingIdx !== null || queuedFeedback[idx] === 'queued'}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/40 disabled:opacity-50"
                        title={`Send ${biz.business_name} to phone verification (NAP/digital presence unverified)`}
                      >
                        {queueingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Phone className="w-3 h-3" />}
                        Verify
                      </button>
                    ))}
                    {linkedCampaignId ? (
                      <Link
                        href={`/settings/admin/marketing-ops/campaigns/${linkedCampaignId}`}
                        className={
                          queueEntry?.processed_campaign_id || queuedFeedback[idx] === 'exists'
                            ? 'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700/70 bg-green-50/60 border border-green-200/70 rounded dark:bg-green-900/10 dark:text-green-300/70 dark:border-green-800/60'
                            : 'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/40'
                        }
                        title={
                          queueEntry?.processed_campaign_id || queuedFeedback[idx] === 'exists'
                            ? 'A campaign already exists for this business — click to view'
                            : 'Campaign created — click to view'
                        }
                      >
                        <Check className="w-3 h-3" />
                        Campaign
                      </Link>
                    ) : queueEntry ? null : (
                      <button
                        onClick={() => handleDerive(biz)}
                        disabled={derivingIdx !== null}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded hover:bg-cyan-100 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800 dark:hover:bg-cyan-900/40 disabled:opacity-50"
                        title={`Create a business-scope campaign for ${biz.business_name}`}
                      >
                        {derivingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Campaign
                      </button>
                    )}
                  </div>
                </div>
                {/* Provenance (collapsible) */}
                {biz.discovery_provenance.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => toggleProvenance(idx)}
                      className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {provenanceOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      {biz.discovery_provenance.length} source{biz.discovery_provenance.length !== 1 ? 's' : ''}
                    </button>
                    {provenanceOpen && (
                      <div className="mt-1 space-y-1">
                        {biz.discovery_provenance.map((prov, pi) => (
                          <div key={pi} className="text-[10px] text-gray-500 dark:text-gray-400 pl-4">
                            <span className="font-medium">{prov.source}</span>
                            {prov.role && <span className="text-gray-400"> — {prov.role}</span>}
                            {prov.url && (
                              <a
                                href={prov.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 text-cyan-600 dark:text-cyan-400 hover:underline"
                              >
                                link
                              </a>
                            )}
                            {prov.evidence_types && prov.evidence_types.length > 0 && (
                              <span className="text-gray-400"> · {prov.evidence_types.join(', ')}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {filteredBusinesses.length > 8 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            {showAll ? 'Show fewer' : `Show all ${filteredBusinesses.length} businesses`}
          </button>
        )}
      </div>

      {/* Error */}
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

function ClaimBadge({ claim }: { claim?: string | null }) {
  const c = claim ?? 'unverified';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${CLAIM_STYLES[c] ?? CLAIM_STYLES.unverified}`}>
      {CLAIM_LABELS[c] ?? c}
    </span>
  );
}

/**
 * Coverage attestation block (Discovery Scan Contract §3/§7.1). Renders the
 * derived claim, unit counts, unexecuted vectors, municipality coverage,
 * reconciliation, contract violations, the sweep ledger, and — when a
 * sibling audit with the opposite focus exists — the parity comparison.
 * All content is conditional: a pre-contract audit degrades to a single
 * "unverified" line.
 */
function ScanContractSection({
  data,
  audit,
  siblingAudits,
}: {
  data: IntelligenceDiscoveryData;
  audit: Audit;
  siblingAudits?: Audit[];
}) {
  const contract = data.scan_contract;
  const att = contract?.coverage_attestation;
  const ledger = contract?.sweep_ledger ?? [];
  const municipalities = contract?.municipality_coverage ?? [];
  const reconciliation = contract?.reconciliation;
  const violations = data.scan_contract_violations ?? [];
  const claim = att?.completeness_claim ?? 'unverified';

  // Focus-pair parity: the sibling intelligence_discovery audit on this
  // campaign carrying the opposite focus, if one was passed in.
  const sibling = (siblingAudits ?? []).find(
    (a) => a.id !== audit.id
      && a.platform === 'intelligence_discovery'
      && a.audit_data
      && (a.audit_data as IntelligenceDiscoveryData).focus
      && (a.audit_data as IntelligenceDiscoveryData).focus !== data.focus,
  );
  const siblingData = sibling?.audit_data as IntelligenceDiscoveryData | undefined;
  const siblingAtt = siblingData?.scan_contract?.coverage_attestation;
  const siblingClaim = siblingAtt?.completeness_claim ?? 'unverified';

  if (!contract) {
    return (
      <div className="mb-4 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/40 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Coverage</span>
          <ClaimBadge claim="unverified" />
        </div>
        <p className="mt-1 text-[10px] text-gray-400">
          Pre-contract audit — no sweep ledger was recorded, so market coverage is unverified.
        </p>
      </div>
    );
  }

  const counts = [
    att?.units_executed != null && att?.units_total != null
      ? `${att.units_executed}/${att.units_total} units executed`
      : att?.units_executed != null ? `${att.units_executed} units executed` : null,
    att?.units_executed_empty != null ? `${att.units_executed_empty} empty` : null,
    att?.units_not_executed != null && att.units_not_executed > 0
      ? `${att.units_not_executed} not executed` : null,
    att?.units_blocked != null && att.units_blocked > 0
      ? `${att.units_blocked} blocked` : null,
  ].filter(Boolean) as string[];

  const unmatched = reconciliation?.unmatched ?? [];

  return (
    <div className="mb-4 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50/50 dark:bg-neutral-800/40 p-3 space-y-2">
      {/* Claim + counts */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Coverage</span>
        <ClaimBadge claim={claim} />
        {counts.map((c, i) => (
          <span key={i} className="text-[10px] text-gray-500 dark:text-gray-400">{c}</span>
        ))}
      </div>

      {/* Focus parity — spec §7.1: the market is not green-lit until both
          focus ledgers pass. */}
      {sibling && siblingData && (
        <div className="flex items-center gap-2 flex-wrap text-[10px] text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-600 dark:text-gray-300">Focus parity:</span>
          <span>{data.focus}</span>
          <ClaimBadge claim={claim} />
          <span>·</span>
          <span>{siblingData.focus}</span>
          <ClaimBadge claim={siblingClaim} />
          {siblingAtt?.units_executed != null && siblingAtt?.units_total != null && (
            <span>({siblingAtt.units_executed}/{siblingAtt.units_total} units)</span>
          )}
          {claim !== siblingClaim && (
            <span className="text-amber-600 dark:text-amber-400">
              — ledgers disagree; market not green-lit
            </span>
          )}
        </div>
      )}

      {/* Contract violations (report-mode, stamped by the import gate) */}
      {violations.length > 0 && (
        <div className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-2">
          <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 mb-1">
            {violations.length} contract violation{violations.length !== 1 ? 's' : ''}
          </p>
          <ul className="space-y-0.5">
            {violations.map((v, i) => (
              <li key={i} className="text-[10px] text-amber-800 dark:text-amber-300">
                <span className="font-mono font-semibold">{v.invariant}</span> — {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unexecuted vectors — gaps are named, not silent (INV-6) */}
      {(att?.unexecuted_vector_list ?? []).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 mb-0.5">Unexecuted vectors</p>
          <ul className="space-y-0.5">
            {att!.unexecuted_vector_list!.map((v, i) => (
              <li key={i} className="text-[10px] text-gray-500 dark:text-gray-400">
                {v.vector}{v.reason ? <span className="text-gray-400"> — {v.reason}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Municipality coverage */}
      {municipalities.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">Municipalities:</span>
          {municipalities.map((m, i) => (
            <span
              key={i}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${MUNICIPALITY_STATUS_STYLES[m.status ?? ''] ?? 'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'}`}
              title={m.shared_zip ? `shares ZIP ${m.shared_zip}` : undefined}
            >
              {m.municipality}{m.status ? `: ${m.status.replace('_', ' ')}` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Reconciliation — operator-supplied ground truth (INV-7) */}
      {reconciliation && (reconciliation.operator_supplied_members?.length ?? 0) > 0 && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-600 dark:text-gray-300">Reconciliation:</span>
          {' '}{(reconciliation.matched_to_candidates?.length ?? 0)}/{(reconciliation.operator_supplied_members?.length ?? 0)} operator-supplied members matched
          {unmatched.length > 0 && (
            <span className="text-red-600 dark:text-red-400">
              {' '}— unmatched: {unmatched.join(', ')} (scan missed a real business)
            </span>
          )}
          {(reconciliation.excluded_with_reason?.length ?? 0) > 0 && (
            <span>
              {' '}· excluded: {reconciliation.excluded_with_reason!.map((e) => e.member).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Sweep ledger (collapsible) */}
      {ledger.length > 0 && (
        <details className="rounded border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2">
          <summary className="text-[10px] font-semibold text-gray-600 dark:text-gray-300 cursor-pointer">
            Sweep ledger ({ledger.length} unit{ledger.length !== 1 ? 's' : ''})
          </summary>
          <ul className="mt-1.5 space-y-1">
            {ledger.map((row, i) => (
              <li key={i} className="flex items-center gap-2 flex-wrap text-[10px] text-gray-500 dark:text-gray-400">
                <span className="font-mono text-gray-600 dark:text-gray-300">{row.unit_id}</span>
                {row.status && (
                  <span className={`px-1.5 py-0.5 rounded border ${LEDGER_STATUS_STYLES[row.status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {row.status.replace(/_/g, ' ')}
                  </span>
                )}
                {typeof row.findings_count === 'number' && <span>{row.findings_count} findings</span>}
                {row.platforms_swept && row.platforms_swept.length > 0 && (
                  <span title={row.platforms_swept.join(', ')}>{row.platforms_swept.length} platform{row.platforms_swept.length !== 1 ? 's' : ''}</span>
                )}
                {row.labels_swept && row.labels_swept.length > 0 && (
                  <span title={row.labels_swept.join(', ')}>{row.labels_swept.length} label{row.labels_swept.length !== 1 ? 's' : ''}</span>
                )}
                {row.blocked_reason && (
                  <span className="text-amber-600 dark:text-amber-400" title={row.blocked_reason}>
                    blocked: {row.blocked_reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
