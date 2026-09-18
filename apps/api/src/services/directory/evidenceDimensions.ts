/**
 * evidenceDimensions — the authority-class → evidence-dimension vocabulary for
 * the seed gate.
 *
 * Source authorities have ROLES relative to a category profile: the class of a
 * source decides which evidence dimension it may testify on. This is the
 * ELIGIBILITY axis — orthogonal to signal weight, which decides MAGNITUDE
 * within a dimension.
 *
 *   directory, social → operational
 *   government        → identity (+ registration + credibility)
 *   trade             → category
 *   community         → location
 *   owner             → above all four (the fifth axis; over-rules the gate)
 *
 * See docs/LocalBiz/CATEGORY_PLATFORM_SIGNAL_WEIGHT_SPEC.md §2.
 *
 * PURE — no DB, no network, no Prisma. This is the single vocabulary for the
 * class/dimension mapping so the scorer, the packet assembler, and the UI never
 * drift (the web-side counterpart is lib/identity-evidence.ts).
 */

import type { IdentitySourceTier } from './identityScoring';

/** The class of a source authority. */
export type AuthorityClass =
  | 'directory'
  | 'social'
  | 'government'
  | 'trade'
  | 'community'
  | 'owner';

/** The four evidence dimensions. `owner` is deliberately NOT one of them. */
export type EvidenceDimension = 'operational' | 'identity' | 'category' | 'location';

export const AUTHORITY_CLASSES: readonly AuthorityClass[] = [
  'directory',
  'social',
  'government',
  'trade',
  'community',
  'owner',
];

/** The four dimensions that contribute to the gate. */
export const EVIDENCE_DIMENSIONS: readonly EvidenceDimension[] = [
  'operational',
  'identity',
  'category',
  'location',
];

/**
 * class → dimension. `owner` maps to null: the owner axis sits above the four
 * dimensions and over-rules the threshold (spec §2). This is the eligibility
 * map — a source may only testify (and conflict) within its own dimension.
 */
export const AUTHORITY_CLASS_DIMENSION: Record<AuthorityClass, EvidenceDimension | null> = {
  directory: 'operational',
  social: 'operational',
  government: 'identity',
  trade: 'category',
  community: 'location',
  owner: null,
};

export const AUTHORITY_CLASS_LABELS: Record<AuthorityClass, string> = {
  directory: 'Directory',
  social: 'Social',
  government: 'Government',
  trade: 'Trade',
  community: 'Community',
  owner: 'Owner',
};

export const EVIDENCE_DIMENSION_LABELS: Record<EvidenceDimension, string> = {
  operational: 'Operational',
  identity: 'Identity',
  category: 'Category',
  location: 'Location',
};

export function isAuthorityClass(value: unknown): value is AuthorityClass {
  return typeof value === 'string' && (AUTHORITY_CLASSES as readonly string[]).includes(value);
}

export function isEvidenceDimension(value: unknown): value is EvidenceDimension {
  return typeof value === 'string' && (EVIDENCE_DIMENSIONS as readonly string[]).includes(value);
}

// ─── Inference ───────────────────────────────────────────────────────────
//
// Name patterns, checked in precedence order. The order is the product rule:
// owner outranks everything (the owner is the ground truth for their business),
// government outranks trade/community (registration is identity), and the
// social/directory split is operational either way — but the split is kept so
// the operational DENSITY rule (multiple independent socials) has its inputs.

const OWNER_PATTERN = /\bowner\b|first.?party/;
const GOVERNMENT_PATTERN =
  /secretary of state|\bsos\b|business registration|\bregistry\b|sam\.gov|\bfederal\b|usda|snap retailer|\bstate\b|\blicense\b|\bpermit\b|\bcounty\b|municipal|\bgovernment\b|\.gov\b/;
const TRADE_PATTERN =
  /\btrade\b|\bguild\b|\bunion\b|supplier|wholesale|professional network|\bcertification\b|accredit/;
const COMMUNITY_PATTERN =
  /\bcommunity\b|neighborhood|\bchamber\b|civic|nonprofit|\bchurch\b|parish|\bassociation\b|\blocal\b/;
const SOCIAL_PATTERN =
  /facebook|instagram|\bmeta\b|twitter|tiktok|youtube|linkedin|nextdoor|pinterest|threads/;

/**
 * Infer a source's authority class from its name, with the existing authority
 * tier as a fallback hint.
 *
 * Conservative default: `directory` (→ operational), so an unrecognized source
 * can never claim identity / category / location standing it was not given —
 * the same principle as `inferSourceTier`'s aggregator default.
 */
export function inferAuthorityClass(
  name: string,
  tier?: IdentitySourceTier | null,
): AuthorityClass {
  const s = String(name || '').toLowerCase();
  if (OWNER_PATTERN.test(s)) return 'owner';
  if (GOVERNMENT_PATTERN.test(s)) return 'government';
  if (TRADE_PATTERN.test(s)) return 'trade';
  if (COMMUNITY_PATTERN.test(s)) return 'community';
  if (SOCIAL_PATTERN.test(s)) return 'social';
  // Tier fallback — the class vocabulary predates tiers, so map where obvious.
  // (`official_website` is first_party by tier even though its name carries no
  // owner token — this is the case that keeps the fallback necessary.)
  if (tier === 'first_party') return 'owner';
  if (tier === 'authoritative') return 'government';
  return 'directory';
}

/** The dimension a class testifies on, or null for the owner axis. */
export function dimensionForClass(cls: AuthorityClass): EvidenceDimension | null {
  return AUTHORITY_CLASS_DIMENSION[cls];
}

/**
 * field → dimension map. Fields are how a dimension is *expressed*; a source
 * whose class maps to a field's dimension is an AUTHORITY on that field — only
 * its disagreement is a conflict. Every other source is a **NAP corroborator**:
 * its disagreement is DRIFT (reportable, repairable), never a conflict.
 *
 *   name / address / phone / website → identity   (NAP)
 *   primary_category / snap_ebt / attributes → category
 *   hours → operational
 *
 * Resolved 2026-09-18 — see spec §2 "NAP corroborators". Directory/social
 * sources DO contribute to NAP fields (as corroborators), but their
 * disagreement cannot veto; it surfaces as a drift signal instead.
 */
export const FIELD_DIMENSIONS: Record<string, EvidenceDimension[]> = {
  name: ['identity'],
  address: ['identity'],
  phone: ['identity'],
  website: ['identity'],
  hours: ['operational'],
  primary_category: ['category'],
  snap_ebt: ['category'],
  attributes: ['category'],
};
