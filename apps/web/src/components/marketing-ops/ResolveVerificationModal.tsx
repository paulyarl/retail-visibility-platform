'use client';

/**
 * Verify-then-outreach resolution modal (Migration 255).
 *
 * Shared by the queue table, the queue kanban board, and the proving-ground
 * cockpit — the operator records the call outcome + verified NAP after the
 * human phone call. Captured values are written to the queue row's
 * business_snapshot (verified_nap + flat keys) by resolveVerification and
 * follow the prospect into its campaign on promotion.
 *
 * The form is split into three tab panels (Verified NAP / Enrichment &
 * Profiles / Call Notes) so the modal stays short. Call outcome and next
 * action sit outside the panels — they are the graduation gate and must never
 * be hidden behind a tab.
 */

import { useRef, useState } from 'react';
import { Loader2, Phone, Plus, Trash2, X, Clock, Check } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import marketingOpsService, {
  VerificationResolutionInput, VerificationOutcome, OwnerReceptivity, VerificationNextAction,
  VerifiedSocialProfile, VerifiedDirectoryProfile, verificationClearsCampaign,
} from '@/services/MarketingOpsService';
import BusinessHoursEditor from '@/components/business-hours/BusinessHoursEditor';
import {
  EMPTY_HOURS,
  type DayHours,
  inferTimezoneFromState,
  parseHours,
} from '@/lib/business-hours';

/**
 * Minimal shape the modal needs from the queue row. Deliberately structural
 * (not ProspectQueueEntry) so surfaces that don't carry the full entry — e.g.
 * the prospect communications timeline — can still open the shared modal.
 * ProspectQueueEntry satisfies this.
 */
export interface VerificationEntryLike {
  id: string;
  business_name: string | null;
  title?: string | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  business_snapshot?: Record<string, any> | null;
}

interface ResolveVerificationModalProps {
  entry: VerificationEntryLike;
  onClose: () => void;
  /** Called after a successful resolve — refresh the host surface. */
  onResolved: () => void | Promise<void>;
  /**
   * 'queue' (default) writes the queue row's business_snapshot via
   * resolveVerification — the verify-then-outreach graduation gate.
   * 'campaign' writes the campaign record directly (the campaign-scoped
   * counterpart): the verified NAP lands on the campaign, the capture is
   * recorded as attributed owner evidence, and the queue-only "next action"
   * is hidden — the campaign already exists, so the call outcome is provenance.
   */
  mode?: 'queue' | 'campaign';
  /**
   * Campaign mode only — field keys currently in conflict on the packet. When
   * the operator CHANGES one of these, a reason becomes required (the edit is
   * clearing a conflict, so it must be attributable beyond `updated_at`).
   */
  conflictFields?: string[];
}

type VerificationTab = 'nap' | 'enrichment' | 'notes';

/** Shown in the NAP + enrichment panels for outcomes that capture no identity. */
const NAP_GATE_NOTICE =
  'Verified NAP and enrichment are captured only for operational or relocated businesses. Change the call outcome above to record them.';

/**
 * Snapshots may store `website` either as a flat string or as a scan-shape
 * object ({ status, url }). Coerce to the string the input needs — binding an
 * object to a text input renders "[object Object]".
 */
function snapshotWebsite(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as any).url === 'string') {
    return (value as any).url;
  }
  return '';
}

