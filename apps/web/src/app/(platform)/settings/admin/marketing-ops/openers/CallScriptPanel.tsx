'use client';

import { useState, useEffect, useCallback } from 'react';
import { marketingOpsService, type AssembledCallScript, type HookAngle } from '@/services/MarketingOpsService';

interface CallScriptPanelProps {
  campaignId: string;
  campaignPhone: string | null;
  onLogCall?: (angle: HookAngle) => void;
}

export default function CallScriptPanel({ campaignId, campaignPhone, onLogCall }: CallScriptPanelProps) {
  const [script, setScript] = useState<AssembledCallScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<HookAngle | null>(null);
  const [copiedStage, setCopiedStage] = useState<string | null>(null);
  const [expandedObjection, setExpandedObjection] = useState<number | null>(null);

  const fetchScript = useCallback(async (angle?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await marketingOpsService.getCallScript(campaignId, angle);
      setScript(result);
      setSelectedAngle(result.stages.hook.angle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load call script');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (!campaignPhone) {
      setLoading(false);
      return;
    }
    fetchScript();
  }, [fetchScript, campaignPhone]);

  const handleAngleChange = (angle: HookAngle) => {
    if (angle === selectedAngle) return;
    setSelectedAngle(angle);
    fetchScript(angle);
  };

  const handleCopy = async (text: string, stageName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStage(stageName);
      setTimeout(() => setCopiedStage(null), 2000);
    } catch {
      // Clipboard not available
    }
  };

  if (!campaignPhone) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No phone number on campaign. Add one in Business Contact Details to enable the Call Script.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        <button
          onClick={() => fetchScript(selectedAngle ?? undefined)}
          className="mt-2 text-xs font-medium text-red-700 underline dark:text-red-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!script) return null;

  const { stages, hookOptions, objections, callContext } = script;

  return (
    <div className="space-y-6">
      {/* Call Context Header */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Number to dial</span>
              <button
                onClick={() => handleCopy(callContext.phone, 'phone')}
                className="font-mono text-lg font-semibold text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                title="Click to copy"
              >
                {callContext.phone}
              </button>
              {copiedStage === 'phone' && <span className="text-xs text-green-600">Copied!</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Ask for: </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {callContext.owner_name ?? 'Unknown — ask "Am I speaking with the owner or manager?"'}
                </span>
                {callContext.owner_name && (
                  <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${
                    callContext.owner_name_confidence === 'confirmed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : callContext.owner_name_confidence === 'inferred_low_risk'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {callContext.owner_name_confidence}
                  </span>
                )}
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Team: </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{callContext.team_signal}</span>
              </div>
            </div>
            {callContext.gallery_short_url && (
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">SMS gallery link: </span>
                <span className="font-mono text-blue-600 dark:text-blue-400">{callContext.gallery_short_url}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stage 2 — Hook Picker */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Stage 2 — Hook (pick one)
        </h3>
        <div className="space-y-2">
          {hookOptions.map((hook) => (
            <button
              key={hook.angle}
              onClick={() => handleAngleChange(hook.angle)}
              className={`w-full rounded-md border p-3 text-left transition ${
                selectedAngle === hook.angle
                  ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">#{hook.rank}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{hook.label}</span>
                </div>
                {hook.matchedSignals.length > 0 && (
                  <div className="flex gap-1">
                    {hook.matchedSignals.slice(0, 3).map((sig) => (
                      <span key={sig} className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {sig}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {selectedAngle === hook.angle && (
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{hook.resolved_phone_hook}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Five-Stage Script Body */}
      <div className="space-y-3">
        {[
          { name: 'verify', label: 'Stage 1 — Verify', text: stages.verify },
          { name: 'hook', label: `Stage 2 — Hook (${stages.hook.label})`, text: stages.hook.line },
          { name: 'bridge', label: 'Stage 3 — Bridge', text: stages.bridge },
          { name: 'ask', label: 'Stage 4 — Ask', text: stages.ask },
          { name: 'close', label: 'Stage 5 — Close', text: stages.close },
        ].map((stage) => (
          <div key={stage.name} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{stage.label}</h4>
              <button
                onClick={() => handleCopy(stage.text, stage.name)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {copiedStage === stage.name ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{stage.text}</p>
            {stage.name === 'ask' && (
              <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium">If they decline email:</span> {stages.ask_decline_fallback}
                </p>
                {callContext.gallery_short_url && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">SMS fallback:</span> Text the diagnostic link: <span className="font-mono text-blue-600 dark:text-blue-400">{callContext.gallery_short_url}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Objection Accordion */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Objection responses</h3>
        <div className="space-y-2">
          {objections.map((obj, idx) => (
            <div key={idx} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
              <button
                onClick={() => setExpandedObjection(expandedObjection === idx ? null : idx)}
                className="flex w-full items-center justify-between py-2 text-left"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{obj.objection}</span>
                <span className="text-gray-400">{expandedObjection === idx ? '−' : '+'}</span>
              </button>
              {expandedObjection === idx && (
                <p className="pb-3 text-sm text-gray-600 dark:text-gray-400">{obj.response}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Log Call Outcome */}
      <div className="flex justify-end">
        <button
          onClick={() => selectedAngle && onLogCall?.(selectedAngle)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Log call outcome
        </button>
      </div>
    </div>
  );
}
