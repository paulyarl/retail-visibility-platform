'use client';

/**
 * ContentAboutEditor — Phase-4 owner-authored About (TENANT_CONTENT_HUB_SPEC §5).
 * Writes directory_listings_list.description through the same
 * updateDirectoryListing path DirectorySettingsPanel uses — the override IS
 * the field: owner text supersedes whatever narrative the seed carried.
 */

import { useState } from 'react';
import { tenantDirectoryManagementService } from '@/services/TenantDirectoryManagementService';

export default function ContentAboutEditor({
  tenantId,
  initialText,
  editable,
  onSaved,
}: {
  tenantId: string;
  initialText: string;
  editable: boolean;
  onSaved: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const dirty = text !== initialText;

  if (!editable) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900">About your business</h3>
        <p className="text-xs text-gray-400 mt-1">Available once your directory listing is enabled.</p>
      </div>
    );
  }

  const save = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await tenantDirectoryManagementService.updateDirectoryListing(tenantId, { description: text.trim() || null });
      setFeedback(result ? 'Saved — live on your public listing.' : 'Save failed.');
      if (result) onSaved();
    } catch {
      setFeedback('Save failed — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">About your business</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          The narrative on your public listing — the one block of copy that's fully yours.
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="What makes your business yours? This replaces any auto-generated description."
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{text.length}/2000</span>
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={save}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl px-4 py-1.5"
        >
          {busy ? 'Saving…' : 'Save About'}
        </button>
      </div>
      {feedback && <p className="text-xs text-gray-500">{feedback}</p>}
    </div>
  );
}
