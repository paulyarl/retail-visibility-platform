'use client';

/**
 * ProspectCommsPanel — the PG queue's communication worklist.
 *
 * One row per prospect: identity + status, the resolved contact channels
 * (the graduated campaign's verified phone/email/website/social when it
 * exists; the discovery snapshot's evidence — verified NAP first — before
 * that), and the log action the prospect's lifecycle supports:
 *
 *   - processed campaign → "Log contact" (LogContactModal — full method /
 *     message / outcome capture on the campaign outreach log)
 *   - seeded, pre-campaign → "Log touch" (ProspectTouchLogModal — the
 *     canonical seed touch that advances the cadence ladder)
 *   - verify_then_outreach → "Resolve" (the shared verification modal IS
 *     the call log for gated prospects)
 *   - neither seeded nor campaign-backed → logging is unavailable until the
 *     prospect is promoted or graduated (the backend has no log anchor).
 *
 * Rendered as the PG cockpit's Communications tab; entries arrive already
 * identity-collapsed from the tree-scoped queue fetch.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  Phone, Mail, Globe, Share2, ClipboardList, PhoneCall, Loader2,
  ShieldCheck, AlertTriangle, ExternalLink, MessageSquare,
} from 'lucide-react';
import marketingOpsService, {
  type Campaign,
  type ProspectQueueEntry,
} from '@/services/MarketingOpsService';
import { resolveProspectChannels } from '@/lib/prospect-channels';
import LogContactModal from './LogContactModal';
import ProspectTouchLogModal from './ProspectTouchLogModal';
import VerificationBadge from './VerificationBadge';

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  verify_then_outreach: 'Verify',
  campaign_created: 'Campaign',
  dismissed: 'Dismissed',
  hold: 'Hold',
  in_thread: 'In thread',
  intake: 'Intake',
};

const STATUS_CHIP: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700 dark:bg-neutral-700 dark:text-gray-300',
  verify_then_outreach: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  campaign_created: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  dismissed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  hold: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  in_thread: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  intake: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
};

interface ProspectCommsPanelProps {
  entries: ProspectQueueEntry[];
  /** Refetch the queue after a logged touch/contact. */
  onChanged: () => void | Promise<void>;
  /** Open the shared resolve-verification modal for a gated prospect. */
  onResolve: (entry: ProspectQueueEntry) => void;
}

export default function ProspectCommsPanel({ entries, onChanged, onResolve }: ProspectCommsPanelProps) {
  // "Log contact" needs the full Campaign (channels drive the modal), so the
  // campaign is fetched on demand per row.
  const [logCampaign, setLogCampaign] = useState<Campaign | null>(null);
  const [logCampaignLoadingId, setLogCampaignLoadingId] = useState<string | null>(null);
  const [touchEntry, setTouchEntry] = useState<ProspectQueueEntry | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleLogContact = async (entry: ProspectQueueEntry) => {
    if (!entry.processed_campaign_id) return;
    setLogCampaignLoadingId(entry.id);
    setActionError(null);
    try {
      setLogCampaign(await marketingOpsService.getCampaign(entry.processed_campaign_id));
    } catch (err: any) {
      setActionError(err.message || 'Failed to load campaign');
    } finally {
      setLogCampaignLoadingId(null);
    }
  };

  return (
    <div id="communications" className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 scroll-mt-4">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Prospect communications
        </h2>
        <span className="text-[10px] text-gray-400">
          {entries.length} prospect{entries.length !== 1 ? 's' : ''}
        </span>
      </div>
      <p className="text-[10px] text-gray-400 mb-3">
        Every prospect in this proving ground&apos;s queue with its reachable channels — the campaign&apos;s
        verified contact info once it exists, the discovery scan&apos;s evidence before that. Log contact
        writes the campaign outreach log; Log touch records the pre-campaign seed touch and advances the cadence.
      </p>

      {actionError && (
        <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {actionError}
        </div>
      )}
      {actionNotice && (
        <div className="mb-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
          {actionNotice}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-xs text-gray-400">
          No workable prospects yet — queue businesses from the Discovery prospects tab first.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e) => (
            <CommsRow
              key={e.id}
              entry={e}
              loggingCampaign={logCampaignLoadingId === e.id}
              onLogContact={() => handleLogContact(e)}
              onLogTouch={() => setTouchEntry(e)}
              onResolve={() => onResolve(e)}
            />
          ))}
        </ul>
      )}

      {/* Campaign outreach log — full method / message / outcome capture. */}
      {logCampaign && (
        <LogContactModal
          campaign={logCampaign}
          onClose={() => setLogCampaign(null)}
          onLogged={async () => {
            setLogCampaign(null);
            setActionNotice('Contact logged.');
            await onChanged();
          }}
        />
      )}

      {/* Pre-campaign seed touch — canonical call-notes capture. */}
      {touchEntry && (
        <ProspectTouchLogModal
          entry={touchEntry}
          onClose={() => setTouchEntry(null)}
          onLogged={async () => {
            setTouchEntry(null);
            setActionNotice('Touch logged.');
            await onChanged();
          }}
        />
      )}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────

