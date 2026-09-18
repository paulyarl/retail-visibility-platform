'use client';

/**
 * AddIdentityEvidenceModal — record a source on the Identity Packet ledger
 * (mkt_identity_evidence, migration 297).
 *
 * The Identity tab's ledger is derived from audits and seed provenance, so a
 * business that has not been audited yet renders an empty ledger and scores 0
 * on both axes. This is the operator's write path: as evidence becomes
 * available — a phone call with the owner, a GBP page, the SNAP retailer list —
 * the source is recorded and the packet re-scores.
 *
 * Owner identity (name / phone / email) rides along on the same row. It is NOT
 * an identity-scoring field; it is the source for owner outreach and is
 * captured once per business prospect, then reused across the sibling
 * campaigns. Server-side, the captured contact back-fills the prospect group's
 * campaign records where they are empty.
 */

import { useMemo, useState } from 'react';
import { Loader2, Plus, ShieldPlus, X } from 'lucide-react';
import directoryPresenceAdminService, {
  type IdentityEvidenceState,
  type IdentityFieldKey,
  type IdentityPacket,
  type IdentitySourceTier,
} from '@/services/DirectoryPresenceAdminService';
import {
  IDENTITY_EVIDENCE_PRESETS,
  IDENTITY_EVIDENCE_STATE_LABELS,
  IDENTITY_FIELD_LABELS,
  IDENTITY_FIELD_ORDER,
  IDENTITY_TIER_HINTS,
  IDENTITY_TIER_LABELS,
  todayISODate,
} from '@/lib/identity-evidence';

interface AddIdentityEvidenceModalProps {
  campaignId: string;
  businessName: string | null;
  onClose: () => void;
  /** Receives the re-assembled packet so the host re-renders without a refetch. */
  onAdded: (packet: IdentityPacket) => void;
}

const INPUT_CLASS =
  'w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-gray-900 dark:text-white';

const TIER_OPTIONS: IdentitySourceTier[] = [
  'authoritative',
  'first_party',
  'major_aggregator',
  'secondary_aggregator',
  'inferred',
];

const STATE_OPTIONS = Object.keys(IDENTITY_EVIDENCE_STATE_LABELS) as IdentityEvidenceState[];

