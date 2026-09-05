'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Check, Inbox, PhoneCall, ArrowRight, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Audit } from '@/services/MarketingOpsService';
import AuditImportMetadataBadge from './AuditImportMetadataBadge';

/**
 * CategoryIdentificationAuditCard — structured renderer for
 * category_identification audits.
 *
 * Category-identification audits are created by the external-import flow when
 * a prompt template declares `output_schema.name = "category_identification"`.
 * The prompt takes a business name + location (no category input) and returns
 * ranked candidate categories with confidence scores.
 *
 * This card renders the candidate categories and provides per-candidate
 * composite action buttons:
 *   - Queue       → addToQueue (source_kind='category_identification')
 *   - Verify      → addToQueue with initial_status='verify_then_outreach'
 *   - Spawn       → deriveBusinessCampaign with category override
 *
 * When a candidate category is new (is_known_category=false), the composite
 * action also registers it in the service category vocab — the operator never
 * has to "add category first, then queue" as separate steps.
 *
 * The confidence level drives the default highlighted action:
 *   high   → Queue is primary
 *   medium → all three shown equally
 *   low    → Verify is primary
 */

interface CategoryIdentificationData {
  business_name: string;
  business_type?: 'service' | 'product' | 'hybrid' | 'unable_to_verify' | null;
  candidate_categories: {
    category: string;
    confidence: 'high' | 'medium' | 'low';
    is_known_category: boolean;
    subcategory?: string | null;
    reasoning: string;
    evidence_sources?: { source: string; url?: string | null; finding: string }[];
  }[];
  primary_category: string;
  primary_category_confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  evidence_sources?: { source: string; url?: string | null; finding: string }[];
  data_quality?: {
    sources_consulted?: number;
    limitations?: string[];
    overall_confidence?: 'high' | 'medium' | 'low';
  };
}

function isCategoryIdentificationAudit(audit: Audit): boolean {
  return audit.platform === 'category_identification'
    && audit.audit_data != null
    && typeof audit.audit_data === 'object'
    && 'candidate_categories' in audit.audit_data;
}

