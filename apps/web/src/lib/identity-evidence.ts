/**
 * Shared vocabulary for the Identity Packet's operator-entered evidence
 * (mkt_identity_evidence, migration 297).
 *
 * Kept in one place so the ledger table, the "Add evidence" modal, and the
 * operator evidence list never drift on labels — the value sets themselves are
 * enforced server-side (CHECK constraints + identityScoring.ts).
 */

import type {
  IdentityEvidenceState,
  IdentityFieldKey,
  IdentitySourceTier,
} from '@/services/DirectoryPresenceAdminService';

export const IDENTITY_FIELD_LABELS: Record<IdentityFieldKey, string> = {
  name: 'Name',
  address: 'Address',
  phone: 'Phone',
  website: 'Website',
  hours: 'Hours',
  primary_category: 'Primary category',
  snap_ebt: 'SNAP / EBT',
  attributes: 'Attributes',
};

/** Field order in the modal's corroboration picker — required fields first. */
export const IDENTITY_FIELD_ORDER: IdentityFieldKey[] = [
  'name',
  'address',
  'phone',
  'website',
  'hours',
  'primary_category',
  'snap_ebt',
  'attributes',
];

export const IDENTITY_TIER_LABELS: Record<IdentitySourceTier, string> = {
  authoritative: 'Authoritative',
  first_party: 'First-party',
  major_aggregator: 'Major aggregator',
  secondary_aggregator: 'Aggregator',
  inferred: 'Inferred',
};

export const IDENTITY_TIER_HINTS: Record<IdentitySourceTier, string> = {
  authoritative: 'Registry, license, permit, SNAP retailer list, federal, or owner-confirmed on a call',
  first_party: 'The owner directly — their website, or what they told you',
  major_aggregator: 'Google Business Profile, Apple Maps',
  secondary_aggregator: 'Yelp, Facebook, BBB, Manta — the conservative default',
  inferred: 'Category-based inference. Never counts for SNAP/EBT',
};

export const IDENTITY_EVIDENCE_STATE_LABELS: Record<IdentityEvidenceState, string> = {
  confirmed: 'Confirmed',
  observed: 'Observed',
  probable: 'Probable',
  conflicting: 'Conflicting',
  not_found_during_discovery: 'Not found during discovery',
  not_checked: 'Not checked',
  owner_confirmed: 'Owner confirmed',
  owner_corrected: 'Owner corrected',
  owner_disputed: 'Owner disputed',
};

export interface IdentityEvidencePreset {
  label: string;
  sourceName: string;
  tier: IdentitySourceTier;
  evidenceState: IdentityEvidenceState;
  /** Fields the preset pre-checks — the operator can adjust before saving. */
  corroborates: IdentityFieldKey[];
  /** Pre-fills the source URL input with this, when present. */
  sourceUrl?: string;
}

/**
 * One-click starting points for the sources an operator actually reaches for.
 * They fill name + tier + evidence state (and a field guess) so the common case
 * is two clicks; everything stays editable.
 */
export const IDENTITY_EVIDENCE_PRESETS: IdentityEvidencePreset[] = [
  {
    label: 'Owner call',
    sourceName: 'Owner phone call',
    tier: 'first_party',
    evidenceState: 'owner_confirmed',
    corroborates: ['name', 'address', 'phone'],
  },
  {
    label: 'Google profile',
    sourceName: 'Google Business Profile',
    tier: 'major_aggregator',
    evidenceState: 'observed',
    corroborates: ['name', 'address', 'phone', 'website', 'hours'],
  },
  {
    label: 'Registry / license',
    sourceName: 'State business registry',
    tier: 'authoritative',
    evidenceState: 'confirmed',
    corroborates: ['name', 'address'],
  },
  {
    label: 'SNAP retailer list',
    sourceName: 'USDA SNAP retailer list',
    tier: 'authoritative',
    evidenceState: 'confirmed',
    corroborates: ['name', 'address', 'snap_ebt'],
  },
  {
    label: 'Owner website',
    sourceName: 'Owner website',
    tier: 'first_party',
    evidenceState: 'observed',
    corroborates: ['name', 'address', 'phone', 'website'],
  },
  {
    label: 'In-person visit',
    sourceName: 'In-person visit',
    tier: 'first_party',
    evidenceState: 'observed',
    corroborates: ['name', 'address'],
  },
];

/** Today as `YYYY-MM-DD` in the operator's local timezone. */
export function todayISODate(): string {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}