export default function AddIdentityEvidenceModal({
  campaignId,
  businessName,
  onClose,
  onAdded,
}: AddIdentityEvidenceModalProps) {
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  // '' = auto-detect from the source name (server-side inferSourceTier).
  const [tier, setTier] = useState<IdentitySourceTier | ''>('');
  const [evidenceState, setEvidenceState] = useState<IdentityEvidenceState>('observed');
  const [corroborates, setCorroborates] = useState<IdentityFieldKey[]>([]);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [accessedAt, setAccessedAt] = useState(todayISODate());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOwnerContact = Boolean(ownerName.trim() || ownerPhone.trim() || ownerEmail.trim());
  const canSave = useMemo(
    () => sourceName.trim().length > 0 && (corroborates.length > 0 || hasOwnerContact),
    [sourceName, corroborates.length, hasOwnerContact],
  );

  const applyPreset = (index: number) => {
    const preset = IDENTITY_EVIDENCE_PRESETS[index];
    setSourceName(preset.sourceName);
    setTier(preset.tier);
    setEvidenceState(preset.evidenceState);
    setCorroborates(preset.corroborates);
    if (preset.sourceUrl) setSourceUrl(preset.sourceUrl);
  };

  const toggleField = (field: IdentityFieldKey) => {
    setCorroborates((rows) =>
      rows.includes(field) ? rows.filter((f) => f !== field) : [...rows, field],
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { packet } = await directoryPresenceAdminService.addIdentityEvidence({
        campaignId,
        sourceName: sourceName.trim(),
        sourceUrl: sourceUrl.trim() || null,
        tier: tier || undefined,
        evidenceState,
        corroborates,
        ownerName: ownerName.trim() || null,
        ownerPhone: ownerPhone.trim() || null,
        ownerEmail: ownerEmail.trim() || null,
        accessedAt: accessedAt || null,
        notes: notes.trim() || null,
      });
      onAdded(packet);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add evidence');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-gray-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800">
        <div className="mb-4 flex items-start gap-3">
          <ShieldPlus className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add identity evidence</h3>
            <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
              {businessName ?? 'This business'} · shared across this business&apos;s campaigns
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Presets — the common sources, two clicks each. */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
            Quick pick
          </label>
          <div className="flex flex-wrap gap-1.5">
            {IDENTITY_EVIDENCE_PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(i)}
                className="rounded-full border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-neutral-600 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
          Source <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          list="identity-evidence-sources"
          placeholder="Google Business Profile, owner call, state registry…"
          value={sourceName}
          onChange={(e) => setSourceName(e.target.value)}
          className={`${INPUT_CLASS} mb-1`}
        />
        <datalist id="identity-evidence-sources">
          {IDENTITY_EVIDENCE_PRESETS.map((p) => (
            <option key={p.sourceName} value={p.sourceName} />
          ))}
        </datalist>

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem]">
          <input
            type="url"
            placeholder="Source URL (https://…)"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className={INPUT_CLASS}
          />
          <input
            type="date"
            aria-label="Accessed date"
            value={accessedAt}
            onChange={(e) => setAccessedAt(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1.15fr_1fr]">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Authority tier
            </label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as IdentitySourceTier | '')}
              className={INPUT_CLASS}
            >
              <option value="">Auto-detect</option>
              {TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {IDENTITY_TIER_LABELS[t]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
              {tier
                ? IDENTITY_TIER_HINTS[tier]
                : 'Inferred from the source name — unrecognized sources default to Aggregator.'}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Evidence state
            </label>
            <select
              value={evidenceState}
              onChange={(e) => setEvidenceState(e.target.value as IdentityEvidenceState)}
              className={INPUT_CLASS}
            >
              {STATE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {IDENTITY_EVIDENCE_STATE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Corroboration — what this source vouches for. */}
        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
          Corroborates
          {!hasOwnerContact && <span className="text-red-500"> *</span>}
        </label>
        <div className="mb-1 flex flex-wrap gap-1.5">
          {IDENTITY_FIELD_ORDER.map((field) => {
            const on = corroborates.includes(field);
            return (
              <button
                key={field}
                type="button"
                aria-pressed={on}
                onClick={() => toggleField(field)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  on
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700'
                }`}
              >
                {IDENTITY_FIELD_LABELS[field]}
              </button>
            );
          })}
        </div>
        <p className="mb-3 text-[10px] text-gray-400 dark:text-gray-500">
          Required fields (name, address) drive the identity score by weakest link — a source that
          confirms identity confirms both.
        </p>

        {/* Owner identity — captured once, reused for outreach. */}
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-neutral-700 dark:bg-neutral-900/40">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
            <Plus className="h-3.5 w-3.5" /> Owner contact
            <span className="font-normal text-gray-400 dark:text-gray-500">— optional, not scored</span>
          </div>
          <p className="mb-2 text-[10px] text-gray-500 dark:text-gray-400">
            Captured once and reused for owner outreach across this business&apos;s campaigns. Existing
            values on a campaign are never overwritten.
          </p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Owner name"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className={INPUT_CLASS}
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="tel"
                placeholder="Owner phone"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                className={INPUT_CLASS}
              />
              <input
                type="email"
                placeholder="Owner email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
          Notes
        </label>
        <textarea
          rows={2}
          placeholder="Who said what, when — anything a reviewer needs to trust this source."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${INPUT_CLASS} mb-4 resize-y`}
        />

        {/* Validation hint sits above the actions — inline it and the button
            label wraps at narrow widths. */}
        {!canSave && (
          <p className="mb-2 text-[11px] text-gray-400 dark:text-gray-500">
            Add a source name and corroborate a field or capture owner contact.
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-neutral-600 dark:text-gray-300 dark:hover:bg-neutral-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canSave || saving}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldPlus className="h-3.5 w-3.5" />}
            {saving ? 'Saving…' : 'Add evidence'}
          </button>
        </div>
      </div>
    </div>
  );
}
