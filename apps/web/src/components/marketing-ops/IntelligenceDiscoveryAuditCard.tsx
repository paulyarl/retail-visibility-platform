'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, Loader2, Inbox, Check, ChevronDown, ChevronRight, MapPin, AlertTriangle, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Audit } from '@/services/MarketingOpsService';
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

interface DiscoveredBusiness {
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
  notes?: string;
  [key: string]: any;
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

export default function IntelligenceDiscoveryAuditCard({
  audit,
  campaignId,
}: {
  audit: Audit;
  campaignId: string;
}) {
  const data = parseDiscovery(audit);
  const [derivingIdx, setDerivingIdx] = useState<number | null>(null);
  const [queueingIdx, setQueueingIdx] = useState<number | null>(null);
  const [queuedFeedback, setQueuedFeedback] = useState<Record<number, 'queued' | 'verify' | 'exists' | 'already'>>({});
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'qualifying' | 'hold'>('all');
  const [expandedProvenance, setExpandedProvenance] = useState<Set<number>>(new Set());
  const [showNotes, setShowNotes] = useState<number | null>(null);
  const router = useRouter();

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
      // Do NOT pass discovery_signals as detected_signals — INT_* codes must
      // not enter the triage engine (Sprint §5.11). The discovery context is
      // preserved in the campaign notes via the derive-business note field.
      const child = await service.deriveBusinessCampaign(campaignId, {
        business_name: biz.business_name,
        rating: biz.rating ?? undefined,
        review_count: biz.review_count ?? undefined,
        location: biz.address || biz.location_status,
      });
      router.push(`/settings/admin/marketing-ops/campaigns/${child.id}`);
    } catch (err: any) {
      setDeriveError(err.message || 'Failed to create campaign');
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
          website: biz.website,
          ownership_type: biz.ownership_type,
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
                    <button
                      onClick={() => handleQueue(biz)}
                      disabled={queueingIdx !== null || queuedFeedback[idx] === 'queued' || queuedFeedback[idx] === 'verify'}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 dark:bg-slate-900/20 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-900/40 disabled:opacity-50"
                      title={queuedFeedback[idx] === 'queued' ? 'Added to queue' : `Add ${biz.business_name} to the prospect queue`}
                    >
                      {queueingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : queuedFeedback[idx] === 'queued' ? <Check className="w-3 h-3 text-green-600" /> : <Inbox className="w-3 h-3" />}
                      {queuedFeedback[idx] === 'queued' ? 'Queued' : 'Queue'}
                    </button>
                    <button
                      onClick={() => handleQueue(biz, 'verify_then_outreach')}
                      disabled={queueingIdx !== null || queuedFeedback[idx] === 'queued' || queuedFeedback[idx] === 'verify'}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/40 disabled:opacity-50"
                      title={queuedFeedback[idx] === 'verify' ? 'Sent to verification queue' : `Send ${biz.business_name} to phone verification (NAP/digital presence unverified)`}
                    >
                      {queueingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : queuedFeedback[idx] === 'verify' ? <Check className="w-3 h-3 text-green-600" /> : <Phone className="w-3 h-3" />}
                      {queuedFeedback[idx] === 'verify' ? 'Verifying' : 'Verify'}
                    </button>
                    {queuedFeedback[idx] === 'already' && (
                      <span className="text-[10px] text-slate-400" title="Already in the queue">already</span>
                    )}
                    {queuedFeedback[idx] === 'exists' && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400" title="A campaign already exists">exists</span>
                    )}
                    <button
                      onClick={() => handleDerive(biz)}
                      disabled={derivingIdx !== null}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded hover:bg-cyan-100 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800 dark:hover:bg-cyan-900/40 disabled:opacity-50"
                      title={`Create a business-scope campaign for ${biz.business_name}`}
                    >
                      {derivingIdx === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Campaign
                    </button>
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
