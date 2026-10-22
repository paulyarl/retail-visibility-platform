'use client';

import { useEffect, useState } from 'react';
import marketingOpsService, { type GroundTruthStatus } from '@/services/MarketingOpsService';

export type GroundTruthLevel = 'latest' | 'deep';

const TONES = {
  amber: {
    label: 'text-amber-800 dark:text-amber-300',
    check: 'border-amber-400',
    select: 'border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300',
    hint: 'text-amber-600 dark:text-amber-400',
  },
  sky: {
    label: 'text-sky-800 dark:text-sky-300',
    check: 'border-sky-400',
    select: 'border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-300',
    hint: 'text-sky-600 dark:text-sky-400',
  },
  indigo: {
    label: 'text-indigo-800 dark:text-indigo-300',
    check: 'border-indigo-400',
    select: 'border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-300',
    hint: 'text-indigo-600 dark:text-indigo-400',
  },
} as const;

/**
 * GroundTruthKnob — the `google_maps_ground_truth` opt-in spend control
 * (TOUCH LADDER §14.1a). Checkbox + level select + inline credit cost —
 * the spend decision is made looking at the number. Shared by every
 * briefing surface (repair triage, website gap, archetype briefing) so the
 * knob looks and prices identically everywhere.
 */
export default function GroundTruthKnob({
  campaignId,
  enabled,
  level,
  onChange,
  tone = 'amber',
}: {
  campaignId: string;
  enabled: boolean;
  level: GroundTruthLevel;
  onChange: (next: { enabled: boolean; level: GroundTruthLevel }) => void;
  tone?: keyof typeof TONES;
}) {
  const [status, setStatus] = useState<GroundTruthStatus | null>(null);
  const t = TONES[tone];

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    marketingOpsService.getGroundTruthStatus(campaignId, level)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [enabled, level, campaignId]);

  return (
    <label className={`flex items-center gap-2 text-xs ${t.label}`}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange({ enabled: e.target.checked, level })}
        className={`rounded ${t.check}`}
      />
      Include live Google Maps ground truth
      {enabled && (
        <select
          value={level}
          onChange={(e) => onChange({ enabled, level: e.target.value as GroundTruthLevel })}
          className={`rounded-md border bg-white dark:bg-neutral-800 px-1.5 py-0.5 text-[11px] ${t.select}`}
        >
          <option value="latest">Latest (details + reviews)</option>
          <option value="deep">Deep (+ posts & photos)</option>
        </select>
      )}
      {enabled && status && (
        <span className={`text-[11px] ${t.hint}`}>
          {status.cached
            ? `cached packet${status.fetched_at ? ` · fetched ${new Date(status.fetched_at).toLocaleDateString()}` : ''} · 0 credits`
            : status.configured
              ? `~${status.est_credits} credits`
              : 'unavailable (no API key)'}
        </span>
      )}
    </label>
  );
}