function parseCategoryIdentification(audit: Audit): CategoryIdentificationData | null {
  if (!isCategoryIdentificationAudit(audit)) return null;
  return audit.audit_data as CategoryIdentificationData;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  low: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

type ActionKind = 'queued' | 'verify' | 'campaign_created' | 'campaign_exists' | 'already_queued';

interface RowActionState {
  loading: boolean;
  result?: { kind: ActionKind; id?: string; category_added?: boolean };
  error?: string;
}

export default function CategoryIdentificationAuditCard({
  audit,
  campaignId,
}: {
  audit: Audit;
  campaignId: string;
}) {
  const data = parseCategoryIdentification(audit);
  const router = useRouter();
  const [actionStates, setActionStates] = useState<Record<number, RowActionState>>({});

  if (!data) return null;

  const handleAction = async (
    idx: number,
    candidate: CategoryIdentificationData['candidate_categories'][number],
    destination: 'queue' | 'verify' | 'campaign',
  ) => {
    setActionStates((prev) => ({ ...prev, [idx]: { loading: true } }));
    try {
      const { default: service } = await import('@/services/MarketingOpsService');
      const result = await service.categoryIdentificationAct(campaignId, {
        category_label: candidate.category,
        is_known: candidate.is_known_category,
        destination,
        business_name: data.business_name,
        confidence: candidate.confidence,
      });

      const kind = result.kind as ActionKind;
      setActionStates((prev) => ({
        ...prev,
        [idx]: { loading: false, result: { kind, id: result.id, category_added: result.category_added } },
      }));

      // Navigate to the spawned campaign if that was the action.
      if (kind === 'campaign_created' && result.id) {
        router.push(`/settings/admin/marketing-ops/campaigns/${result.id}`);
      }
    } catch (err: any) {
      setActionStates((prev) => ({
        ...prev,
        [idx]: { loading: false, error: err.message || 'Action failed' },
      }));
    }
  };

  return (
    <div className="border border-cyan-200 dark:border-cyan-800 rounded-lg p-4 bg-cyan-50/30 dark:bg-cyan-900/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="font-medium text-gray-900 dark:text-white">Category Identification</span>
          <span className="text-xs text-gray-400">
            {data.business_name}
          </span>
          <AuditImportMetadataBadge audit={audit} />
        </div>
        <span className="text-xs text-gray-400">{new Date(audit.created_at).toLocaleDateString()}</span>
      </div>

      {/* Business type + primary category */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="text-xs">
          <span className="text-gray-500 dark:text-gray-400">Business type</span>
          <p className="font-medium text-gray-900 dark:text-white mt-0.5">
            {data.business_type ?? '—'}
          </p>
        </div>
        <div className="text-xs">
          <span className="text-gray-500 dark:text-gray-400">Primary category</span>
          <p className="font-medium text-gray-900 dark:text-white mt-0.5">
            {data.primary_category}
          </p>
        </div>
        <div className="text-xs">
          <span className="text-gray-500 dark:text-gray-400">Confidence</span>
          <div className="mt-0.5">
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CONFIDENCE_STYLES[data.primary_category_confidence]}`}>
              {data.primary_category_confidence}
            </span>
          </div>
        </div>
      </div>

      {/* Candidate categories with actions */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Candidate categories ({data.candidate_categories.length})
        </p>
        <div className="space-y-2">
          {data.candidate_categories.map((c, i) => {
            const state = actionStates[i];
            const isPrimary = c.category === data.primary_category;
            const isDone = !!state?.result;
            return (
              <div
                key={i}
                className={`rounded border p-3 ${
                  isPrimary
                    ? 'border-cyan-300 dark:border-cyan-700 bg-white dark:bg-neutral-800'
                    : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {c.category}
                      </span>
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${CONFIDENCE_STYLES[c.confidence]}`}>
                        {c.confidence}
                      </span>
                      {c.is_known_category ? (
                        <span className="text-[10px] text-green-600 dark:text-green-400">known</span>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 inline-flex items-center gap-0.5">
                          <AlertCircle className="w-3 h-3" /> new
                        </span>
                      )}
                      {isPrimary && (
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">recommended</span>
                      )}
                      {c.subcategory && (
                        <span className="text-[10px] text-gray-400">sub: {c.subcategory}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{c.reasoning}</p>
                  </div>
                </div>

                {/* Action buttons */}
                {isDone ? (
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {state!.result!.kind === 'campaign_created' && 'Campaign spawned'}
                      {state!.result!.kind === 'campaign_exists' && 'Campaign already exists'}
                      {state!.result!.kind === 'queued' && 'Added to queue'}
                      {state!.result!.kind === 'verify' && 'Sent to verify queue'}
                      {state!.result!.kind === 'already_queued' && 'Already queued'}
                      {state!.result!.category_added && ' · category registered'}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => handleAction(i, c, 'queue')}
                      disabled={state?.loading}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
                        c.confidence === 'high'
                          ? 'text-cyan-700 bg-cyan-50 border-cyan-200 hover:bg-cyan-100 dark:text-cyan-300 dark:bg-cyan-900/20 dark:border-cyan-700 dark:hover:bg-cyan-900/40'
                          : 'text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100 dark:text-slate-300 dark:bg-slate-900/20 dark:border-slate-700 dark:hover:bg-slate-900/40'
                      } disabled:opacity-50`}
                      title="Add to prospect queue"
                    >
                      {state?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Inbox className="w-3 h-3" />}
                      Queue
                    </button>
                    <button
                      onClick={() => handleAction(i, c, 'verify')}
                      disabled={state?.loading}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
                        c.confidence === 'low'
                          ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-700 dark:hover:bg-amber-900/40'
                          : 'text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100 dark:text-slate-300 dark:bg-slate-900/20 dark:border-slate-700 dark:hover:bg-slate-900/40'
                      } disabled:opacity-50`}
                      title="Send to verify queue (phone verification before campaign)"
                    >
                      {state?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <PhoneCall className="w-3 h-3" />}
                      Verify
                    </button>
                    <button
                      onClick={() => handleAction(i, c, 'campaign')}
                      disabled={state?.loading}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded hover:bg-violet-100 dark:text-violet-300 dark:bg-violet-900/20 dark:border-violet-700 dark:hover:bg-violet-900/40 disabled:opacity-50"
                      title="Spawn a business-scope campaign for this category"
                    >
                      {state?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                      Spawn campaign
                    </button>
                    {state?.error && (
                      <span className="text-[10px] text-red-500">{state.error}</span>
                    )}
                    {!c.is_known_category && (
                      <span className="text-[10px] text-gray-400 ml-1">
                        will register &ldquo;{c.category}&rdquo; in vocab
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Overall reasoning */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Reasoning</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{data.reasoning}</p>
      </div>

      {/* Evidence sources */}
      {data.evidence_sources && data.evidence_sources.length > 0 && (
        <details className="mb-2">
          <summary className="cursor-pointer text-xs text-cyan-600 dark:text-cyan-400">
            Evidence sources ({data.evidence_sources.length})
          </summary>
          <div className="mt-1 space-y-1">
            {data.evidence_sources.map((s, i) => (
              <div key={i} className="text-[11px] text-gray-500 dark:text-gray-400">
                <span className="font-medium">{s.source}</span>
                {s.url && <span className="ml-1">· <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.url}</a></span>}
                <span className="block">{s.finding}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Data quality */}
      {data.data_quality?.limitations && data.data_quality.limitations.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-gray-400">
            Data quality limitations ({data.data_quality.limitations.length})
          </summary>
          <ul className="mt-1 list-disc list-inside text-[11px] text-gray-500 dark:text-gray-400">
            {data.data_quality.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
