'use client';

import { useState, useEffect, useCallback } from 'react';
import { Phone, Mail, Globe, Share2, MapPin, Calendar, CheckCircle2, Clock, ChevronDown, ChevronRight, ExternalLink, ArrowRight, ListChecks, Rocket } from 'lucide-react';
import Link from 'next/link';
import { marketingOpsService, type AssembledCallScript, type HookAngle, type OutreachLogEntry, type ContactChannel, type ContactOutcome } from '@/services/MarketingOpsService';

interface DeadNumberLog {
  id: string;
  contact_date: string;
  outcome: 'wrong_number' | 'disconnected_number';
  contact_channel: string | null;
}

const OUTCOME_LABELS: Record<ContactOutcome, string> = {
  reached: 'Reached',
  no_answer: 'No Answer',
  left_message: 'Left Message',
  interested: 'Interested',
  not_interested: 'Not Interested',
  callback_scheduled: 'Callback Scheduled',
  other: 'Other',
  auto_follow_up_scheduled: 'Auto Follow-Up',
  wrong_number: 'Wrong Number',
  disconnected_number: 'Disconnected',
  seed_outreach_scheduled: 'Seed Outreach Scheduled',
  freshness_verified: 'Freshness Verified',
  freshness_failed: 'Freshness Failed',
};

const OUTCOME_COLORS: Record<ContactOutcome, string> = {
  reached: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  no_answer: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  left_message: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  interested: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  not_interested: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  callback_scheduled: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  auto_follow_up_scheduled: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  wrong_number: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  disconnected_number: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  seed_outreach_scheduled: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  freshness_verified: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  freshness_failed: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};

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
  const [deadNumberLogs, setDeadNumberLogs] = useState<DeadNumberLog[]>([]);
  const [deadNumberAction, setDeadNumberAction] = useState<string | null>(null);
  const [recentLog, setRecentLog] = useState<OutreachLogEntry[]>([]);
  const [showFullLog, setShowFullLog] = useState(false);

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

  const fetchDeadNumberStatus = useCallback(async () => {
    try {
      const result = await marketingOpsService.getDeadNumberStatus(campaignId);
      setDeadNumberLogs(result.logs);
    } catch {
      // Non-blocking — the banner just doesn't show
    }
  }, [campaignId]);

  const fetchRecentLog = useCallback(async () => {
    try {
      const log = await marketingOpsService.listOutreach(campaignId);
      // Most recent first
      setRecentLog([...log].sort((a, b) => b.contact_date.localeCompare(a.contact_date)));
    } catch {
      // Non-blocking — the log section just doesn't show
    }
  }, [campaignId]);

  useEffect(() => {
    if (!campaignPhone) {
      setLoading(false);
      return;
    }
    fetchScript();
    fetchDeadNumberStatus();
    fetchRecentLog();
  }, [fetchScript, fetchDeadNumberStatus, fetchRecentLog, campaignPhone]);

  const handleConfirmDead = async (logId: string) => {
    setDeadNumberAction(logId);
    try {
      await marketingOpsService.confirmDeadNumber(campaignId, logId);
      setDeadNumberLogs([]);
      // Re-fetch script (phone is now null, so it'll show the no-phone state)
      fetchScript();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm dead number');
    } finally {
      setDeadNumberAction(null);
    }
  };

  const handleKeepNumber = async (logId: string) => {
    setDeadNumberAction(logId);
    try {
      await marketingOpsService.keepNumber(campaignId, logId);
      setDeadNumberLogs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge');
    } finally {
      setDeadNumberAction(null);
    }
  };

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
      {/* Dead-Number Review Banner (Sprint 2 — §13.3) */}
      {deadNumberLogs.length > 0 && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-900/20">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                Possible dead number
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-400">
                {deadNumberLogs.length > 1 ? 'Multiple calls' : 'A call'} on{' '}
                {new Date(deadNumberLogs[0].contact_date).toLocaleDateString()} reached{' '}
                {deadNumberLogs[0].outcome === 'wrong_number'
                  ? 'a wrong number'
                  : 'a disconnected line'}
                . Review the number below.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => handleConfirmDead(deadNumberLogs[0].id)}
                disabled={deadNumberAction === deadNumberLogs[0].id}
                className="rounded bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50 dark:bg-orange-600 dark:hover:bg-orange-500"
              >
                {deadNumberAction === deadNumberLogs[0].id ? 'Confirming…' : 'Confirm dead'}
              </button>
              <button
                onClick={() => handleKeepNumber(deadNumberLogs[0].id)}
                disabled={deadNumberAction === deadNumberLogs[0].id}
                className="rounded border border-orange-300 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-800/30"
              >
                Keep number
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Outreach History — gives the operator context on prior
          engagements (calls, emails) before placing the next call. */}
      {recentLog.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Recent outreach ({recentLog.length})
            </h3>
            {recentLog.length > 5 && (
              <button
                onClick={() => setShowFullLog(!showFullLog)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {showFullLog ? 'Show last 5' : `Show all ${recentLog.length}`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(showFullLog ? recentLog : recentLog.slice(0, 5)).map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded border border-gray-100 p-2 dark:border-gray-800">
                <div className="flex-shrink-0 mt-0.5">
                  {entry.contact_channel === 'phone' && <Phone className="w-4 h-4 text-gray-400" />}
                  {entry.contact_channel === 'email' && <Mail className="w-4 h-4 text-gray-400" />}
                  {entry.contact_channel === 'website' && <Globe className="w-4 h-4 text-gray-400" />}
                  {entry.contact_channel === 'social' && <Share2 className="w-4 h-4 text-gray-400" />}
                  {entry.contact_channel === 'in_person' && <MapPin className="w-4 h-4 text-gray-400" />}
                  {(entry.contact_channel === 'other' || !entry.contact_channel) && <Calendar className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {new Date(entry.contact_date).toLocaleDateString()}
                    </span>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${OUTCOME_COLORS[entry.outcome] ?? OUTCOME_COLORS.other}`}>
                      {OUTCOME_LABELS[entry.outcome] ?? entry.outcome}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase">{entry.contact_channel}</span>
                  </div>
                  {entry.notes && (
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{entry.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              {callContext.channel_hint === 'phone_first' && (
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" title="V3 audit flagged this prospect as phone-first (foundation_needed / insufficient_evidence with no email or social).">
                  Phone-first
                </span>
              )}
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
          onClick={() => {
            if (selectedAngle) {
              onLogCall?.(selectedAngle);
              // Refresh the recent log after a short delay to let the
              // modal submission complete.
              setTimeout(() => fetchRecentLog(), 1500);
            }
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          Log call outcome
        </button>
      </div>

      {/* Next Steps — workflow-momentum navigation after logging the call.
          Mirrors the Pitch Construction tab's Next Steps so the operator
          can advance the pipeline to "Preview Built" or jump to the
          campaign Checklist to check off outreach steps without losing
          context. */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Next Steps</h3>
        <div className="space-y-2">
          <Link
            href={`/settings/admin/marketing-ops/campaigns/${campaignId}?focus=preview_built`}
            className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            <span className="flex items-center gap-2"><Rocket className="w-4 h-4" /> Advance to Preview Built</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/settings/admin/marketing-ops/campaigns/${campaignId}?tab=checklist`}
            className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            <span className="flex items-center gap-2"><ListChecks className="w-4 h-4" /> Go to Checklist</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/settings/admin/marketing-ops/campaigns/${campaignId}`}
            className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-neutral-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700"
          >
            <span className="flex items-center gap-2"><ExternalLink className="w-4 h-4" /> Go to campaign</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
