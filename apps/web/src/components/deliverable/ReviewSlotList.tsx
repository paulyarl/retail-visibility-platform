'use client';

import { useState } from 'react';
import marketingOpsService, { ReviewSlot } from '@/services/MarketingOpsService';
import ReviewSlotCard from './ReviewSlotCard';

export default function ReviewSlotList({
  campaignId, slots, onChanged,
}: {
  campaignId: string;
  slots: ReviewSlot[];
  onChanged: () => Promise<void>;
}) {
  const [ingesting, setIngesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchInfo, setBatchInfo] = useState<string | null>(null);

  const approvedCount = slots.filter((s) => s.status === 'approved').length;
  const draftCount = slots.filter((s) => s.status === 'draft').length;
  const skippedCount = slots.filter((s) => s.status === 'skipped').length;

  const handleIngest = async () => {
    setIngesting(true);
    setBatchError(null);
    setBatchInfo(null);
    try {
      const result = await marketingOpsService.ingestReviews(campaignId);
      setBatchInfo(`Ingested ${result.ingested} reviews.`);
      await onChanged();
    } catch (e) {
      setBatchError((e as Error).message);
    } finally {
      setIngesting(false);
    }
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    setBatchError(null);
    setBatchInfo(null);
    try {
      const result = await marketingOpsService.generateAllResponses(campaignId);
      const msg = `Generated ${result.generated} responses.`;
      setBatchInfo(result.errors.length > 0 ? `${msg} ${result.errors.length} error(s).` : msg);
      await onChanged();
    } catch (e) {
      setBatchError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Review Responses ({slots.length} slots)
          </h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {approvedCount} approved · {draftCount} draft · {skippedCount} skipped
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleIngest}
            disabled={ingesting || slots.length > 0}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-gray-300"
          >
            {ingesting ? 'Ingesting...' : 'Ingest Reviews'}
          </button>
          <button
            onClick={handleGenerateAll}
            disabled={generating || slots.length === 0 || draftCount === 0}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate All'}
          </button>
        </div>
      </div>

      {batchError && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {batchError}
        </div>
      )}
      {batchInfo && (
        <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-300">
          {batchInfo}
        </div>
      )}

      {slots.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          No reviews ingested yet. Click &quot;Ingest Reviews&quot; to pull all unanswered reviews from the audit.
        </div>
      ) : (
        <div className="space-y-4">
          {slots.map((slot, i) => (
            <ReviewSlotCard
              key={slot.id}
              slot={slot}
              slotNumber={i + 1}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}
