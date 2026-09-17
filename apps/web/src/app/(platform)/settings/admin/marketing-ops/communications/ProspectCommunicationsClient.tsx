'use client';

/**
 * ProspectCommunicationsClient — prospect-scoped communication history.
 *
 * Patterned after the openers / follow-ups workspaces: pick a prospect from
 * the selector, then read the full communication timeline. Unlike those
 * workspaces the timeline is prospect-scoped, not campaign-scoped, so it
 * spans the whole relationship — pre-campaign seed touches (calls made
 * before a campaign exists) through campaign outreach log rows, including
 * sibling campaigns.
 *
 * Read-only. Logging still happens on the campaign's Outreach card and the
 * queue's Log touch modal; this page is the at-a-glance history.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Search, Phone, Mail, MessageSquare, MapPin, Globe, Share2,
  Calendar, CheckCircle2, ChevronDown, ChevronRight, Clock, AlertTriangle,
  PlayCircle,
} from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, {
  ProspectSummary,
  ProspectTimeline,
  ProspectCommunicationEvent,
} from '@/services/MarketingOpsService';

// ─── Labels ──────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<string, string> = {
  phone: 'Phone',
  email: 'Email',
  sms: 'SMS',
  mail: 'Mail',
  form: 'Form',
  referral: 'Referral',
  in_person: 'In person',
  website: 'Website',
  social: 'Social',
  other: 'Other',
};

const CHANNEL_CHIP: Record<string, string> = {
  phone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  email: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  sms: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  mail: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  form: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  referral: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  in_person: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  website: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  social: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  other: 'bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  verify_then_outreach: 'Verify',
  campaign_created: 'Campaign',
  dismissed: 'Dismissed',
  hold: 'Hold',
  in_thread: 'In thread',
};

const STATUS_CHIP: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300',
  verify_then_outreach: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  campaign_created: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  dismissed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  hold: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  in_thread: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

function channelIcon(channel: string) {
  switch (channel) {
    case 'phone': return <Phone className="h-3.5 w-3.5" />;
    case 'email': return <Mail className="h-3.5 w-3.5" />;
    case 'sms': return <MessageSquare className="h-3.5 w-3.5" />;
    case 'mail': return <Mail className="h-3.5 w-3.5" />;
    case 'in_person': return <MapPin className="h-3.5 w-3.5" />;
    case 'website': return <Globe className="h-3.5 w-3.5" />;
    case 'social': return <Share2 className="h-3.5 w-3.5" />;
    default: return <MessageSquare className="h-3.5 w-3.5" />;
  }
}

function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return s;
  }
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

function prospectLabel(p: ProspectSummary): string {
  const name = p.business_name || p.title || 'Untitled prospect';
  const loc = [p.city, p.state].filter(Boolean).join(', ');
  return loc ? `${name} — ${loc}` : name;
}

// ─── Component ───────────────────────────────────────────────────────────

interface Props {
  /** Deep-link prefill (?prospect=<queueEntryId>). */
  initialProspectId?: string;
}

