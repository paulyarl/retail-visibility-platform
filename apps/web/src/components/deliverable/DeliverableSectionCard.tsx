'use client';

import { useState } from 'react';
import marketingOpsService, { DeliverableSection } from '@/services/MarketingOpsService';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  skipped: 'bg-gray-100 text-gray-500 dark:bg-neutral-700 dark:text-gray-400',
};

export default function DeliverableSectionCard({
  section, onChanged,
}: {
  section: DeliverableSection;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(section.content ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await marketingOpsService.updateSection(section.id, editText);
      setEditing(false);
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
      await marketingOpsService.approveSection(section.id);
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
      await marketingOpsService.skipSection(section.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{section.title}</h2>
          <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[section.status] ?? STATUS_BADGE.draft}`}>
            {section.status}
          </span>
        </div>
      </div>

      {editing ? (
        <div>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={12}
            className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs dark:border-neutral-600 dark:bg-neutral-700 dark:text-gray-100"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleSave}
              disabled={busy}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setEditText(section.content ?? ''); }}
              disabled={busy}
              className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <pre className="mb-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-700 dark:bg-neutral-900/50 dark:text-gray-300">
            {section.content ?? 'No content generated yet.'}
          </pre>

          {error && <div className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</div>}

          <div className="flex gap-2">
            <button
              onClick={() => { setEditText(section.content ?? ''); setEditing(true); }}
              disabled={busy}
              className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-gray-300"
            >
              Edit
            </button>
            {section.status !== 'approved' && (
              <button
                onClick={handleApprove}
                disabled={busy || !section.content}
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
            )}
            {section.status !== 'skipped' && (
              <button
                onClick={handleSkip}
                disabled={busy}
                className="rounded-md bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-gray-400"
              >
                Skip
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
