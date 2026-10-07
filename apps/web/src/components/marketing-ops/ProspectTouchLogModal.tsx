'use client';

import { useState } from 'react';
import { X, Phone, Mail, Globe, Share2, PhoneCall, Loader2 } from 'lucide-react';
import { marketingOpsService } from '@/services/MarketingOpsService';
import { resolveProspectChannels, type ProspectChannelSource } from '@/lib/prospect-channels';

/**
 * ProspectTouchLogModal — the canonical pre-campaign touch log
 * (logProspectTouch / ProvingGroundCadenceService.logTouch). One modal shared
 * by the queue worklist, the prospect communications page, and the PG
 * cockpit communications panel.
 *
 * Shows the prospect's known channels up front — the resolved phone (call +
 * text links), email, website, and socials from the queue snapshot (verified
 * NAP first, then the discovery scan's raw evidence) plus the channel ladder
 * when the cadence built one — so the operator can dial/copy without
 * leaving the modal.
 */

/** Channel union accepted by the canonical seed-touch log (logProspectTouch). */
type TouchChannel = 'call' | 'email' | 'sms' | 'mail' | 'form' | 'referral' | 'other';

const RUNG_CHIP: Record<string, string> = {
  call: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  email: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  sms: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  mail: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  form: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  referral: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300',
};

export interface ProspectTouchEntry extends ProspectChannelSource {
  /** Queue entry id — the log-touch endpoint key. */
  id: string;
  business_name?: string | null;
  title?: string | null;
}

interface ProspectTouchLogModalProps {
  entry: ProspectTouchEntry;
  onClose: () => void;
  onLogged: () => void | Promise<void>;
}

export default function ProspectTouchLogModal({ entry, onClose, onLogged }: ProspectTouchLogModalProps) {
  const ladder = entry.channel_sequence ?? [];
  const [channel, setChannel] = useState<TouchChannel>(
    () => ladder[entry.current_channel_index ?? 0]?.channel ?? 'call',
  );
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingDuration, setRecordingDuration] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const channels = resolveProspectChannels(entry);
  const name = entry.business_name || entry.title || 'Prospect';

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await marketingOpsService.logProspectTouch(entry.id, {
        channel,
        outcome: (outcome || undefined) as any,
        notes: notes || undefined,
        recording_url: recordingUrl.trim() || undefined,
        recording_duration_seconds: recordingDuration.trim()
          ? Number(recordingDuration.trim())
          : undefined,
      });
      await onLogged();
    } catch (err: any) {
      setError(err.message || 'Failed to log touch');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6 max-w-md w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <PhoneCall className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Log touch</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {name} · pre-campaign
            </p>
          </div>
          <button onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Known channels — the resolved contact values (verified NAP →
            discovery snapshot → ladder contacts) with in-place actions. */}
        {(channels.phone || channels.email || channels.website || channels.socials.length > 0) && (
          <div className="mb-3 rounded-md border border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-700">
            {channels.phone && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="w-14 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Phone</span>
                <span className="flex-1 truncate text-xs text-gray-800 dark:text-gray-200">{channels.phone}</span>
                <a href={`tel:${channels.phone}`} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30">Call</a>
                <a href={`sms:${channels.phone}`} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30">Text</a>
              </div>
            )}
            {channels.email && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="w-14 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Email</span>
                <span className="flex-1 truncate text-xs text-gray-800 dark:text-gray-200">{channels.email}</span>
                <a href={`mailto:${channels.email}`} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30">Email</a>
              </div>
            )}
            {channels.website && (
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Globe className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="w-14 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">Website</span>
                <span className="flex-1 truncate text-xs text-gray-800 dark:text-gray-200">{channels.website}</span>
                <a href={channels.website} target="_blank" rel="noopener noreferrer" className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30">Open</a>
              </div>
            )}
            {channels.socials.map((sp, i) => (
              <div key={`${sp.platform}-${i}`} className="flex items-center gap-2 px-3 py-1.5">
                <Share2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <span className="w-14 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{sp.platform || 'Social'}</span>
                <span className="flex-1 truncate text-xs text-gray-800 dark:text-gray-200">{sp.url}</span>
                <a href={sp.url} target="_blank" rel="noopener noreferrer" className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30">Open</a>
              </div>
            ))}
          </div>
        )}

        {/* Channel ladder — the cadence's ordered rungs; current highlighted. */}
        {ladder.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1" title="Channel ladder — current rung highlighted">
            {ladder.map((rung, i) => (
              <span
                key={i}
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  rung.status === 'dead'
                    ? 'bg-gray-100 text-gray-400 line-through dark:bg-neutral-700 dark:text-gray-500'
                    : i === (entry.current_channel_index ?? 0)
                      ? (RUNG_CHIP[rung.channel] ?? RUNG_CHIP.other)
                      : 'bg-gray-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-400'
                }`}
                title={`${rung.channel}${rung.contact ? ` · ${rung.contact}` : ''}${rung.status === 'dead' ? ' (dead)' : ''}`}
              >
                {rung.channel}
              </span>
            ))}
          </div>
        )}

        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Channel</label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as TouchChannel)}
          className="w-full mb-3 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
        >
          {(['call', 'email', 'sms', 'mail', 'form', 'referral', 'other'] as TouchChannel[]).map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Outcome</label>
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="w-full mb-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
        >
          <option value="">— logged only (no signal) —</option>
          <optgroup label="Live contact">
            <option value="connected">connected (live reply → in thread)</option>
            <option value="claimed">claimed</option>
          </optgroup>
          <optgroup label="Retry / advance">
            <option value="no_answer">no answer (retry +1d, max 2)</option>
            <option value="voicemail">voicemail (next rung +3bd)</option>
            <option value="no_reply">no reply — email (next rung +5bd)</option>
            <option value="unread">unread — text/DM (abandon +2d)</option>
            <option value="read_no_reply">read, no reply (next rung +5d)</option>
            <option value="form_submitted">form submitted (+7d)</option>
            <option value="referral_asked">referral asked (+14d)</option>
          </optgroup>
          <optgroup label="Dead channel">
            <option value="bad_number">bad number / disconnected</option>
            <option value="bounce">bounce (email dead)</option>
          </optgroup>
          <optgroup label="Terminal">
            <option value="not_interested">not interested (dismiss)</option>
          </optgroup>
        </select>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">
          Dead channels don&apos;t consume a touch slot. Cap: 3 consuming touches / 30 days → hold 60d.
        </p>

        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Call notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="What happened…"
          className="w-full mb-4 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
        />

        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Recording <span className="font-normal text-gray-400 dark:text-gray-500">— optional link</span>
        </label>
        <div className="flex gap-2 mb-4">
          <input
            type="url"
            placeholder="https://… (recording URL)"
            value={recordingUrl}
            onChange={(e) => setRecordingUrl(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
          />
          <input
            type="number"
            min={0}
            placeholder="sec"
            value={recordingDuration}
            onChange={(e) => setRecordingDuration(e.target.value)}
            className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
            Log touch
          </button>
        </div>
      </div>
    </div>
  );
}
