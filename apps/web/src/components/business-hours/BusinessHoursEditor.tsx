'use client';

/**
 * BusinessHoursEditor — the canonical opening-hours editor.
 *
 * One implementation for the whole journey: queue prospect → campaign → seed
 * listing. Paste the block from the Google Business Profile "Hours" section,
 * parse it, then fine-tune per day. Emits the `business_hours` shape stored on
 * `directory_listings_list` / `mkt_campaigns_list` / the queue snapshot
 * (see `@/lib/business-hours`).
 *
 * Controlled: the caller owns the hours + timezone state.
 */

import { useState } from 'react';
import { Clock } from 'lucide-react';
import {
  DAYS,
  type DayHours,
  parseGoogleHoursPaste,
} from '@/lib/business-hours';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Australia/Sydney',
];

export interface BusinessHoursEditorProps {
  hours: Record<string, DayHours>;
  timezone: string;
  onHoursChange: (hours: Record<string, DayHours>) => void;
  onTimezoneChange: (timezone: string) => void;
  /** Provenance source fields — rendered only when a handler is supplied. */
  sourceName?: string;
  sourceUrl?: string;
  onSourceNameChange?: (value: string) => void;
  onSourceUrlChange?: (value: string) => void;
  /** Tighter spacing for inline/embedded use (e.g. the prospect card). */
  compact?: boolean;
  disabled?: boolean;
}

export default function BusinessHoursEditor({
  hours,
  timezone,
  onHoursChange,
  onTimezoneChange,
  sourceName,
  sourceUrl,
  onSourceNameChange,
  onSourceUrlChange,
  compact = false,
  disabled = false,
}: BusinessHoursEditorProps) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);

  const setDay = (day: string, patch: Partial<DayHours>) => {
    onHoursChange({ ...hours, [day]: { ...hours[day], ...patch } });
  };

  const handleParse = () => {
    const parsed = parseGoogleHoursPaste(pasteText);
    if (!parsed) {
      setPasteError('Could not parse any days — expected lines like "Monday 9 AM–5 PM" or "Monday" followed by "- 9 AM–5 PM" on the next line.');
      setParsedCount(null);
      return;
    }
    onHoursChange(parsed);
    setParsedCount(DAYS.filter((d) => !parsed[d].closed).length);
    setPasteError(null);
  };

  const showSource = !!onSourceNameChange || !!onSourceUrlChange;
  const pad = compact ? 'p-2.5' : 'p-3';

  return (
    <div className={disabled ? 'opacity-60 pointer-events-none' : undefined}>
      {/* Timezone */}
      <div className={compact ? 'mb-3' : 'mb-4'}>
        <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>
        <select
          className="w-full border border-gray-300 dark:border-neutral-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      {/* Paste from Google Business Profile */}
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

      {/* Per-day schedule */}
      <div className="space-y-2">
        {DAYS.map((day) => {
          const h = hours[day];
          return (
            <div key={day} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <div className="md:col-span-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={!h.closed}
                    onChange={(e) => setDay(day, { closed: !e.target.checked })}
                  />
                  <span className="capitalize">{day}</span>
                </label>
              </div>
              {!h.closed && (
                <>
                  <div className="md:col-span-4">
                    <input
                      type="time"
                      className="w-full border border-gray-300 dark:border-neutral-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      value={h.open}
                      onChange={(e) => setDay(day, { open: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-1 text-center text-xs text-gray-400">to</div>
                  <div className="md:col-span-4">
                    <input
                      type="time"
                      className="w-full border border-gray-300 dark:border-neutral-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                      value={h.close}
                      onChange={(e) => setDay(day, { close: e.target.value })}
                    />
                  </div>
                </>
              )}
              {h.closed && <div className="md:col-span-9 text-sm text-gray-400">Closed</div>}
            </div>
          );
        })}
      </div>

      {showSource && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hours source name</label>
            <input
              className="w-full border border-gray-300 dark:border-neutral-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={sourceName ?? ''}
              onChange={(e) => onSourceNameChange?.(e.target.value)}
              placeholder="Google Maps, owner confirmation, etc."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hours source URL</label>
            <input
              className="w-full border border-gray-300 dark:border-neutral-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
              value={sourceUrl ?? ''}
              onChange={(e) => onSourceUrlChange?.(e.target.value)}
              placeholder="https://"
            />
          </div>
        </div>
      )}
    </div>
  );
}
