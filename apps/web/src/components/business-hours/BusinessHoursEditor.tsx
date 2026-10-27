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

import { DAYS, type DayHours } from '@/lib/business-hours';
import GoogleHoursPaste from '@/components/business-hours/GoogleHoursPaste';

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
  const setDay = (day: string, patch: Partial<DayHours>) => {
    onHoursChange({ ...hours, [day]: { ...hours[day], ...patch } });
  };

  const showSource = !!onSourceNameChange || !!onSourceUrlChange;

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
      <GoogleHoursPaste onApply={onHoursChange} compact={compact} />

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
