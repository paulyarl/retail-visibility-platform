'use client';

/**
 * IntelligentTriageCard — Sprint 5
 *
 * Inline triage decision panel placed above the tabs in CampaignDetailClient,
 * visible only for `seek`-stage campaigns. The triage decision is a
 * prerequisite gate, not a parallel view.
 *
 * Displays:
 *   - Recommended playbook (code, name, category, archetype)
 *   - Rule Confidence / Signal Match Strength (NOT "ML confidence")
 *   - Triggered signals with family-colored badges
 *   - Triage reasoning (plain language)
 *   - FITD offer + retainer pitch preview
 *
 * Actions:
 *   - Evaluate / Re-evaluate (with optional BBB pre-flight inputs)
 *   - Accept Recommendation → re-categorizes campaign + applies FITD fee
 *   - Override → dropdown of active playbooks
 *
 * States: pending / accepted / overridden
 *
 * Integrates SignalEnrichmentPanel for operator "human-in-the-loop" signal
 * correction — operators can add signals the AI scan missed or remove false
 * positives, then re-run triage.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp,
  ShieldCheck, ArrowRightCircle, Building2, DollarSign, FileText, Info,
} from 'lucide-react';
import marketingOpsService, {
  type TriageResult,
  type TriageSourceAudit,
  type PlaybookCatalogEntry,
  type Campaign,
} from '@/services/MarketingOpsService';
import SignalEnrichmentPanel from '@/components/marketing-ops/SignalEnrichmentPanel';

interface IntelligentTriageCardProps {
  campaign: Campaign;
  onRefresh: () => void;
}

const FAMILY_COLORS: Record<string, string> = {
  RA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  DS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  WC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  VP: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};

const CATEGORY_COLORS: Record<string, string> = {
  review_management: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  recovery_management: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  triage_management: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

function familyColor(code: string): string {
  return FAMILY_COLORS[code.split('_')[0]] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function IntelligentTriageCard({ campaign, onRefresh }: IntelligentTriageCardProps) {
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [playbooks, setPlaybooks] = useState<PlaybookCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideCode, setOverrideCode] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [showBbbInputs, setShowBbbInputs] = useState(false);
  const [bbbGrade, setBbbGrade] = useState('');
  const [bbbComplaints, setBbbComplaints] = useState('');
  const [showEnrichment, setShowEnrichment] = useState(false);

  const fetchTriage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [triageResult, pbList] = await Promise.all([
        marketingOpsService.getTriage(campaign.id).catch(() => null),
        marketingOpsService.listPlaybooks({ isActive: true }).catch(() => [] as PlaybookCatalogEntry[]),
      ]);
      setTriage(triageResult);
      setPlaybooks(pbList);
    } catch (err: any) {
      setError(err.message || 'Failed to load triage');
    } finally {
      setLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => { fetchTriage(); }, [fetchTriage]);

  const handleEvaluate = async () => {
    setEvaluating(true);
    setError(null);
    try {
      const input: any = {};
      if (bbbGrade || bbbComplaints) {
        input.bbb = {};
        if (bbbGrade) input.bbb.bbb_grade = bbbGrade;
        if (bbbComplaints) input.bbb.unanswered_bbb_complaints = parseInt(bbbComplaints) || 0;
      }
      const result = await marketingOpsService.evaluateTriage(campaign.id, input);
      setTriage(result);
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate triage');
    } finally {
      setEvaluating(false);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await marketingOpsService.acceptTriage(campaign.id);
      onRefresh();
      await fetchTriage();
    } catch (err: any) {
      setError(err.message || 'Failed to accept triage');
    } finally {
      setAccepting(false);
    }
  };

  const handleOverride = async () => {
    if (!overrideCode) return;
    setOverriding(true);
    setError(null);
    try {
      await marketingOpsService.overrideTriage(campaign.id, overrideCode, overrideReason || undefined);
      setShowOverride(false);
      setOverrideCode('');
      setOverrideReason('');
      onRefresh();
      await fetchTriage();
    } catch (err: any) {
      setError(err.message || 'Failed to override triage');
    } finally {
      setOverriding(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading triage...
        </div>
      </div>
    );
  }

  const accepted = triage?.isOperatorAccepted === true;
  const overridden = triage?.overriddenPlaybook != null;
  const decided = accepted || overridden;
  const recommended = triage?.recommendedPlaybook;
  const effective = triage?.overriddenPlaybook ?? triage?.recommendedPlaybook;

  return (
    <div className={`rounded-xl border p-4 mb-6 ${
      accepted
        ? 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
        : overridden
          ? 'border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10'
          : 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Intelligent Triage</h3>
          {accepted && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Accepted
            </span>
          )}
          {overridden && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <ArrowRightCircle className="w-3 h-3" /> Overridden
            </span>
          )}
        </div>
        {!decided && (
          <button
            onClick={handleEvaluate}
            disabled={evaluating}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {evaluating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {triage ? 'Re-evaluate' : 'Evaluate'}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400 mb-3">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Source audit lineage — show which audit fed the triage */}
      {triage && (
        <div className="flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mb-2">
          {triage.sourceAudit ? (
            <>
              <FileText className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                Evaluated from{' '}
                <strong className="font-mono text-gray-600 dark:text-gray-300">
                  {triage.sourceAudit.platform}
                </strong>{' '}
                audit ({new Date(triage.sourceAudit.createdAt).toLocaleDateString()})
              </span>
            </>
          ) : (
            <>
              <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                No signal-aware audit found — signals derived from campaign fields only.
                Run a <strong>business_analysis</strong> audit for stronger triage matches.
              </span>
            </>
          )}
        </div>
      )}

      {/* No triage result yet */}
      {!triage && !error && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>No triage evaluation yet. Click <strong>Evaluate</strong> to run the signal extractor and match against the playbook catalog.</p>
          {/* BBB pre-flight inputs */}
          <div className="mt-3">
            <button
              onClick={() => setShowBbbInputs((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showBbbInputs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              BBB pre-flight inputs (optional, enables PB-04)
            </button>
            {showBbbInputs && (
              <div className="mt-2 grid grid-cols-2 gap-2 max-w-md">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">BBB Grade</label>
                  <select value={bbbGrade} onChange={(e) => setBbbGrade(e.target.value)} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent">
                    <option value="">—</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="F">F</option>
                    <option value="NR">NR (Not Rated)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">Unanswered Complaints</label>
                  <input type="number" min={0} value={bbbComplaints} onChange={(e) => setBbbComplaints(e.target.value)} placeholder="0" className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Triage result display */}
      {triage && effective && (
        <div className="space-y-3">
          {/* Recommended playbook card */}
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">{effective.code}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{effective.name}</span>
                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[effective.category] ?? 'bg-gray-100 text-gray-700'}`}>
                  {effective.category.replace(/_/g, ' ')}
                </span>
                <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-medium bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300">
                  {effective.archetype}
                </span>
              </div>
              {overridden && recommended && recommended.code !== effective.code && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Originally recommended: {recommended.code} ({recommended.name})
                </p>
              )}

              {/* Confidence + fees */}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                <span>
                  <span className="text-gray-400">Rule Confidence:</span>{' '}
                  <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                    {Math.round(triage.confidenceScore * 100)}%
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  FITD: {formatCents(effective.fitdDefaultFeeCents)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  Retainer: {formatCents(effective.retainerFeeCents)}
                </span>
              </div>
            </div>
          </div>

          {/* Detected signals */}
          {triage.detectedSignals.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
                Triggered Signals ({triage.detectedSignals.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {triage.detectedSignals.map((sig) => (
                  <span
                    key={sig.code}
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-mono font-medium ${familyColor(sig.code)}`}
                    title={sig.label}
                  >
                    {sig.code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          {triage.triageReasoning && (
            <div className="rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Rationale</p>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{triage.triageReasoning}</p>
            </div>
          )}

          {/* Actions */}
          {!decided && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {accepting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Accept Recommendation
              </button>
              <button
                onClick={() => setShowOverride((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-neutral-600 rounded hover:bg-gray-50 dark:hover:bg-neutral-700"
              >
                <ArrowRightCircle className="w-3 h-3" /> Override
              </button>
              <button
                onClick={() => setShowEnrichment((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {showEnrichment ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Enrich signals
              </button>
            </div>
          )}

          {/* Override dialog */}
          {showOverride && !decided && (
            <div className="rounded-lg bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Override with different playbook</p>
              <select value={overrideCode} onChange={(e) => setOverrideCode(e.target.value)} className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent">
                <option value="">Select playbook...</option>
                {playbooks.map((pb) => (
                  <option key={pb.id} value={pb.code}>{pb.code} — {pb.name}</option>
                ))}
              </select>
              <input type="text" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason (optional)" className="w-full text-xs border border-gray-200 dark:border-neutral-600 rounded px-2 py-1.5 bg-transparent" />
              <div className="flex items-center gap-2">
                <button onClick={handleOverride} disabled={overriding || !overrideCode} className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50">
                  {overriding ? 'Overriding...' : 'Confirm Override'}
                </button>
                <button onClick={() => setShowOverride(false)} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Signal enrichment panel */}
          {showEnrichment && !decided && (
            <SignalEnrichmentPanel
              campaignId={campaign.id}
              triage={triage}
              onReEvaluated={(result) => setTriage(result)}
            />
          )}

          {/* Decided state — show summary + allow re-evaluate */}
          {decided && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleEvaluate}
                disabled={evaluating}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {evaluating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Re-evaluate
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
