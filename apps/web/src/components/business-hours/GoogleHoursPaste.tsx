'use client';

/**
 * GoogleHoursPaste — paste-and-parse panel for a GBP "Hours" block.
 *
 * Shared by the seed editor (BusinessHoursEditor) and the tenant settings
 * hours editor — one parser, one panel. Emits the parsed DayHours map; the
 * caller decides how to apply it to its own hours model.
 */

import { useState } from 'react';
import { Clock } from 'lucide-react';
import {
  DAYS,
  type DayHours,
  parseGoogleHoursPaste,
} from '@/lib/business-hours';

export interface GoogleHoursPasteProps {
  onApply: (hours: Record<string, DayHours>) => void;
  /** Tighter spacing for inline/embedded use (e.g. the prospect card). */
  compact?: boolean;
}

export default function GoogleHoursPaste({ onApply, compact = false }: GoogleHoursPasteProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);

  const handleParse = () => {
    const parsed = parseGoogleHoursPaste(pasteText);
    if (!parsed) {
      setPasteError('Could not parse any days — expected lines like "Monday 9 AM–5 PM" or "Monday" followed by "- 9 AM–5 PM" on the next line.');
      setParsedCount(null);
      return;
    }
    onApply(parsed);
    setParsedCount(DAYS.filter((d) => !parsed[d].closed).length);
    setPasteError(null);
  };

  const pad = compact ? 'p-2.5' : 'p-3';

  return (
    <div className={`mb-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 ${pad}`}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Paste hours from Google
        </label>
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          {pasteOpen ? 'Hide' : 'Show'}
        </button>
      </div>
      {pasteOpen && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Copy the hours block from the Google Business Profile &ldquo;Hours&rdquo;
            section and paste it below. Each day&rsquo;s hours populate the schedule.
          </p>
          <textarea
            className="w-full border border-gray-300 dark:border-neutral-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
            rows={compact ? 6 : 10}
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setPasteError(null);
              setParsedCount(null);
            }}
            placeholder={'Saturday\n- 12 AM\u20138:30 PM\n\nSunday\n- 9 AM\u20138:30 PM\n\nMonday\n- 9 AM\u20138:30 PM\n\u2026'}
          />
          {pasteError && <p className="text-xs text-red-600 dark:text-red-400">{pasteError}</p>}
          {parsedCount !== null && !pasteError && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Populated {parsedCount} day{parsedCount === 1 ? '' : 's'}.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleParse}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/60"
            >
              <Clock className="w-3.5 h-3.5" />
              Parse &amp; apply
            </button>
            <button
              type="button"
              onClick={() => {
                setPasteText('');
                setPasteError(null);
                setParsedCount(null);
              }}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
