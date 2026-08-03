'use client';

/**
 * SignalEnrichmentPanel — operator "human-in-the-loop" signal correction
 *
 * Renders the AI-detected signals from the triage result, plus a dropdown
 * picker of known signals from the registry. Operators can:
 *   - Add signals the AI scan missed (e.g. BBB grade not in audit)
 *   - Remove false positives (e.g. www vs non-www URL "mismatch")
 *   - Re-run triage with the enriched signal set
 *
 * The dropdown is sourced from the signal registry (GET /signals), so it
 * only offers known, active signal codes — no free-text entry.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, X, RefreshCw, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react';
import marketingOpsService, {
  type SignalRegistryEntry,
  type TriageResult,
  type DetectedSignal,
} from '@/services/MarketingOpsService';

interface SignalEnrichmentPanelProps {
  campaignId: string;
  triage: TriageResult | null;
  onReEvaluated?: (result: TriageResult) => void;
}

const FAMILY_COLORS: Record<string, string> = {
  RA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  DS: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  WC: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CP: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  VP: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};

const FAMILY_LABELS: Record<string, string> = {
  RA: 'Reputation & Administrative',
  DS: 'Digital Surface & Profile',
  WC: 'Website & Conversion',
  CP: 'Cross-Platform & NAP',
  VP: 'Content & Visual Proof',
};

function familyColor(code: string): string {
  const family = code.split('_')[0];
  return FAMILY_COLORS[family] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

export default function SignalEnrichmentPanel({ campaignId, triage, onReEvaluated }: SignalEnrichmentPanelProps) {
  const [registry, setRegistry] = useState<SignalRegistryEntry[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<string>('all');
  const [addedSignals, setAddedSignals] = useState<string[]>([]);
  const [removedSignals, setRemovedSignals] = useState<string[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load the signal registry on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const signals = await marketingOpsService.listSignals();
        if (!cancelled) {
          setRegistry(signals.filter((s) => s.isActive));
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to load signal registry');
        }
      } finally {
        if (!cancelled) setLoadingRegistry(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reset enrichment state when triage changes
  useEffect(() => {
    setAddedSignals([]);
    setRemovedSignals([]);
    setError(null);
    setSuccess(null);
  }, [triage?.id]);

  // The current effective signal set: AI-detected + operator-added - operator-removed
  const aiDetectedCodes = new Set((triage?.detectedSignals ?? []).map((s) => s.code));
  const effectiveSignals = [
    ...Array.from(aiDetectedCodes).filter((c) => !removedSignals.includes(c)),
    ...addedSignals.filter((c) => !aiDetectedCodes.has(c)),
  ];

  const handleAddSignal = useCallback((code: string) => {
    setAddedSignals((prev) => prev.includes(code) ? prev : [...prev, code]);
    setRemovedSignals((prev) => prev.filter((c) => c !== code));
    setDropdownOpen(false);
    setSuccess(null);
  }, []);

  const handleRemoveSignal = useCallback((code: string) => {
    if (aiDetectedCodes.has(code)) {
      // AI-detected: mark for removal
      setRemovedSignals((prev) => prev.includes(code) ? prev : [...prev, code]);
    } else {
      // Operator-added: just remove from the added list
      setAddedSignals((prev) => prev.filter((c) => c !== code));
    }
    setSuccess(null);
  }, [aiDetectedCodes]);

  const handleReEvaluate = async () => {
    setEvaluating(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await marketingOpsService.evaluateTriage(campaignId, {
        operator_added_signals: addedSignals.length > 0 ? addedSignals : undefined,
        operator_removed_signals: removedSignals.length > 0 ? removedSignals : undefined,
      });
      setSuccess(`Re-triaged: ${result.recommendedPlaybook.code} (${Math.round(result.confidenceScore * 100)}% confidence)`);
      onReEvaluated?.(result);
    } catch (err: any) {
      setError(err.message || 'Failed to re-evaluate triage');
    } finally {
      setEvaluating(false);
    }
  };

  const hasChanges = addedSignals.length > 0 || removedSignals.length > 0;
  const families = ['all', ...Array.from(new Set(registry.map((s) => s.family))).sort()];
  const availableToAdd = registry
    .filter((s) => !effectiveSignals.includes(s.code))
    .filter((s) => selectedFamily === 'all' || s.family === selectedFamily);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Signal Enrichment</h4>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
            Add signals the AI scan missed, or remove false positives, then re-run triage.
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={handleReEvaluate}
            disabled={evaluating}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {evaluating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Re-run triage
          </button>
        )}
      </div>

      {/* Current effective signal set */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
          Current signals ({effectiveSignals.length})
        </p>
        {effectiveSignals.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No signals detected. Add signals below to trigger triage.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {effectiveSignals.map((code) => {
              const isAiDetected = aiDetectedCodes.has(code);
              const isRemoved = removedSignals.includes(code);
              const label = registry.find((s) => s.code === code)?.label ?? code;
              return (
                <span
                  key={code}
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono font-medium ${familyColor(code)} ${
                    isRemoved ? 'opacity-40 line-through' : ''
                  }`}
                  title={`${label}${isAiDetected ? ' (AI-detected)' : ' (operator-added)'}`}
                >
                  {code}
                  {!isRemoved && (
                    <button
                      onClick={() => handleRemoveSignal(code)}
                      className="hover:text-black dark:hover:text-white"
                      title={isAiDetected ? 'Remove (false positive)' : 'Remove'}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {isRemoved && (
                    <button
                      onClick={() => handleRemoveSignal(code === code ? code : code)}
                      className="hover:text-black dark:hover:text-white no-underline"
                      title="Undo removal"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
        {removedSignals.length > 0 && (
          <p className="mt-1 text-[10px] text-gray-400">
            {removedSignals.length} signal{removedSignals.length !== 1 ? 's' : ''} marked for removal (struck through)
          </p>
        )}
      </div>

      {/* Add signal dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          disabled={loadingRegistry || availableToAdd.length === 0}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-neutral-600 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50"
        >
          <Plus className="w-3 h-3" />
          Add signal
          <ChevronDown className="w-3 h-3" />
        </button>

        {dropdownOpen && (
          <div className="absolute z-10 mt-1 w-80 max-h-72 overflow-auto bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-600 rounded-lg shadow-lg">
            {/* Family filter */}
            <div className="sticky top-0 bg-white dark:bg-neutral-800 border-b border-gray-100 dark:border-neutral-700 p-2">
              <div className="flex flex-wrap gap-1">
                {families.map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFamily(f)}
                    className={`px-2 py-0.5 text-[10px] rounded ${
                      selectedFamily === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-gray-300'
                    }`}
                  >
                    {f === 'all' ? 'All' : FAMILY_LABELS[f] ?? f}
                  </button>
                ))}
              </div>
            </div>

            {/* Signal list */}
            <div className="p-1">
              {availableToAdd.length === 0 ? (
                <p className="text-xs text-gray-400 p-2 text-center">No signals available to add</p>
              ) : (
                availableToAdd.map((signal) => (
                  <button
                    key={signal.code}
                    onClick={() => handleAddSignal(signal.code)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 flex items-start gap-2"
                  >
                    <span className={`flex-shrink-0 inline-block rounded px-1.5 py-0.5 text-[9px] font-mono font-medium ${familyColor(signal.code)}`}>
                      {signal.code}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-300 flex-1">
                      {signal.label}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status messages */}
      {error && (
        <div className="mt-3 flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mt-3 flex items-start gap-2 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}
    </div>
  );
}
