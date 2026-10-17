/**
 * Canonical profile-repair issue-type vocabulary.
 *
 * `mkt_campaigns_list.repair_issue_type` is VarChar(40) and doubles as a
 * lookup key: `ProfileRepairPromptService.resolveSeekTemplateId` switches on
 * the exact token to pick the per-issue seek template (nap_drift /
 * unclaimed_profile / platform_gap) and silently falls back to the triage
 * template for anything else.
 *
 * The triage AI emits `issue_type_confirmed` as free text, and operators type
 * free text into the sibling form — so a compound diagnosis like
 * "listing_hygiene_and_shelf_visibility (nap_drift + missing_category + ...)"
 * both overflows the column (Prisma: "The provided value for the column is too
 * long for the column's type") and misses the template lookup. Every write
 * path normalizes through `normalizeRepairIssueType` before persisting.
 */

export const REPAIR_ISSUE_TYPE_MAX_LENGTH = 40;

/**
 * The triage vocabulary — mirrors the value set of
 * `SIGNAL_TO_TRIAGE_VOCAB` in ProfileRepairPromptService.
 */
export const REPAIR_TRIAGE_VOCABULARY = [
  'nap_drift',
  'unclaimed_profile',
  'platform_gap',
  'missing_category',
  'missing_hours',
  'suspension',
  'duplicate_listing',
  'hijacked_listing',
  'ownership_dispute',
  'address_verification_block',
] as const;

export type RepairTriageVocabulary = (typeof REPAIR_TRIAGE_VOCABULARY)[number];

const VOCABULARY_SET: ReadonlySet<string> = new Set<string>(REPAIR_TRIAGE_VOCABULARY);

/**
 * Free-text phrasings the AI and operators emit instead of the token. Checked
 * only when no canonical token appears verbatim in the string. Order is
 * significant — the first matching hint wins.
 */
const VOCABULARY_HINTS: ReadonlyArray<readonly [RegExp, RepairTriageVocabulary]> = [
  [/suspend/, 'suspension'],
  [/hijack/, 'hijacked_listing'],
  [/duplicate|two (live )?listings?|multiple listings?|second listing|alternate (name|identity|profile)/, 'duplicate_listing'],
  [/ownership|dispute/, 'ownership_dispute'],
  [/address[_ -]?verif/, 'address_verification_block'],
  [/unclaim|not claimed|claim/, 'unclaimed_profile'],
  [/nap|drift|phone|citation/, 'nap_drift'],
  [/hour/, 'missing_hours'],
  [/categor|service menu|product catalog/, 'missing_category'],
  [/platform|profile|website|hidden|not public/, 'platform_gap'],
];

/**
 * Normalize a free-form issue-type string to a canonical triage token.
 *
 * 1. An exact token (case/whitespace-insensitive) wins.
 * 2. Otherwise the first canonical token appearing verbatim in the string wins
 *    — compound answers lead with their primary diagnosis
 *    ("listing_hygiene_and_shelf_visibility (nap_drift + missing_hours)"
 *    → "nap_drift").
 * 3. Otherwise a keyword hint maps the phrasing onto the closest token.
 * 4. Otherwise the string is slugified and clamped to
 *    REPAIR_ISSUE_TYPE_MAX_LENGTH so it can never overflow the column.
 *
 * Returns null for empty input — the column is nullable and the template
 * lookup treats null as "not yet diagnosed".
 */
export function normalizeRepairIssueType(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();

  if (VOCABULARY_SET.has(lower)) return lower;

  let earliest: { token: RepairTriageVocabulary; at: number } | null = null;
  for (const token of REPAIR_TRIAGE_VOCABULARY) {
    const at = lower.indexOf(token);
    if (at === -1) continue;
    if (!earliest || at < earliest.at) earliest = { token, at };
  }
  if (earliest) return earliest.token;

  for (const [pattern, token] of VOCABULARY_HINTS) {
    if (pattern.test(lower)) return token;
  }

  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, REPAIR_ISSUE_TYPE_MAX_LENGTH);

  return slug || null;
}
