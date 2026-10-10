'use client';

import { useState } from 'react';

/**
 * ExternalPromptLane — the "no internal analyst" lane for an analyst hop.
 *
 * Render the server-assembled prompt → copy it into any external LLM →
 * paste the output back → onApply writes it through the hop's write-back
 * path (execution import + apply for JSON hops, the record's external
 * write-back for prose hops).
 */
export default function ExternalPromptLane({
  fetchPrompt,
  onApply,
  applyLabel = 'Apply result',
  outputHint,
  outputPlaceholder,
}: {
  fetchPrompt: () => Promise<string>;
  onApply: (output: string) => Promise<void>;
  applyLabel?: string;
  outputHint?: string;
  outputPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState<'render' | 'apply' | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRender = async () => {
    setBusy('render');
    setError(null);
    try {
      setPrompt(await fetchPrompt());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable — the textarea is selectable as fallback
    }
  };

  const handleApply = async () => {
    if (!output.trim()) return;
    setBusy('apply');
    setError(null);
    try {
      await onApply(output.trim());
      setOutput('');
      setOpen(false);
      setPrompt(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); if (!prompt) void handleRender(); }}
        className="rounded-md bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:bg-neutral-700/50 dark:text-gray-300 dark:hover:bg-neutral-700"
      >
        Use external LLM ▸
      </button>
    );
  }

  return (
    <div className="mb-3 rounded-md border border-dashed border-gray-300 p-3 dark:border-neutral-600">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
          External lane — run this hop in any external LLM
        </p>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          Close
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Step 1 — Render prompt</p>
          <div className="flex items-center gap-1.5">
            {prompt && (
              <button
                onClick={handleCopy}
                className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-200 dark:bg-neutral-700 dark:text-gray-300"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
            <button
              onClick={handleRender}
              disabled={busy === 'render'}
              className="rounded-md border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-800"
            >
              {busy === 'render' ? 'Rendering…' : prompt ? 'Re-render' : 'Render prompt'}
            </button>
          </div>
        </div>
        {prompt ? (
          <textarea
            readOnly
            value={prompt}
            rows={5}
            className="w-full resize-y rounded-md border border-gray-200 bg-white p-2 font-mono text-[11px] text-gray-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-300"
          />
        ) : (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Renders the exact prompt the internal analyst would run, with this record's context filled in.
          </p>
        )}

        <div className="space-y-1.5 border-t border-gray-200/60 pt-2 dark:border-neutral-700/60">
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
            Step 2 — Paste external output{outputHint ? ` (${outputHint})` : ''}
          </p>
          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            rows={4}
            placeholder={outputPlaceholder ?? 'Paste the external LLM output here…'}
            className="w-full resize-y rounded-md border border-gray-300 bg-white p-2 font-mono text-[11px] text-gray-700 focus:ring-2 focus:ring-gray-400 dark:border-neutral-600 dark:bg-neutral-900 dark:text-gray-300"
          />
          <div className="flex justify-end">
            <button
              onClick={handleApply}
              disabled={busy === 'apply' || !output.trim()}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-800"
            >
              {busy === 'apply' ? 'Applying…' : applyLabel}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
