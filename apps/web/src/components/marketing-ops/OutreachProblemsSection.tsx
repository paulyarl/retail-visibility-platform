'use client';

import { useState } from 'react';
import { CheckCircle, Copy, Loader2, Megaphone, Sparkles } from 'lucide-react';
import type { OutreachProblem } from '@/services/MarketingOpsService';

/**
 * Outreach Problems & Solutions — shared card list rendering the
 * `outreach_problems` contract (Triage & Repair Outreach Problems spec §5).
 * One component serves all three surfaces: the triage briefing panel, the
 * per-issue repair briefing card, and the business audit card.
 *
 * Entries are read-only analyst copy — the workflow is copy → paste into the
 * pitch construction (openers) workspace. When `onUseAsOpener` is provided,
 * each spoken line also gets a "Use as opener" hand-off button.
 */

export interface OutreachOpenerOutcome {
  warnings?: string[];
}

interface OutreachProblemsSectionProps {
  problems: OutreachProblem[];
  /** Optional heading override — defaults to "Outreach Problems & Solutions". */
  title?: string;
  /** Per-line "Use as opener" hand-off. Receives the clicked line's text and
   *  the entry's problem (used as primary_angle). Return warnings to surface
   *  quality-gate issues next to the button. */
  onUseAsOpener?: (line: string, problem: string) => Promise<OutreachOpenerOutcome | void>;
}

export default function OutreachProblemsSection({ problems, title, onUseAsOpener }: OutreachProblemsSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; warnings?: string[]; error?: string }>>({});

  if (!Array.isArray(problems) || problems.length === 0) return null;

  const copyLine = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      // Clipboard may be unavailable — the text remains selectable.
    }
  };

  const useAsOpener = async (key: string, line: string, problem: string) => {
    if (!onUseAsOpener) return;
    setBusyKey(key);
    try {
      const outcome = await onUseAsOpener(line, problem);
      setResults((r) => ({ ...r, [key]: { ok: true, warnings: outcome?.warnings } }));
    } catch (err: any) {
      setResults((r) => ({ ...r, [key]: { ok: false, error: err?.message || 'Failed to create opener' } }));
    } finally {
      setBusyKey(null);
    }
  };

  const lineBlock = (entry: OutreachProblem, idx: number, kind: 'regular' | 'hook', text: string) => {
    const key = `${idx}:${kind}`;
    const result = results[key];
    const isHook = kind === 'hook';
    return (
      <div
        className={`rounded p-2 ${
          isHook
            ? 'border-l-2 border-purple-400 dark:border-purple-600 bg-purple-50/60 dark:bg-purple-950/20'
            : 'bg-gray-50 dark:bg-neutral-900/40 border border-gray-200/60 dark:border-neutral-700/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
            isHook ? 'text-purple-700 dark:text-purple-300' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {isHook ? 'Hook' : 'Regular'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => copyLine(key, text)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-neutral-700 rounded transition-colors"
              title="Copy this line verbatim"
            >
              <Copy className="w-3 h-3" />
              {copiedKey === key ? 'Copied!' : 'Copy'}
            </button>
            {onUseAsOpener && (
              <button
                onClick={() => useAsOpener(key, text, entry.problem)}
                disabled={busyKey === key}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50 rounded transition-colors"
                title="Seed an opener in the Openers workspace from this line"
              >
                {busyKey === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Use as opener
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs italic text-gray-700 dark:text-gray-300 leading-relaxed">"{text}"</p>
        {result && (
          <p className={`mt-1 text-[11px] flex items-center gap-1 ${
            result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {result.ok ? (
              <>
                <CheckCircle className="w-3 h-3" />
                Opener created
                {result.warnings && result.warnings.length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400" title={result.warnings.join('\n')}>
                    ({result.warnings.length} warning{result.warnings.length === 1 ? '' : 's'})
                  </span>
                )}
              </>
            ) : (
              result.error
            )}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-medium text-xs">
        <Megaphone className="w-3.5 h-3.5" />
        {title ?? 'Outreach Problems & Solutions'}
      </div>
      <div className="space-y-2.5 pl-5">
        {problems.map((entry, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/60 p-3 space-y-2"
          >
            {/* Headline + usage chip */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug">
                {entry.problem}
              </p>
              {entry.outreach_use && (
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {entry.outreach_use}
                </span>
              )}
            </div>

            {/* Two spoken lines */}
            {entry.regular && lineBlock(entry, idx, 'regular', entry.regular)}
            {entry.hook && lineBlock(entry, idx, 'hook', entry.hook)}

            {/* The fix */}
            {entry.solution && (
              <p className="text-xs text-gray-700 dark:text-gray-300">
                <span className="font-medium text-gray-900 dark:text-gray-100">The fix: </span>
                {entry.solution}
              </p>
            )}

            {/* Evidence — collapsible */}
            {entry.evidence && (
              <details className="text-xs">
                <summary className="cursor-pointer text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  Evidence
                </summary>
                <p className="mt-1 pl-3 text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-neutral-700">
                  {entry.evidence}
                </p>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