function CommsRow({
  entry,
  loggingCampaign,
  onLogContact,
  onLogTouch,
  onResolve,
}: {
  entry: ProspectQueueEntry;
  loggingCampaign: boolean;
  onLogContact: () => void;
  onLogTouch: () => void;
  onResolve: () => void;
}) {
  const channels = resolveProspectChannels(entry);
  const hasChannel = !!(channels.phone || channels.email || channels.website || channels.socials.length);
  const holdDue =
    entry.status === 'hold' && entry.next_touch_at && new Date(entry.next_touch_at) <= new Date();
  const touchable =
    !!entry.seed_id &&
    (entry.status === 'queued' || entry.status === 'in_thread' || entry.status === 'verify_then_outreach' || !!holdDue);

  return (
    <li className="rounded-lg border border-gray-100 dark:border-neutral-700/60 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        {/* Identity */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium text-xs text-gray-900 dark:text-gray-100">
              {entry.business_name || entry.title || entry.id}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_CHIP[entry.status] ?? STATUS_CHIP.queued}`}>
              {STATUS_LABELS[entry.status] ?? entry.status}
            </span>
            {entry.verification && <VerificationBadge verification={entry.verification} />}
            {channels.source === 'campaign' && (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                title="Channels come from the graduated campaign's verified contact details"
              >
                verified
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-gray-400">
            {[entry.city, entry.state].filter(Boolean).join(', ') && (
              <span>{[entry.city, entry.state].filter(Boolean).join(', ')}</span>
            )}
            {entry.next_touch_at && (
              <span className={new Date(entry.next_touch_at).getTime() <= Date.now() ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                {new Date(entry.next_touch_at).getTime() <= Date.now()
                  ? '● touch due'
                  : `next touch ${new Date(entry.next_touch_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
              </span>
            )}
            {entry.processed_campaign_id && (
              <Link
                href={`/settings/admin/marketing-ops/campaigns/${entry.processed_campaign_id}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                campaign{entry.campaign_stage ? ` · ${entry.campaign_stage}` : ''} →
              </Link>
            )}
            {entry.seed_id && (
              <Link
                href={`/settings/admin/directory/presence-seeds/${entry.seed_id}`}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                seed →
              </Link>
            )}
          </div>
        </div>

        {/* Log action — lifecycle decides which log the row can write. */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {entry.status === 'verify_then_outreach' && (
            <button
              type="button"
              onClick={onResolve}
              className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
              title="Resolve the verification call — capture the outcome + verified NAP; they flow into the campaign on promotion"
            >
              <ShieldCheck className="h-3 w-3" />
              Resolve
            </button>
          )}
          {entry.processed_campaign_id ? (
            <button
              type="button"
              onClick={onLogContact}
              disabled={loggingCampaign}
              className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              title="Log a communication on the campaign outreach log — channel, message, outcome"
            >
              {loggingCampaign ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardList className="h-3 w-3" />}
              Log contact
            </button>
          ) : touchable ? (
            <button
              type="button"
              onClick={onLogTouch}
              className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700"
              title="Log a pre-campaign touch — call, text, mail or walk-in; advances the cadence ladder"
            >
              <PhoneCall className="h-3 w-3" />
              Log touch
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 dark:border-neutral-600 px-2.5 py-1 text-[10px] text-gray-400 dark:text-gray-500"
              title={entry.status === 'hold'
                ? 'On hold — logging unlocks when the hold date passes'
                : 'No log target yet — promote to a listing or create a campaign first'}
            >
              <AlertTriangle className="h-3 w-3" />
              {entry.status === 'hold' ? 'on hold' : 'no log target'}
            </span>
          )}
        </div>
      </div>

      {/* Channels — resolved campaign > verified NAP > snapshot > ladder. */}
      {hasChannel ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {channels.phone && (
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50 px-2 py-1">
              <Phone className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] text-gray-800 dark:text-gray-200">{channels.phone}</span>
              <a href={`tel:${channels.phone}`} className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline">Call</a>
              <span className="text-gray-300 dark:text-neutral-600">·</span>
              <a href={`sms:${channels.phone}`} className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:underline">Text</a>
            </span>
          )}
          {channels.email && (
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50 px-2 py-1">
              <Mail className="h-3 w-3 text-sky-600 dark:text-sky-400" />
              <a href={`mailto:${channels.email}`} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">{channels.email}</a>
            </span>
          )}
          {channels.website && (
            <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50 px-2 py-1">
              <Globe className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <a href={channels.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
                website <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </span>
          )}
          {channels.socials.map((sp, i) => (
            <span key={`${sp.platform}-${i}`} className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50 px-2 py-1">
              <Share2 className="h-3 w-3 text-fuchsia-600 dark:text-fuchsia-400" />
              <a href={sp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
                {sp.platform || 'social'} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
          No contact channels on file — enrich or verify the prospect to capture one.
        </p>
      )}
    </li>
  );
}
