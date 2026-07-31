'use client';

import { useState } from 'react';
import marketingOpsService, { AssemblyStatus, RenderResult } from '@/services/MarketingOpsService';

export default function RenderPanel({
  campaignId, status, onRendered,
}: {
  campaignId: string;
  status: AssemblyStatus | null;
  onRendered: () => Promise<void>;
}) {
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = status?.ready ?? false;

  const handleRender = async () => {
    setRendering(true);
    setError(null);
    try {
      const res = await marketingOpsService.renderDeliverable(campaignId);
      setResult(res);
      await onRendered();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800">
      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Render Deliverable</h2>

      {status && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Slots approved" value={`${status.approvedSlots}/${status.totalSlots}`} />
          <Stat label="Slots skipped" value={String(status.skippedSlots)} />
          <Stat label="Sections approved" value={`${status.approvedSections}/${status.totalSections}`} />
          <Stat label="Sections skipped" value={String(status.skippedSections)} />
        </div>
      )}

      {!ready && status && status.missingApprovals.length > 0 && (
        <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          Cannot render yet: {status.missingApprovals.join(', ')}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={handleRender}
        disabled={!ready || rendering}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {rendering ? 'Rendering...' : 'Render Deliverable →'}
      </button>

      {result && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
          <div className="text-xs font-medium text-green-700 dark:text-green-300">Rendered successfully</div>
          <div className="mt-2 flex gap-3">
            <a
              href={result.pdfPath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              Download PDF
            </a>
            <a
              href={result.txtPath}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              Download TXT
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-neutral-900/50">
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}
