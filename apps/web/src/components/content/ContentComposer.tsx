'use client';

/**
 * ContentComposer — Phase-1 unified posts composer (TENANT_CONTENT_HUB_SPEC §4).
 * One authored post → destination checkboxes → POST /content/posts multiplexes
 * into gbp_posts + social_posts. Destinations render capability-aware from the
 * summary's channel gates.
 */

import { useState } from 'react';
import type { ContentChannelCard } from '@/lib/content-hub';

const META_DESTINATIONS = [
  { key: 'meta_facebook', label: 'Facebook' },
  { key: 'meta_instagram', label: 'Instagram' },
  { key: 'meta_threads', label: 'Threads' },
] as const;

export interface ComposerResult {
  channel: string;
  ok: boolean;
  scheduled?: boolean;
  error?: string;
}

export default function ContentComposer({
  channels,
  placeFeedEnabled,
  busy,
  onClose,
  onSubmit,
}: {
  channels: ContentChannelCard[];
  placeFeedEnabled: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    body: string;
    mediaUrl?: string;
    scheduledFor?: string;
    destinations: { gbp?: boolean; meta?: string[]; linkedin?: boolean; place?: boolean };
  }) => void;
}) {
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [gbp, setGbp] = useState(true);
  const [place, setPlace] = useState(true);
  const [meta, setMeta] = useState<Set<string>>(new Set(['meta_facebook']));
  const [linkedin, setLinkedin] = useState(true);

  const gbpEnabled = channels.find((c) => c.key === 'google_gbp')?.capability.enabled ?? false;
  const socialEnabled = channels.find((c) => c.key === 'social_meta')?.capability.enabled ?? false;
  const linkedinEnabled = channels.find((c) => c.key === 'social_linkedin')?.capability.enabled ?? false;
  const anyDestination = (placeFeedEnabled && place) || (gbpEnabled && gbp) || (socialEnabled && meta.size > 0) || (linkedinEnabled && linkedin);
  const canSubmit = body.trim().length > 0 && anyDestination && !busy;

  const toggleMeta = (key: string) =>
    setMeta((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">New post</h2>
            <p className="text-xs text-gray-500 mt-0.5">Write once — publish to every channel you select.</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={3000}
          placeholder="What's new at your business?"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="url"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="Image URL (optional — GBP only for now)"
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Publish to</p>
          <div className="flex flex-wrap gap-2">
            <label className={`inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-sm ${placeFeedEnabled ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'} ${place && placeFeedEnabled ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
              <input type="checkbox" className="sr-only" checked={place && placeFeedEnabled} disabled={!placeFeedEnabled} onChange={() => setPlace(!place)} />
              Directory listing{!placeFeedEnabled ? ' 🔒' : ''}
            </label>
            <label className={`inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-sm ${gbpEnabled ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'} ${gbp && gbpEnabled ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
              <input type="checkbox" className="sr-only" checked={gbp && gbpEnabled} disabled={!gbpEnabled} onChange={() => setGbp(!gbp)} />
              Google Business Profile{!gbpEnabled ? ' 🔒' : ''}
            </label>
            {META_DESTINATIONS.map((d) => (
              <label key={d.key} className={`inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-sm ${socialEnabled ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'} ${meta.has(d.key) && socialEnabled ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                <input type="checkbox" className="sr-only" checked={meta.has(d.key) && socialEnabled} disabled={!socialEnabled} onChange={() => toggleMeta(d.key)} />
                {d.label}{!socialEnabled ? ' 🔒' : ''}
              </label>
            ))}
            <label className={`inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-sm ${linkedinEnabled ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'} ${linkedin && linkedinEnabled ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
              <input type="checkbox" className="sr-only" checked={linkedin && linkedinEnabled} disabled={!linkedinEnabled} onChange={() => setLinkedin(!linkedin)} />
              LinkedIn{!linkedinEnabled ? ' 🔒' : ''}
            </label>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Schedule for later <span className="text-gray-400 font-normal">(optional — publishes on next scheduler tick if set)</span>
          </label>
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                body: body.trim(),
                mediaUrl: mediaUrl.trim() || undefined,
                scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
                destinations: {
                  gbp: gbpEnabled && gbp ? true : undefined,
                  meta: socialEnabled && meta.size ? [...meta] : undefined,
                  linkedin: linkedinEnabled && linkedin ? true : undefined,
                  place: placeFeedEnabled && place ? true : undefined,
                },
              })
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl px-5 py-2"
          >
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
