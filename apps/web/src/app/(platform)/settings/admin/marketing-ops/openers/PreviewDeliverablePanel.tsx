'use client';

/**
 * PreviewDeliverablePanel — the "Preview Deliverable / Approach Kit" tab.
 *
 * Rendered inside the Openers workspace between "Pitch Construction" and
 * "Call Script". It displays the entire assembled pitch as a single
 * copy/paste surface — the operator copies it, captures/annotates
 * screenshots of the preview slots, and uploads them to the Diagnostic
 * Gallery tab on the campaign page (the "Preview Deliverable / Approach
 * Kit" deliverable).
 *
 * Dependency: Pitch Construction gathers the data for the preview slots.
 * This tab is the natural next step — it surfaces the assembled output so
 * the operator can produce the deliverable without re-navigating.
 *
 * Next Steps destination: the Diagnostic Gallery tab on the campaign page,
 * where screenshots are uploaded after capture and annotation.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Copy,
  Download,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  ImageIcon,
  Clipboard,
} from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, {
  type OutreachPitch,
} from '@/services/MarketingOpsService';

interface PreviewDeliverablePanelProps {
  campaignId: string;
}

export default function PreviewDeliverablePanel({ campaignId }: PreviewDeliverablePanelProps) {
  const [pitches, setPitches] = useState<OutreachPitch[]>([]);
  const [selectedPitchId, setSelectedPitchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchPitches = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await marketingOpsService.listPitches(campaignId);
      setPitches(list);
      // Auto-select the most recent pitch (list is ordered by created_at desc
      // from the backend). If a pitch was already selected and still exists,
      // keep the selection.
      if (list.length > 0) {
        const stillExists = selectedPitchId && list.some((p) => p.id === selectedPitchId);
        setSelectedPitchId(stillExists ? selectedPitchId : list[0].id);
      } else {
        setSelectedPitchId(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assembled pitches');
    } finally {
      setLoading(false);
    }
  }, [campaignId, selectedPitchId]);

  useEffect(() => {
    fetchPitches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const selectedPitch = pitches.find((p) => p.id === selectedPitchId) ?? null;
  const assembledText = selectedPitch?.assembled_text ?? null;

  const handleCopy = () => {
    if (!assembledText) return;
    navigator.clipboard.writeText(assembledText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!assembledText) return;
    const blob = new Blob([assembledText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview_deliverable_${campaignId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading assembled pitch...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        <button onClick={() => setError(null)} className="mt-2 text-xs text-red-600 hover:underline">Dismiss</button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5 space-y-6">
      {/* ─── Header ─── */}
      <section>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clipboard className="w-4 h-4" />
              Preview Deliverable / Approach Kit
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
              The entire assembled pitch from Pitch Construction, surfaced as a
              single copy/paste surface. Copy it, capture and annotate screenshots
              of the preview slots, then upload them to the Diagnostic Gallery as
              the deliverable (the approach kit).
            </p>
          </div>
          <button
            onClick={fetchPitches}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </section>

      {/* ─── Pitch selector ─── */}
      {pitches.length > 1 && (
        <section>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            Assembled pitch
          </label>
          <select
            value={selectedPitchId ?? ''}
            onChange={(e) => setSelectedPitchId(e.target.value || null)}
            className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pitches.map((p, i) => (
              <option key={p.id} value={p.id}>
                #{pitches.length - i} — {new Date(p.created_at).toLocaleString()}
              </option>
            ))}
          </select>
        </section>
      )}

      {/* ─── Empty state ─── */}
      {pitches.length === 0 && (
        <section className="text-center py-10 border border-dashed border-gray-200 dark:border-neutral-700 rounded-lg">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 dark:bg-neutral-800 mb-3">
            <Clipboard className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            No assembled pitch yet
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
            Assemble a pitch on the Pitch Construction tab first. The assembled
            output will appear here as a copy/paste surface for producing the
            deliverable.
          </p>
          <Link
            href={`/settings/admin/marketing-ops/openers?campaign=${campaignId}&tab=pitch`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Go to Pitch Construction <ArrowRight className="w-3 h-3" />
          </Link>
        </section>
      )}

      {/* ─── Assembled pitch copy/paste surface ─── */}
      {assembledText && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Assembled pitch{' '}
              {selectedPitch && <code className="font-mono">{selectedPitch.id}</code>}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <p className="mb-2 text-xs text-blue-600 dark:text-blue-400">
            Copy the assembled pitch, then capture and annotate screenshots of
            the preview slots. Upload them to the Diagnostic Gallery as the
            deliverable.
          </p>
          <pre className="text-sm text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-[60vh] overflow-y-auto">
            {assembledText}
          </pre>
        </section>
      )}

      {/* ─── Pitch has no assembled_text (edge case) ─── */}
      {selectedPitch && !assembledText && (
        <section className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            This pitch record exists but has no assembled text. Re-assemble it on
            the Pitch Construction tab.
          </p>
        </section>
      )}

      {/* ─── Next Steps ─── */}
      {pitches.length > 0 && (
        <section className="border-t border-gray-100 dark:border-neutral-700 pt-4">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
            Next Steps
          </h3>
          <div className="space-y-2">
            <Link
              href={`/settings/admin/marketing-ops/campaigns/${campaignId}?tab=gallery`}
              className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700"
            >
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Go to Diagnostic Gallery
              </span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/settings/admin/marketing-ops/campaigns/${campaignId}?tab=checklist`}
              className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> Go to Checklist
              </span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/settings/admin/marketing-ops/campaigns/${campaignId}`}
              className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> Go to campaign
              </span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Upload the captured, annotated screenshots to the Diagnostic Gallery
            to present the preview slot contents as the deliverable (the approach
            kit).
          </p>
        </section>
      )}
    </div>
  );
}