export default function ResolveVerificationModal({ entry, onClose, onResolved, mode = 'queue', conflictFields = [] }: ResolveVerificationModalProps) {
  const isCampaign = mode === 'campaign';
  const snap = entry.business_snapshot ?? {};
  const nap = snap.verified_nap ?? snap.nap ?? {};

  const [form, setForm] = useState(() => ({
    outcome: 'operational' as VerificationOutcome,
    verifiedName: nap.name ?? entry.business_name ?? '',
    verifiedPhone: nap.phone ?? snap.phone ?? '',
    verifiedAddress: nap.address ?? snap.address ?? '',
    verifiedCity: nap.city ?? entry.city ?? '',
    verifiedState: nap.state ?? entry.state ?? '',
    verifiedWebsite: nap.website ?? snapshotWebsite(snap.website),
    verifiedEmail: nap.email ?? snap.email ?? '',
    verifiedCategory: entry.category ?? nap.category ?? snap.category ?? '',
    verifiedOwnerName: nap.owner_name ?? snap.owner_name ?? (Array.isArray(snap.owner_names) ? snap.owner_names[0] : '') ?? '',
    verifiedOwnerPhone: nap.owner_phone ?? snap.owner_phone ?? '',
    verifiedOwnerEmail: nap.owner_email ?? snap.owner_email ?? '',
    ownerReceptivity: '' as OwnerReceptivity | '',
    callNotes: '',
    nextAction: 'create_campaign' as VerificationNextAction,
  }));
  // Authoritative identity enrichment — repeatable platform + URL rows.
  const [socialProfiles, setSocialProfiles] = useState<VerifiedSocialProfile[]>(() =>
    Array.isArray(snap.social_profiles)
      ? (snap.social_profiles as any[]).map((p) => ({ platform: p?.platform ?? '', url: p?.url ?? '' }))
      : [],
  );
  const [directoryProfiles, setDirectoryProfiles] = useState<VerifiedDirectoryProfile[]>(() =>
    Array.isArray(snap.directory_profiles)
      ? (snap.directory_profiles as any[]).map((p) => ({
          platform: p?.platform ?? '',
          url: p?.url ?? '',
          claim_status: p?.claim_status ?? 'unknown',
          star_rating: p?.star_rating ?? null,
          review_count: p?.review_count ?? null,
          category: p?.category,
        }))
      : [],
  );
  const [tab, setTab] = useState<VerificationTab>('nap');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Campaign mode — required only when the edit clears a conflict (below).
  const [reason, setReason] = useState('');

  // ─── Opening hours (migration 296) ──────────────────────────────────────
  // Shared BusinessHoursEditor (same as the seed edit page): paste the GBP
  // "Hours" block and Parse & apply, or edit per day. `hours === null` means
  // "not captured" — verifiedHours is then omitted and the listing keeps
  // whatever the audit found. Prefilled from any hours already on the
  // snapshot.
  const [hours, setHours] = useState<Record<string, DayHours> | null>(() => {
    const existing = snap.hours ?? nap.hours;
    return existing && typeof existing === 'object' ? parseHours(existing) : null;
  });
  // Timezone: stored value wins; otherwise infer the majority zone from the
  // verified state so a California prospect doesn't default to Eastern.
  const storedHoursTimezone = (() => {
    const existing = (snap.hours ?? nap.hours) as Record<string, any> | undefined;
    return existing && typeof existing === 'object' && typeof existing.timezone === 'string'
      ? existing.timezone
      : null;
  })();
  const [hoursTimezone, setHoursTimezone] = useState<string>(
    () => storedHoursTimezone ?? inferTimezoneFromState(nap.state ?? entry.state) ?? 'America/New_York',
  );
  // Locked once a timezone is authoritative (stored on the snapshot or picked
  // by the operator) — until then, correcting the verified state re-infers it.
  const hoursTimezoneLocked = useRef(!!storedHoursTimezone);

  const canCreateCampaign = verificationClearsCampaign(form.outcome);
  // Only operational / relocated outcomes carry identity fields — mirrors the
  // gating that previously wrapped the whole NAP + enrichment block.
  const napApplicable = verificationClearsCampaign(form.outcome);

  // A reason is required only when the operator CHANGES a field that is
  // currently in conflict — that edit clears a conflict, so it must be
  // attributable beyond the campaign's `updated_at`.
  const CONFLICT_FIELD_FORM_KEY: Record<
    string,
    'verifiedName' | 'verifiedAddress' | 'verifiedPhone' | 'verifiedWebsite' | 'verifiedCategory'
  > = {
    name: 'verifiedName',
    address: 'verifiedAddress',
    phone: 'verifiedPhone',
    website: 'verifiedWebsite',
    primary_category: 'verifiedCategory',
  };
  const CONFLICT_FIELD_INITIAL: Record<string, string> = {
    name: nap.name ?? entry.business_name ?? '',
    address: nap.address ?? snap.address ?? '',
    phone: nap.phone ?? snap.phone ?? '',
    website: nap.website ?? snapshotWebsite(snap.website),
    primary_category: entry.category ?? nap.category ?? snap.category ?? '',
  };
  const reasonRequired =
    isCampaign &&
    conflictFields.some((f) => {
      const key = CONFLICT_FIELD_FORM_KEY[f];
      return key ? form[key] !== (CONFLICT_FIELD_INITIAL[f] ?? '') : false;
    });

  const handleOutcomeChange = (outcome: VerificationOutcome) => {
    // Auto-select nextAction based on outcome heuristics.
    let nextAction: VerificationNextAction = 'requeue';
    if (outcome === 'closed' || outcome === 'wrong_business') nextAction = 'dismiss';
    else if (outcome === 'closed_temporarily') nextAction = 'requeue';
    else if (outcome === 'unreachable') nextAction = 'dismiss';
    else if (outcome === 'operational') nextAction = 'create_campaign';
    else if (outcome === 'relocated') nextAction = 'requeue';
    setForm((f) => ({ ...f, outcome, nextAction }));
  };

  const handleResolve = async () => {
    setResolving(true);
    setError(null);
    try {
      const baseInput = {
        outcome: form.outcome,
        verifiedName: form.verifiedName || undefined,
        verifiedPhone: form.verifiedPhone || undefined,
        verifiedAddress: form.verifiedAddress || undefined,
        verifiedCity: form.verifiedCity || undefined,
        verifiedState: form.verifiedState || undefined,
        verifiedWebsite: form.verifiedWebsite || undefined,
        verifiedEmail: form.verifiedEmail || undefined,
        verifiedCategory: form.verifiedCategory || undefined,
        verifiedOwnerName: form.verifiedOwnerName || undefined,
        verifiedHours: hours ? { ...hours, timezone: hoursTimezone } : undefined,
        verifiedSocialProfiles: socialProfiles.filter((p) => p.platform.trim() && p.url.trim()),
        verifiedDirectoryProfiles: directoryProfiles.filter((p) => p.platform.trim() && p.url.trim()),
        ownerReceptivity: form.ownerReceptivity || undefined,
        callNotes: form.callNotes || undefined,
      };
      if (isCampaign) {
        // Campaign target — the campaign already exists, so there is no
        // graduation action; the outcome rides along as provenance. Owner
        // phone/email are campaign-only (the queue path captures owner name).
        await marketingOpsService.resolveCampaignVerification(entry.id, {
          ...baseInput,
          verifiedOwnerPhone: form.verifiedOwnerPhone || undefined,
          verifiedOwnerEmail: form.verifiedOwnerEmail || undefined,
          reason: reason.trim() || undefined,
        });
      } else {
        const input: VerificationResolutionInput = { ...baseInput, nextAction: form.nextAction };
        await marketingOpsService.resolveVerification(entry.id, input);
      }
      await onResolved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to resolve verification');
    } finally {
      setResolving(false);
    }
  };

  const gateNotice = (
    <p className="rounded-lg bg-gray-50 dark:bg-neutral-900/40 border border-gray-200 dark:border-neutral-700 px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400">
      {NAP_GATE_NOTICE}
    </p>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6 max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="flex items-start gap-3 mb-4">
          <Phone className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {isCampaign ? 'Verify record' : 'Resolve verification'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {entry.business_name ?? entry.title}
              {isCampaign
                ? ' · writes the campaign record (canonical NAP + attributed owner evidence)'
                : ` · ${entry.city ?? '—'}`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-3 py-2 text-xs text-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Call outcome — workflow-critical, kept outside the tab panels. */}
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Call outcome</label>
        <select
          value={form.outcome}
          onChange={(e) => handleOutcomeChange(e.target.value as VerificationOutcome)}
          className="w-full mb-3 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
        >
          <option value="operational">Operational — open and reachable</option>
          <option value="closed">Permanently closed — out of business</option>
          <option value="closed_temporarily">Temporarily closed — will reopen</option>
          <option value="relocated">Relocated — moved to a new address</option>
          <option value="unreachable">Unreachable — no answer after attempts</option>
          <option value="wrong_business">Wrong business — not the target</option>
        </select>

        <Tabs value={tab} onValueChange={(v) => setTab(v as VerificationTab)}>
          <TabsList aria-label="Verification details" className="h-auto w-full justify-start gap-1 overflow-x-auto">
            <TabsTrigger value="nap" className="text-xs px-2.5 py-1.5">Verified NAP</TabsTrigger>
            <TabsTrigger value="enrichment" className="text-xs px-2.5 py-1.5">Enrichment &amp; Profiles</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs px-2.5 py-1.5">Call Notes</TabsTrigger>
          </TabsList>

          {/* Verified NAP — shown for operational + relocated */}
          <TabsContent value="nap" className="space-y-2">
            {napApplicable ? (
              <>
                <input
                  type="text"
                  placeholder="Business name"
                  value={form.verifiedName}
                  onChange={(e) => setForm((f) => ({ ...f, verifiedName: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={form.verifiedPhone}
                  onChange={(e) => setForm((f) => ({ ...f, verifiedPhone: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Street address"
                  value={form.verifiedAddress}
                  onChange={(e) => setForm((f) => ({ ...f, verifiedAddress: e.target.value }))}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    value={form.verifiedCity}
                    onChange={(e) => setForm((f) => ({ ...f, verifiedCity: e.target.value }))}
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={form.verifiedState}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, verifiedState: v }));
                      if (!hoursTimezoneLocked.current) {
                        setHoursTimezone((cur) => inferTimezoneFromState(v) ?? cur);
                      }
                    }}
                    className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
              </>
            ) : gateNotice}
          </TabsContent>

          {/* Enrichment + authoritative profiles — flows into the campaign record */}
          <TabsContent value="enrichment" className="space-y-2">
            {napApplicable ? (
              <>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Flows into the campaign record
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Website (https://…)"
                    value={form.verifiedWebsite}
                    onChange={(e) => setForm((f) => ({ ...f, verifiedWebsite: e.target.value }))}
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={form.verifiedEmail}
                    onChange={(e) => setForm((f) => ({ ...f, verifiedEmail: e.target.value }))}
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Category"
                    value={form.verifiedCategory}
                    onChange={(e) => setForm((f) => ({ ...f, verifiedCategory: e.target.value }))}
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Owner name"
                    value={form.verifiedOwnerName}
                    onChange={(e) => setForm((f) => ({ ...f, verifiedOwnerName: e.target.value }))}
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>
                {/* Owner contact — the claim-invite channel and the owner axis.
                    Captured once; back-fills the campaign's owner fields. */}
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="Owner phone"
                    value={form.verifiedOwnerPhone}
                    onChange={(e) => setForm((f) => ({ ...f, verifiedOwnerPhone: e.target.value }))}
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                  <input
                    type="email"
                    placeholder="Owner email"
                    value={form.verifiedOwnerEmail}
                    onChange={(e) => setForm((f) => ({ ...f, verifiedOwnerEmail: e.target.value }))}
                    className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                  />
                </div>

                {/* Social profiles — repeatable platform + URL rows (authoritative). */}
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 pt-1">
                  Social profiles <span className="font-normal text-gray-400 dark:text-gray-500">— overwrite on promotion</span>
                </label>
                {socialProfiles.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Platform (facebook…)"
                      value={p.platform}
                      onChange={(e) => setSocialProfiles((rows) => rows.map((r, j) => (j === i ? { ...r, platform: e.target.value } : r)))}
                      className="w-32 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                    />
                    <input
                      type="url"
                      placeholder="https://…"
                      value={p.url}
                      onChange={(e) => setSocialProfiles((rows) => rows.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)))}
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setSocialProfiles((rows) => rows.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-600"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setSocialProfiles((rows) => [...rows, { platform: '', url: '' }])}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Add social profile
                </button>

                {/* Directory profiles — repeatable platform + URL rows (profile URLs). */}
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 pt-1">
                  Directory profiles <span className="font-normal text-gray-400 dark:text-gray-500">— profile URLs (Google, Yelp…)</span>
                </label>
                {directoryProfiles.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Platform (google…)"
                      value={p.platform}
                      onChange={(e) => setDirectoryProfiles((rows) => rows.map((r, j) => (j === i ? { ...r, platform: e.target.value } : r)))}
                      className="w-32 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                    />
                    <input
                      type="url"
                      placeholder="https://…"
                      value={p.url}
                      onChange={(e) => setDirectoryProfiles((rows) => rows.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)))}
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setDirectoryProfiles((rows) => rows.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-600"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDirectoryProfiles((rows) => [...rows, { platform: '', url: '', claim_status: 'unknown' }])}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Add directory profile
                </button>

                {/* Opening hours — the canonical editor (same component as the
                    seed edit page): paste the GBP block, Parse & apply, then
                    fine-tune per day. Travels to the listing via the campaign
                    record's business_hours. */}
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 pt-1">
                  Opening hours{' '}
                  <span className="font-normal text-gray-400 dark:text-gray-500">
                    — paste from Google, travels to the listing
                  </span>
                </label>
                <div className="rounded-lg border border-gray-200 dark:border-neutral-700 p-2.5">
                  <BusinessHoursEditor
                    compact
                    hours={hours ?? EMPTY_HOURS}
                    timezone={hoursTimezone}
                    onHoursChange={setHours}
                    onTimezoneChange={(tz) => {
                      hoursTimezoneLocked.current = true;
                      setHoursTimezone(tz);
                    }}
                  />
                </div>
                {hours ? (
                  <p className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                    <Check className="w-3 h-3 flex-shrink-0" />
                    <span className="flex-1">
                      Captured — will be written to the campaign record.
                      <button
                        type="button"
                        onClick={() => setHours(null)}
                        className="ml-2 text-gray-400 hover:text-red-600 underline"
                      >
                        clear
                      </button>
                    </span>
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                    <Clock className="w-3 h-3" /> No hours captured — the listing will fall back to the audit's hours.
                  </p>
                )}
              </>
            ) : gateNotice}
          </TabsContent>

          {/* Call notes — receptivity + free-form notes. */}
          <TabsContent value="notes" className="space-y-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Owner receptivity</label>
            <select
              value={form.ownerReceptivity}
              onChange={(e) => setForm((f) => ({ ...f, ownerReceptivity: e.target.value as OwnerReceptivity | '' }))}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            >
              <option value="">—</option>
              <option value="interested">Interested</option>
              <option value="neutral">Neutral</option>
              <option value="defensive">Defensive</option>
              <option value="no_answer">No answer</option>
            </select>

            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Call notes</label>
            <textarea
              rows={5}
              value={form.callNotes}
              onChange={(e) => setForm((f) => ({ ...f, callNotes: e.target.value }))}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            />
          </TabsContent>
        </Tabs>

        {/* Next action — workflow-critical, kept outside the tab panels. Queue
            target only: in campaign mode the campaign already exists, so there
            is nothing to graduate. */}
        {!isCampaign && (
          <>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mt-4 mb-1">Next action</label>
            <select
              value={form.nextAction}
              onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value as VerificationNextAction }))}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            >
              <option value="requeue">Re-queue (back to Queued with verified NAP)</option>
              <option value="create_campaign" disabled={!canCreateCampaign}>
                Create campaign (graduate immediately){canCreateCampaign ? '' : ' — blocked: not operational'}
              </option>
              <option value="dismiss">Dismiss (unverified_closed)</option>
            </select>
            {!canCreateCampaign && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 mb-4">
                This outcome cannot graduate to a campaign — only operational or relocated prospects do. Re-queue the
                prospect and re-verify as operational once confirmed.
              </p>
            )}
          </>
        )}
        {isCampaign && (
          <>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mt-4 mb-1">
              Reason {reasonRequired && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                reasonRequired
                  ? 'This edit clears a conflict — say what changed and why (e.g. "owner corrected the street number on the call").'
                  : 'Optional — why the record was verified.'
              }
              className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white"
            />
          </>
        )}
        <div className="mb-4" />

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={resolving || (reasonRequired && !reason.trim())}
            className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isCampaign ? 'Save record' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
}
