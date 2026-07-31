'use client';

import { useState } from 'react';
import marketingOpsService, { ReviewSlot } from '@/services/MarketingOpsService';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  skipped: 'bg-gray-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-400',
};

const PLATFORM_LABEL: Record<string, string> = {
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
};

export default function ReviewSlotCard({
  slot, slotNumber, onChanged,
}: {
  slot: ReviewSlot;
  slotNumber: number;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(slot.responseText ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveEdit = async () => {
    setBusy(true);
    setError(null);
    try {
      await marketingOpsService.updateSlotResponse(slot.id, editText);
      setEditing(false);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      await marketingOpsService.regenerateSlot(slot.id);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    setBusy(true);
    setError(null);
    try {
      await marketingOpsService.approveSlot(slot.id);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    setBusy(true);
    setError(null);
    try {
      await marketingOpsService.skipSlot(slot.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const ratingStars = slot.reviewRating ? '★'.repeat(slot.reviewRating) : '';

  return (
    <div className={`rounded-md border p-4 ${slot.isNegativeFirst ? 'border-red-200 bg-red-50/30 dark:border-red-800/50 dark:bg-red-900/5' : 'border-gray-200 dark:border-neutral-600'}`}>
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">Slot {slotNumber}</span>
          {slot.isNegativeFirst && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
              negative-first
            </span>
          )}
          <span>{PLATFORM_LABEL[slot.platform ?? ''] ?? slot.platform ?? 'Unknown'}</span>
          <span>·</span>
          <span>{slot.reviewDate ?? 'No date'}</span>
          {ratingStars && <span className="text-amber-500">{ratingStars}</span>}
        </div>
        <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[slot.status] ?? STATUS_BADGE.draft}`}>
          {slot.status}
        </span>
      </div>

      {/* Customer Review */}
      <div className="mb-3 rounded-md bg-gray-50 p-3 dark:bg-neutral-900/50">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Customer Review{slot.reviewAuthor ? ` — ${slot.reviewAuthor}` : ''}
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">{slot.reviewText}</p>
      </div>

      {/* Owner Response */}
      {editing ? (
        <div className="mb-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-gray-100"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={busy}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditText(slot.responseText ?? ''); }}
              disabled={busy}
              className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Owner Response
            {slot.responseSource === 'ai' && (
              <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                AI · {slot.responseAiModel ?? 'unknown'}
              </span>
            )}
            {slot.responseSource === 'external' && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-neutral-700 dark:text-gray-400">
                edited
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {slot.responseText ?? <span className="italic text-gray-400">No response generated yet.</span>}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</div>
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex gap-2">
          <button
            onClick={() => { setEditText(slot.responseText ?? ''); setEditing(true); }}
            disabled={busy}
            className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-gray-300"
          >
            Edit
          </button>
          <button
            onClick={handleRegenerate}
            disabled={busy}
            className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-gray-300"
          >
            {busy ? 'Working...' : 'Re-generate'}
          </button>
          {slot.status !== 'approved' && (
            <button
              onClick={handleApprove}
              disabled={busy || !slot.responseText}
              className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
          )}
          {slot.status !== 'skipped' && (
            <button
              onClick={handleSkip}
              disabled={busy}
              className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-gray-400"
            >
              Skip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
