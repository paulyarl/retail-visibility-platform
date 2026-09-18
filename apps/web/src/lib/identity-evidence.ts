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

/**
 * Human labels for the source identifiers the audits emit. The business audit
 * writes snake_case slugs (e.g. `usda_fns_snap_retailer_listing`), which must
 * never surface raw in the ledger. Keys are the slug lowercased with runs of
 * spaces/hyphens folded to underscores; `sourceLabel` falls back to title-cased
 * words for anything not listed.
 */
export const IDENTITY_SOURCE_LABELS: Record<string, string> = {
  official_website: 'Official website',
  owner_website: 'Owner website',
  apple_maps: 'Apple Maps',
  google: 'Google Business Profile',
  google_business_profile: 'Google Business Profile',
  yelp: 'Yelp',
  facebook: 'Facebook',
  bbb: 'Better Business Bureau',
  usda_fns_snap_retailer_listing: 'USDA SNAP retailer list',
  cap_times_press: 'Cap Times',
  mapquest: 'MapQuest',
  grubhub: 'Grubhub',
  linkedin: 'LinkedIn',
  zabihah: 'Zabihah',
};

/** Known acronyms that should stay uppercase in a prettified fallback label. */
const SOURCE_LABEL_ACRONYMS = new Set(['usda', 'fns', 'snap', 'gmb', 'bbb', 'nap', 'sos', 'sam']);

/**
 * Display label for a raw source name. Known slugs map to a curated label;
 * anything else is prettified (underscores → spaces, words title-cased) so the
 * UI never shows `cap_times_press`-style identifiers.
 */
export function sourceLabel(name: string): string {
  const raw = String(name ?? '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const known = IDENTITY_SOURCE_LABELS[key];
  if (known) return known;
  return raw
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => (SOURCE_LABEL_ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

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