export default function ProspectCommunicationsClient({ initialProspectId }: Props) {
  const [prospects, setProspects] = useState<ProspectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const [timeline, setTimeline] = useState<ProspectTimeline | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await marketingOpsService.listProspects({ limit: 300 });
      setProspects(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load prospects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProspects();
  }, [fetchProspects]);

  // Apply the ?prospect= deep link once prospects load.
  const [appliedUrlParams, setAppliedUrlParams] = useState(false);
  useEffect(() => {
    if (appliedUrlParams || loading) return;
    if (initialProspectId && prospects.some((p) => p.id === initialProspectId)) {
      setSelectedId(initialProspectId);
    }
    setAppliedUrlParams(true);
  }, [appliedUrlParams, loading, prospects, initialProspectId]);

  const fetchTimeline = useCallback(async (id: string) => {
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const tl = await marketingOpsService.getProspectTimeline(id);
      setTimeline(tl);
    } catch (err: any) {
      setTimeline(null);
      setTimelineError(err.message || 'Failed to load communication history');
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      setExpandedId(null);
      fetchTimeline(selectedId);
    } else {
      setTimeline(null);
    }
  }, [selectedId, fetchTimeline]);

  const filteredProspects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prospects;
    return prospects.filter((p) =>
      [p.business_name, p.title, p.city, p.state, p.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [prospects, search]);

  const selected = prospects.find((p) => p.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Page header ──────────────────────────────────────────────── */}
      <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800 p-4">
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">Prospect Communications</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Every logged communication with a prospect in one place — pre-campaign touches (calls,
          texts, walk-ins) through campaign outreach, including sibling campaigns.
        </p>
      </div>

      {/* ─── Prospect selector ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Select Prospect</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {prospects.length} prospect{prospects.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, city, category…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">— Select a prospect —</option>
            {filteredProspects.map((p) => (
              <option key={p.id} value={p.id}>
                {prospectLabel(p)} ({STATUS_LABELS[p.status] ?? p.status})
                {p.contact_count > 0 ? ` · ${p.contact_count} contact${p.contact_count !== 1 ? 's' : ''}` : ''}
              </option>
            ))}
          </select>
        </div>
        {filteredProspects.length === 0 && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">No prospects match that search.</p>
        )}
      </div>

      {/* ─── Timeline ─────────────────────────────────────────────────── */}
      {!selectedId && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-neutral-700 p-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a prospect to see their communication history.
          </p>
        </div>
      )}

      {selectedId && timelineLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {selectedId && timelineError && !timelineLoading && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{timelineError}</p>
        </div>
      )}

      {timeline && !timelineLoading && (
        <>
          {/* Prospect header + summary */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selected?.business_name || selected?.title || 'Untitled prospect'}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {[selected?.category, selected?.city, selected?.state].filter(Boolean).length > 0 && (
                    <span>{[selected?.category, selected?.city, selected?.state].filter(Boolean).join(' · ')}</span>
                  )}
                  <span className={`rounded px-1.5 py-0.5 font-medium ${STATUS_CHIP[timeline.prospect.status] ?? STATUS_CHIP.queued}`}>
                    {STATUS_LABELS[timeline.prospect.status] ?? timeline.prospect.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {timeline.prospect.campaign_id && (
                  <Link
                    href={`/settings/admin/marketing-ops/campaigns/${timeline.prospect.campaign_id}`}
                    className="rounded-md border border-gray-300 dark:border-neutral-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700"
                  >
                    Open campaign →
                  </Link>
                )}
                {timeline.prospect.seed_id && (
                  <Link
                    href={`/settings/admin/directory/presence-seeds/${timeline.prospect.seed_id}`}
                    className="rounded-md border border-gray-300 dark:border-neutral-600 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700"
                  >
                    Open seed →
                  </Link>
                )}
              </div>
            </div>

            {/* Summary stats */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-neutral-900/50">
                <div className="text-gray-500 dark:text-gray-400">Contacts logged</div>
                <div className="text-gray-900 dark:text-gray-100 font-medium">{timeline.summary.total_events}</div>
              </div>
              <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-neutral-900/50">
                <div className="text-gray-500 dark:text-gray-400">Last contact</div>
                <div className="text-gray-900 dark:text-gray-100 font-medium">
                  {timeline.summary.last_contact_at ? formatDate(timeline.summary.last_contact_at) : 'Never'}
                  {timeline.summary.days_since_last_contact != null && (
                    <span className="text-gray-400 font-normal">
                      {' '}({timeline.summary.days_since_last_contact}d ago)
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-neutral-900/50">
                <div className="text-gray-500 dark:text-gray-400">Last outcome</div>
                <div className="text-gray-900 dark:text-gray-100 font-medium">
                  {timeline.summary.last_outcome ?? '—'}
                </div>
              </div>
              <div className="rounded-md bg-gray-50 px-3 py-2 dark:bg-neutral-900/50">
                <div className="text-gray-500 dark:text-gray-400">Next follow-up</div>
                <div className="text-gray-900 dark:text-gray-100 font-medium">
                  {timeline.summary.next_follow_up_at ? formatDate(timeline.summary.next_follow_up_at) : 'None'}
                </div>
              </div>
            </div>

            {/* Channel breakdown */}
            {Object.keys(timeline.summary.by_channel).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(timeline.summary.by_channel)
                  .sort((a, b) => b[1] - a[1])
                  .map(([ch, n]) => (
                    <span
                      key={ch}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${CHANNEL_CHIP[ch] ?? CHANNEL_CHIP.other}`}
                    >
                      {channelIcon(ch)}
                      {CHANNEL_LABELS[ch] ?? ch} · {n}
                    </span>
                  ))}
              </div>
            )}

            {timeline.campaigns.length > 1 && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Spans {timeline.campaigns.length} campaigns:{' '}
                {timeline.campaigns.map((c) => c.title ?? c.id).join(', ')}
              </p>
            )}
          </div>

          {/* Event list */}
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Communication history
            </h3>

            {timeline.events.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No communications logged for this prospect yet.
              </p>
            ) : (
              <div className="space-y-2">
                {timeline.events.map((event) => (
                  <EventRow
                    key={`${event.source}-${event.id}`}
                    event={event}
                    expanded={expandedId === event.id}
                    onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Event row ───────────────────────────────────────────────────────────

function EventRow({
  event,
  expanded,
  onToggle,
}: {
  event: ProspectCommunicationEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-neutral-700">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-neutral-700/50"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          )}
          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium flex-shrink-0 ${CHANNEL_CHIP[event.channel] ?? CHANNEL_CHIP.other}`}>
            {channelIcon(event.channel)}
            {CHANNEL_LABELS[event.channel] ?? event.channel}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
            {formatDateTime(event.occurred_at)}
          </span>
          <span className="truncate text-xs text-gray-700 dark:text-gray-300">
            {event.outcome_label}
          </span>
          {event.system_generated && (
            <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-500 dark:bg-neutral-700 dark:text-gray-400 flex-shrink-0">
              System
            </span>
          )}
          {event.source === 'seed_touch' && (
            <span className="rounded bg-cyan-50 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 flex-shrink-0">
              Pre-campaign
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {event.recording_url && <PlayCircle className="h-3.5 w-3.5 text-violet-500" />}
          {event.follow_up_date && !event.follow_up_completed_at && (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <Calendar className="h-2.5 w-2.5" /> FU {formatDate(event.follow_up_date)}
            </span>
          )}
          {event.follow_up_completed_at && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-neutral-700 px-3 py-3 text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
            <div>
              <span className="text-gray-400">Method:</span> {CHANNEL_LABELS[event.channel] ?? event.channel}
              {event.raw_channel !== event.channel && (
                <span className="text-gray-400"> ({event.raw_channel})</span>
              )}
            </div>
            <div><span className="text-gray-400">Outcome:</span> {event.outcome_label}</div>
            <div><span className="text-gray-400">Logged by:</span> {event.contacted_by ?? '—'}</div>
            <div>
              <span className="text-gray-400">Source:</span>{' '}
              {event.source === 'seed_touch' ? 'Seed touch (pre-campaign)' : 'Campaign outreach'}
            </div>
            {event.campaign_title && (
              <div className="col-span-2">
                <span className="text-gray-400">Campaign:</span> {event.campaign_title}
                {event.stage_at_time && <span className="text-gray-400"> · stage {event.stage_at_time}</span>}
              </div>
            )}
            {event.delivery_status && (
              <div><span className="text-gray-400">Delivery:</span> {event.delivery_status}</div>
            )}
          </div>

          {event.notes && (
            <div>
              <div className="mb-0.5 font-medium text-gray-500 dark:text-gray-400">Notes:</div>
              <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{event.notes}</p>
            </div>
          )}

          {event.message && (
            <div>
              <div className="mb-1 font-medium text-gray-500 dark:text-gray-400">Message sent:</div>
              {event.subject && <div className="text-gray-700 dark:text-gray-300">Subject: {event.subject}</div>}
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-gray-700 dark:bg-neutral-900 dark:text-gray-300">
                {event.message}
              </pre>
            </div>
          )}

          {event.call_details && Object.keys(event.call_details).length > 0 && (
            <div>
              <div className="mb-1 font-medium text-gray-500 dark:text-gray-400">Call details:</div>
              <div className="flex flex-wrap gap-2 text-gray-600 dark:text-gray-400">
                {event.call_details.call_result && <span>Result: {event.call_details.call_result}</span>}
                {event.call_details.contact_result && <span>Result: {event.call_details.contact_result}</span>}
                {event.call_details.owner_name_confirmed && <span>Owner: {event.call_details.owner_name_confirmed}</span>}
                {event.call_details.team_signal_confirmed && <span>Team: {event.call_details.team_signal_confirmed}</span>}
                {event.call_details.preferred_channel_confirmed && (
                  <span>Preferred: {event.call_details.preferred_channel_confirmed}</span>
                )}
                {event.call_details.email_obtained && <span>Email obtained</span>}
              </div>
            </div>
          )}

          {event.recording_url ? (
            <a
              href={event.recording_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline"
            >
              <PlayCircle className="h-3.5 w-3.5" /> Play call recording
            </a>
          ) : (
            event.channel === 'phone' && (
              <p className="text-[11px] text-gray-400">No recording attached.</p>
            )
          )}

          {event.verification_results && event.verification_results.length > 0 && (
            <div>
              <div className="mb-1 font-medium text-gray-500 dark:text-gray-400">Verification results:</div>
              <ul className="list-disc pl-4 text-gray-600 dark:text-gray-400">
                {event.verification_results.map((v, i) => (
                  <li key={i}>
                    {v.field ?? v.fact ?? 'field'}: {v.result ?? v.status ?? JSON.stringify(v)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] text-gray-400">
            <Clock className="mr-1 inline h-2.5 w-2.5" />
            {formatDateTime(event.occurred_at)}
          </div>
        </div>
      )}
    </div>
  );
}
