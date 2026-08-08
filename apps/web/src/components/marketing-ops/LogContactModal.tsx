'use client';

import { useState, useEffect } from 'react';
import { X, Sparkles, RefreshCw, Link2 } from 'lucide-react';
import type { Campaign, ContactChannel, ContactOutcome, FreshSnapshot } from '@/services/MarketingOpsService';
import { marketingOpsService } from '@/services/MarketingOpsService';

const CHANNEL_OPTIONS: { value: ContactChannel; label: string }[] = [
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'website', label: 'Website' },
  { value: 'social', label: 'Social' },
  { value: 'in_person', label: 'In Person' },
  { value: 'other', label: 'Other' },
];

const OUTCOME_OPTIONS: { value: ContactOutcome; label: string }[] = [
  { value: 'reached', label: 'Reached' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'left_message', label: 'Left Message' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'callback_scheduled', label: 'Callback Scheduled' },
  { value: 'other', label: 'Other' },
];

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

interface LogContactModalProps {
  campaign: Campaign;
  onClose: () => void;
  onLogged: () => void;
}

export default function LogContactModal({ campaign, onClose, onLogged }: LogContactModalProps) {
  // Pre-fill channel selector with channels the campaign actually has.
  const availableChannels: ContactChannel[] = [];
  if (campaign.phone) availableChannels.push('phone');
  if (campaign.email) availableChannels.push('email');
  if (campaign.website_url) availableChannels.push('website');
  if (campaign.social_profiles && campaign.social_profiles.length > 0) availableChannels.push('social');
  availableChannels.push('in_person', 'other');

  const [channel, setChannel] = useState<ContactChannel>(availableChannels[0] ?? 'phone');
  const [contactDate, setContactDate] = useState(todayISO());
  const [outcome, setOutcome] = useState<ContactOutcome>('reached');
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [messageSnapshot, setMessageSnapshot] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [snapshot, setSnapshot] = useState<FreshSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insertingLink, setInsertingLink] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshotLoading(true);
    marketingOpsService.getFreshSnapshot(campaign.id)
      .then((s) => { if (!cancelled) setSnapshot(s); })
      .catch(() => { /* soft-fail: snapshot is optional */ })
      .finally(() => { if (!cancelled) setSnapshotLoading(false); });
    return () => { cancelled = true; };
  }, [campaign.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await marketingOpsService.logContact(campaign.id, {
        contact_channel: channel,
        contact_date: contactDate,
        outcome,
        follow_up_date: followUpDate || undefined,
        notes: notes || undefined,
        message_snapshot: messageSnapshot || undefined,
        message_subject: channel === 'email' ? (messageSubject || undefined) : undefined,
      });
      onLogged();
    } catch (err: any) {
      setError(err.message || 'Failed to log contact');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

  const handleInsertGalleryLink = async () => {
    setInsertingLink(true);
    setError(null);
    try {
      const tokens = await marketingOpsService.listGalleryTokens(campaign.id);
      // Find the most recent active (non-expired, non-converted) token
      const now = new Date();
      const activeToken = tokens
        .filter((t) => !t.converted_at && (!t.expires_at || new Date(t.expires_at) > now))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (!activeToken) {
        setError('No active gallery link found. Generate one in the Diagnostic Gallery tab first.');
        return;
      }

      const galleryUrl = `${window.location.origin}/preview/${activeToken.token}`;
      const linkText = `\n\nView your diagnostic report: ${galleryUrl}\n`;
      setMessageSnapshot((prev) => (prev ? prev + linkText : linkText.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gallery link');
    } finally {
      setInsertingLink(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5 shadow-xl dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Log contact</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</div>
        )}

        {/* Fresh-data snapshot badge */}
        <div className="mb-4 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {snapshotLoading ? (
            <><RefreshCw className="h-3 w-3 animate-spin" /> Fetching fresh data…</>
          ) : snapshot?.dataSnapshot ? (
            <>
              <Sparkles className="h-3 w-3" />
              Data freshness: fetched {snapshot.dataFreshAt ? new Date(snapshot.dataFreshAt).toLocaleTimeString() : 'just now'}
              {snapshot.dataSnapshot.review_count != null && <span className="ml-2">· {snapshot.dataSnapshot.review_count} reviews</span>}
              {snapshot.dataSnapshot.average_rating != null && <span className="ml-1">· {snapshot.dataSnapshot.average_rating}★</span>}
              {snapshot.dataSnapshot.unaddressed_reviews != null && <span className="ml-1">· {snapshot.dataSnapshot.unaddressed_reviews} unaddressed</span>}
            </>
          ) : (
            <><Sparkles className="h-3 w-3" /> No audit data available — snapshot will be empty.</>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Channel</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value as ContactChannel)} className={inputClass}>
                {availableChannels.map((ch) => (
                  <option key={ch} value={ch}>{CHANNEL_OPTIONS.find((o) => o.value === ch)?.label ?? ch}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Contact date</span>
              <input type="date" value={contactDate} onChange={(e) => setContactDate(e.target.value)} className={inputClass} required />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Outcome</span>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as ContactOutcome)} className={inputClass}>
              {OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Follow-up date (optional)</span>
            <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={inputClass} />
          </label>

          {channel === 'email' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Message subject</span>
              <input type="text" value={messageSubject} onChange={(e) => setMessageSubject(e.target.value)} placeholder="Subject line sent to prospect" className={inputClass} />
            </label>
          )}

          <label className="block">
            <div className="mb-1 flex items-center justify-between">
              <span className="block text-xs font-medium text-gray-600 dark:text-gray-400">Message sent (optional)</span>
              <button
                type="button"
                onClick={handleInsertGalleryLink}
                disabled={insertingLink}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400"
                title="Insert the active diagnostic gallery link into the message body"
              >
                {insertingLink ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                Insert Gallery Link
              </button>
            </div>
            <textarea value={messageSnapshot} onChange={(e) => setMessageSnapshot(e.target.value)} rows={4} placeholder="Paste the message body you sent to the prospect" className={inputClass} />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What happened on the call/email?" className={inputClass} />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Log contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
