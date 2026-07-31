'use client';

import { useState } from 'react';
import { Phone, Mail, Globe, Share2, MapPin, Calendar, CheckCircle2, Clock, ChevronDown, ChevronRight, MessageSquare, RefreshCw, Plus } from 'lucide-react';
import type { CampaignDetail, OutreachLogEntry, ContactChannel, ContactOutcome } from '@/services/MarketingOpsService';
import LogContactModal from './LogContactModal';

const CHANNEL_LABELS: Record<ContactChannel, string> = {
  phone: 'Phone',
  email: 'Email',
  website: 'Website',
  social: 'Social',
  in_person: 'In Person',
  other: 'Other',
};

const OUTCOME_LABELS: Record<ContactOutcome, string> = {
  reached: 'Reached',
  no_answer: 'No Answer',
  left_message: 'Left Message',
  interested: 'Interested',
  not_interested: 'Not Interested',
  callback_scheduled: 'Callback Scheduled',
  other: 'Other',
  auto_follow_up_scheduled: 'Auto Follow-Up',
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
};

function channelIcon(channel: ContactChannel) {
  switch (channel) {
    case 'phone': return <Phone className="h-3 w-3" />;
    case 'email': return <Mail className="h-3 w-3" />;
    case 'website': return <Globe className="h-3 w-3" />;
    case 'social': return <Share2 className="h-3 w-3" />;
    case 'in_person': return <MapPin className="h-3 w-3" />;
    default: return <MessageSquare className="h-3 w-3" />;
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

function followUpStatus(campaign: CampaignDetail): { label: string; color: string } {
  if (!campaign.next_follow_up_at) return { label: 'No follow-up scheduled', color: 'text-gray-400' };
  const fu = new Date(campaign.next_follow_up_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  fu.setHours(0, 0, 0, 0);
  const diffDays = Math.round((fu.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { label: `Overdue ${Math.abs(diffDays)}d`, color: 'text-red-600 dark:text-red-400 font-semibold' };
  if (diffDays === 0) return { label: 'Due today', color: 'text-amber-600 dark:text-amber-400 font-semibold' };
  return { label: `Due ${formatDate(campaign.next_follow_up_at)}`, color: 'text-gray-600 dark:text-gray-400' };
}

interface OutreachFollowUpCardProps {
  campaign: CampaignDetail;
  onLogged?: () => void;
}

export default function OutreachFollowUpCard({ campaign, onLogged }: OutreachFollowUpCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const log = campaign.outreach_log ?? [];
  const visibleLog = showFullHistory ? log : log.slice(0, 5);
  const fuStatus = followUpStatus(campaign);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Outreach & Follow-Up</h3>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-3 w-3" />
          Log contact
        </button>
      </div>

      {/* Header: last contacted + next follow-up */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800/50">
          <div className="text-gray-500 dark:text-gray-400">Last contacted</div>
          <div className="text-gray-900 dark:text-gray-100">
            {campaign.last_contacted_at ? (
              <span>{formatDate(campaign.last_contacted_at)} {campaign.last_contact_channel && `(${CHANNEL_LABELS[campaign.last_contact_channel as ContactChannel] ?? campaign.last_contact_channel})`}</span>
            ) : (
              <span className="text-gray-400">Never</span>
            )}
          </div>
        </div>
        <div className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800/50">
          <div className="text-gray-500 dark:text-gray-400">Next follow-up</div>
          <div className={fuStatus.color}>
            <Clock className="mr-1 inline h-3 w-3" />
            {fuStatus.label}
          </div>
        </div>
      </div>

      {/* Log history */}
      {log.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">No outreach logged yet — log your first contact.</p>
      ) : (
        <div className="space-y-1.5">
          {visibleLog.map((entry) => {
            const expanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="rounded-md border border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : entry.id)}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="flex items-center gap-2">
                    {expanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                    {channelIcon(entry.contact_channel)}
                    <span className="font-medium text-gray-700 dark:text-gray-300">{CHANNEL_LABELS[entry.contact_channel] ?? entry.contact_channel}</span>
                    <span className="text-gray-400">{formatDate(entry.contact_date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${OUTCOME_COLORS[entry.outcome] ?? OUTCOME_COLORS.other}`}>
                      {OUTCOME_LABELS[entry.outcome] ?? entry.outcome}
                    </span>
                    {entry.outcome === 'auto_follow_up_scheduled' && (
                      <span className="rounded bg-gray-100 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        System
                      </span>
                    )}
                    {entry.follow_up_date && !entry.follow_up_completed_at && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <Calendar className="h-2.5 w-2.5" /> FU {formatDate(entry.follow_up_date)}
                      </span>
                    )}
                    {entry.follow_up_completed_at && (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-gray-100 px-2 py-2 text-xs dark:border-gray-800">
                    {entry.notes && (
                      <p className="mb-2 whitespace-pre-wrap text-gray-600 dark:text-gray-400">{entry.notes}</p>
                    )}
                    {entry.message_snapshot && (
                      <div className="mb-2">
                        <div className="mb-1 font-medium text-gray-500 dark:text-gray-400">Message sent:</div>
                        {entry.message_subject && <div className="text-gray-700 dark:text-gray-300">Subject: {entry.message_subject}</div>}
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{entry.message_snapshot}</pre>
                      </div>
                    )}
                    {entry.data_snapshot && (
                      <div className="mb-2">
                        <div className="mb-1 font-medium text-gray-500 dark:text-gray-400">
                          Data at contact{entry.data_fresh_at ? ` (fetched ${new Date(entry.data_fresh_at).toLocaleString()})` : ''}:
                        </div>
                        <div className="flex flex-wrap gap-2 text-gray-600 dark:text-gray-400">
                          {entry.data_snapshot.review_count != null && <span>Reviews: {entry.data_snapshot.review_count}</span>}
                          {entry.data_snapshot.average_rating != null && <span>Rating: {entry.data_snapshot.average_rating}</span>}
                          {entry.data_snapshot.unaddressed_reviews != null && <span>Unaddressed: {entry.data_snapshot.unaddressed_reviews}</span>}
                          {entry.data_snapshot.gbp_claimed != null && <span>GBP claimed: {entry.data_snapshot.gbp_claimed ? 'Yes' : 'No'}</span>}
                          {entry.data_snapshot.photo_count != null && <span>Photos: {entry.data_snapshot.photo_count}</span>}
                        </div>
                      </div>
                    )}
                    <div className="text-[10px] text-gray-400">Logged by {entry.contacted_by ?? '—'} · {formatDate(entry.created_at)}</div>
                  </div>
                )}
              </div>
            );
          })}
          {log.length > 5 && (
            <button
              type="button"
              onClick={() => setShowFullHistory(!showFullHistory)}
              className="w-full py-1 text-center text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {showFullHistory ? 'Show less' : `Show all ${log.length} entries`}
            </button>
          )}
        </div>
      )}

      {showModal && (
        <LogContactModal
          campaign={campaign}
          onClose={() => setShowModal(false)}
          onLogged={() => {
            setShowModal(false);
            onLogged?.();
          }}
        />
      )}
    </div>
  );
}
