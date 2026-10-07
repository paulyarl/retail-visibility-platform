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
  ShieldCheck, AlertTriangle, ExternalLink, MessageSquare, EyeOff, Eye, Check,
} from 'lucide-react';
import marketingOpsService, {
  type Campaign,
  type ProspectQueueEntry,
} from '@/services/MarketingOpsService';
import { resolveProspectChannels } from '@/lib/prospect-channels';
import LogContactModal from './LogContactModal';
import ProspectTouchLogModal from './ProspectTouchLogModal';
import ResolveVerificationModal, { type VerificationEntryLike } from './ResolveVerificationModal';
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
  const [contactedBusyId, setContactedBusyId] = useState<string | null>(null);
  // Campaign-scoped verification — the campaign-mode resolve modal keyed by
  // the processed campaign's id (writes verified NAP to the campaign, not
  // the queue row).
  const [verifyEntry, setVerifyEntry] = useState<VerificationEntryLike | null>(null);
  // Queue-mode verify — requestVerification gates a queued prospect behind
  // the phone call (same action the communications page offers).
  const [verifyBusyId, setVerifyBusyId] = useState<string | null>(null);
  const [hideContacted, setHideContacted] = useState(false);
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

  // Manual contacted toggle — the contact-state override for queue-only
  // prospects (campaign/seed rows derive "contacted" from their log records;
  // unchecking a log-derived row is meaningless, so the checkbox is disabled
  // there).
  const handleToggleContacted = async (entry: ProspectQueueEntry, contacted: boolean) => {
    setContactedBusyId(entry.id);
    setActionError(null);
    try {
      await marketingOpsService.updateProspectQueue(entry.id, { contacted });
      await onChanged();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update contact status');
    } finally {
      setContactedBusyId(null);
    }
  };

  // Contact-status grouping — a logged outreach (campaign log or seed
  // touch), a completed verification call, or the manual flag moves the
  // prospect into Contacted. Contacted rows sort by most recent contact.
  const uncontacted = entries.filter((e) => !e.contacted);
  const contactedEntries = entries
    .filter((e) => e.contacted)
    .sort((a, b) => (b.last_contact_at ?? '').localeCompare(a.last_contact_at ?? ''));
  const visibleContacted = hideContacted ? [] : contactedEntries;

  // Queue-mode verify — moves a queued prospect to verify_then_outreach
  // (the Resolve button then opens the shared modal for the call outcome).
  const handleRequestVerify = async (entry: ProspectQueueEntry) => {
    setVerifyBusyId(entry.id);
    setActionError(null);
    try {
      await marketingOpsService.requestVerification(entry.id);
      setActionNotice('Verification requested — the prospect is gated until the call is resolved.');
      await onChanged();
    } catch (err: any) {
      setActionError(err.message || 'Failed to request verification');
    } finally {
      setVerifyBusyId(null);
    }
  };

  // Campaign-scoped verify — synthesizes the modal's entry shape with the
  // processed campaign's id (campaign mode writes to the campaign record).
  const openCampaignVerify = (e: ProspectQueueEntry) => {
    if (!e.processed_campaign_id) return;
    setVerifyEntry({
      id: e.processed_campaign_id,
      business_name: e.business_name ?? e.title ?? null,
      title: e.title,
      category: e.category,
      city: e.city,
      state: e.state,
      business_snapshot: e.business_snapshot,
    });
  };

  return (
    <div id="communications" className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-4 scroll-mt-4">
      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Prospect communications
        </h2>
        <span className="flex items-center gap-2">
          {contactedEntries.length > 0 && (
            <button
              type="button"
              onClick={() => setHideContacted((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 dark:border-neutral-600 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-neutral-700"
              title={hideContacted ? 'Show the contacted group again' : 'Hide contacted prospects — work only the un-contacted list'}
            >
              {hideContacted ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {hideContacted ? 'show contacted' : 'hide contacted'}
            </button>
          )}
          <span className="text-[10px] text-gray-400">
            {entries.length} prospect{entries.length !== 1 ? 's' : ''}
          </span>
        </span>
      </div>
      <p className="text-[10px] text-gray-400 mb-3">
        Every prospect in this proving ground&apos;s queue with its reachable channels — the campaign&apos;s
        verified contact info once it exists, the discovery scan&apos;s evidence before that. Log contact
        writes the campaign outreach log; Log touch records the pre-campaign seed touch and advances the cadence.
        A logged contact (or the manual check) moves the prospect into the Contacted group.
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
          {uncontacted.length > 0 && (
            <li className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
              To contact · {uncontacted.length}
            </li>
          )}
          {uncontacted.map((e) => (
            <CommsRow
              key={e.id}
              entry={e}
              loggingCampaign={logCampaignLoadingId === e.id}
              contactedBusy={contactedBusyId === e.id}
              verifyBusy={verifyBusyId === e.id}
              onLogContact={() => handleLogContact(e)}
              onLogTouch={() => setTouchEntry(e)}
              onResolve={() => onResolve(e)}
              onVerify={() => openCampaignVerify(e)}
              onRequestVerify={() => handleRequestVerify(e)}
              onToggleContacted={(checked) => handleToggleContacted(e, checked)}
            />
          ))}
          {visibleContacted.length > 0 && (
            <li className="pt-3 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Contacted · {visibleContacted.length}
            </li>
          )}
          {visibleContacted.map((e) => (
            <CommsRow
              key={e.id}
              entry={e}
              loggingCampaign={logCampaignLoadingId === e.id}
              contactedBusy={contactedBusyId === e.id}
              verifyBusy={verifyBusyId === e.id}
              onLogContact={() => handleLogContact(e)}
              onLogTouch={() => setTouchEntry(e)}
              onResolve={() => onResolve(e)}
              onVerify={() => openCampaignVerify(e)}
              onRequestVerify={() => handleRequestVerify(e)}
              onToggleContacted={(checked) => handleToggleContacted(e, checked)}
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

      {/* Campaign-scoped verification — writes verified NAP to the campaign
          (the Identity Packet reads it); the call is provenance, not a queue
          "next action". */}
      {verifyEntry && (
        <ResolveVerificationModal
          mode="campaign"
          entry={verifyEntry}
          onClose={() => setVerifyEntry(null)}
          onResolved={async () => {
            setVerifyEntry(null);
            setActionNotice('Verification recorded on the campaign.');
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
  contactedBusy,
  verifyBusy,
  onLogContact,
  onLogTouch,
  onResolve,
  onVerify,
  onRequestVerify,
  onToggleContacted,
}: {
  entry: ProspectQueueEntry;
  loggingCampaign: boolean;
  contactedBusy: boolean;
  verifyBusy: boolean;
  onLogContact: () => void;
  onLogTouch: () => void;
  onResolve: () => void;
  onVerify: () => void;
  onRequestVerify: () => void;
  onToggleContacted: (checked: boolean) => void;
}) {
  const channels = resolveProspectChannels(entry);
  const hasChannel = !!(channels.phone || channels.email || channels.website || channels.socials.length);
  const holdDue =
    entry.status === 'hold' && entry.next_touch_at && new Date(entry.next_touch_at) <= new Date();
  const touchable =
    !!entry.seed_id &&
    (entry.status === 'queued' || entry.status === 'in_thread' || entry.status === 'verify_then_outreach' || !!holdDue);
  // Contacted checkbox rules: log/verify-derived rows are locked (the record
  // IS the signal); a channelless row can't be marked — there's nothing to
  // contact the prospect on (but an already-contacted row can always be
  // unchecked to undo a mark).
  const contactDerived = entry.contact_source === 'log' || entry.contact_source === 'verify';
  const contactLocked = contactDerived || contactedBusy || (!hasChannel && !entry.contacted);

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
            {entry.last_contact_at && (
              <span className="text-emerald-600 dark:text-emerald-400">
                last contact {new Date(entry.last_contact_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {entry.contact_source === 'manual' ? ' (manual)' : entry.contact_source === 'verify' ? ' (verified)' : ''}
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
            <Link
              href={`/settings/admin/marketing-ops/communications?prospect=${entry.id}`}
              className="text-blue-600 dark:text-blue-400 hover:underline"
              title="Open the prospect's full communication timeline (seed touches + campaign outreach)"
            >
              history →
            </Link>
          </div>
        </div>

        {/* Log action — lifecycle decides which log the row can write. */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {/* Contacted toggle — custom checkbox (native boxes render
              identically across disabled/enabled on some platforms).
              Log/verify-derived rows are locked (the record IS the signal);
              channelless rows can't be marked — nothing to contact them on;
              an already-contacted row can always be unchecked to undo. */}
          <button
            type="button"
            role="checkbox"
            aria-checked={!!entry.contacted}
            disabled={contactLocked}
            onClick={() => onToggleContacted(!entry.contacted)}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium ${
              entry.contacted
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
                : 'border-gray-200 text-gray-500 dark:border-neutral-600 dark:text-gray-400'
            } ${contactLocked ? 'cursor-not-allowed opacity-45' : 'hover:border-gray-300 dark:hover:border-neutral-500'}`}
            title={
              entry.contact_source === 'log'
                ? 'Contacted — contact log on file (derived from logged contacts/touches)'
                : entry.contact_source === 'verify'
                  ? 'Contacted — verification call completed (derived from the resolve record)'
                  : contactedBusy
                    ? 'Updating…'
                    : !hasChannel && !entry.contacted
                      ? 'No contact channel on file — nothing to reach them on'
                      : entry.contacted
                        ? 'Marked contacted — uncheck to move back'
                        : 'Mark as contacted (e.g. you reached them outside the log flow)'
            }
          >
            <span
              className={`inline-flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-[3px] border ${
                entry.contacted
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-gray-300 bg-white dark:border-neutral-500 dark:bg-neutral-800'
              }`}
            >
              {entry.contacted && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
            </span>
            {contactedBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            contacted
          </button>
          {/* Queue-mode verify — gate a queued, pre-campaign prospect behind
              the phone call (same action the communications page offers). */}
          {!entry.processed_campaign_id && entry.status === 'queued' && (
            <button
              type="button"
              onClick={onRequestVerify}
              disabled={verifyBusy}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
              title="Gate outreach on a phone call — moves the prospect to Verify, then resolve with the verified NAP"
            >
              {verifyBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              Verify
            </button>
          )}
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
            <>
              <button
                type="button"
                onClick={onVerify}
                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
                title="Verify contact details on the campaign — records the call outcome and verified NAP on the campaign record"
              >
                <ShieldCheck className="h-3 w-3" />
                Verify
              </button>
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
            </>
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
