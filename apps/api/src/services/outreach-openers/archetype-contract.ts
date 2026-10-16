/**
 * Archetype contract — the archetype's SCOPE, co-located with its severity.
 *
 * Phase 3 of the shared-delegate work. The archetype's **forbidden vocabulary**
 * lived in its prompt template (`archetype-prompts.ts`) while its **severity and
 * co-occurring-signal instruction** were computed separately
 * (`signal-magnitude.ts` + `field-extractors.ts`). Two files that must agree,
 * with nothing enforcing it — so they contradicted each other:
 *
 *   The A8 prompt forbids "reviews," "responses," "replies," "website," while
 *   `buildCoOccurringSignalInstruction` instructed the writer to LEAD with the
 *   review backlog. The instruction was unsatisfiable: obey it and break the
 *   forbidden list, or obey the list and ignore the instruction.
 *
 * A lane forbidding a subject's vocabulary is a statement about its SCOPE — the
 * presence lane does not talk about reviews because reviews belong to the review
 * lane. This module makes that explicit so the co-occurring instruction can be
 * scoped to what the lane is actually allowed to say.
 */

/** The subject a signal is ABOUT — the vocabulary domain it forces the writer into. */
export type SignalSubject =
  | 'review'
  | 'presence'
  | 'drift'
  | 'website'
  | 'integrity'
  | 'other';

const DS_SUBJECTS: Record<string, SignalSubject> = {
  DS_MISSING_PROFILE: 'presence',
  DS_CLAIMED_STATUS: 'presence',
  DS_ZERO_INDEXED_PRESENCE: 'presence',
  DS_PROFILE_SUSPENDED: 'presence',
  DS_PROFILE_NOT_PUBLIC: 'presence',
  DS_BROKEN_PROFILE_LINK: 'presence',
  DS_MISSING_SERVICE_MENU: 'presence',
  DS_PHOTO_DEFICIT: 'presence',
  DS_MISSING_PRODUCT_CATALOG: 'presence',
  // Integrity findings about a listing that exists — their own domain, because
  // a lane can discuss presence without being allowed to discuss integrity.
  DS_DUPLICATE_LISTING: 'integrity',
  DS_HIJACKED_LISTING: 'integrity',
  DS_OWNERSHIP_DISPUTE: 'integrity',
  DS_ADDRESS_VERIFICATION_BLOCK: 'integrity',
  // Hours drift belongs with the NAP family — it is a listing-accuracy finding.
  DS_OUTDATED_HOURS: 'drift',
};

/**
 * Which subject a signal code belongs to. Returns `null` for an unrecognised
 * code, so the scope guard only fires when the subject is actually known —
 * never guess a subject and silently suppress a legitimate lead.
 */
export function signalSubject(code: string | null | undefined): SignalSubject | null {
  if (!code) return null;
  if (DS_SUBJECTS[code]) return DS_SUBJECTS[code];
  if (code.startsWith('RA_')) return 'review';
  if (code.startsWith('CP_NAP_')) return 'drift';
  if (code.startsWith('WC_')) return 'website';
  if (code.startsWith('VP_')) return 'presence';
  if (code.startsWith('DS_')) return 'presence';
  return null;
}

/**
 * Subjects whose vocabulary an archetype's prompt FORBIDS.
 *
 * Only subject-domain bans belong here — a ban that makes a co-occurring lead
 * impossible. Copy rules (no pricing, no exclamation points, one number per
 * hook) are about *how* the opener is written, not *what* it may be about, and
 * are deliberately not encoded.
 *
 * Derived from each prompt's own `Forbidden:` line, and pinned to it by
 * `archetype-contract.test.ts` — adding a quoted subject to a prompt's
 * forbidden list without updating this table fails a test.
 */
export const FORBIDDEN_SUBJECTS: Record<string, SignalSubject[]> = {
  // Review lane — review vocabulary IS the subject.
  A1: [],
  // Recovery lane — same.
  A2: [],
  // Drift lane — names platforms and variations by design.
  A3: [],
  // CTA lane.
  A4: [],
  // Dual-signal footprint lane — footprint AND review silence are both its
  // subject; it is the archetype built for the combination.
  A5: [],
  // Product lane.
  A6: [],
  // Website lane — forbids "reviews," "responses," "replies."
  A7: ['review'],
  // Presence lane — forbids "reviews," "responses," "replies," "website."
  A8: ['review', 'website'],
};

/** True when this archetype's prompt forbids the given subject's vocabulary. */
export function archetypeForbidsSubject(
  archetype: string,
  subject: SignalSubject | null,
): boolean {
  if (!subject) return false;
  return (FORBIDDEN_SUBJECTS[archetype] ?? []).includes(subject);
}

/**
 * May this archetype be told to LEAD with the given signal?
 *
 * False when the signal's subject is outside the archetype's scope — the
 * instruction would be unsatisfiable, so the caller must emit a scoped
 * acknowledgement instead of a lead.
 */
export function coOccurringLeadAllowed(
  archetype: string,
  signalCode: string | null | undefined,
): boolean {
  return !archetypeForbidsSubject(archetype, signalSubject(signalCode));
}
