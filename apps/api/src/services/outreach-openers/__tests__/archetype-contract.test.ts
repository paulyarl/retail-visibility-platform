/**
 * Archetype contract — the lane's scope, co-located with its severity.
 *
 * The regression this pins: the archetype's forbidden vocabulary lived in its
 * prompt template while its co-occurring-signal instruction was built
 * elsewhere, so the A8 prompt instructed the writer to LEAD with the review
 * backlog while its own forbidden list banned the word "reviews". The
 * instruction was unsatisfiable.
 *
 * The load-bearing test is `the forbidden-subject table matches each prompt` —
 * it derives the expectation from the prompt text itself, so adding a quoted
 * subject to a prompt's Forbidden line without updating the table fails here
 * instead of shipping a contradictory prompt.
 */
import { describe, it, expect } from 'vitest';
import { buildArchetypePrompt } from '../archetype-prompts';
import {
  signalSubject,
  archetypeForbidsSubject,
  coOccurringLeadAllowed,
  FORBIDDEN_SUBJECTS,
} from '../archetype-contract';

const ARCHETYPES = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'] as const;

describe('signalSubject', () => {
  it('maps each signal family to the vocabulary domain it forces', () => {
    expect(signalSubject('RA_UNADDRESSED_POSITIVE_BACKLOG')).toBe('review');
    expect(signalSubject('RA_REVIEW_DROUGHT')).toBe('review');
    expect(signalSubject('CP_NAP_NAME_DRIFT')).toBe('drift');
    expect(signalSubject('WC_BUILDER_SUBDOMAIN')).toBe('website');
    expect(signalSubject('WC_BROKEN_WEBSITE')).toBe('website');
    expect(signalSubject('DS_MISSING_PROFILE')).toBe('presence');
    expect(signalSubject('DS_PROFILE_NOT_PUBLIC')).toBe('presence');
    expect(signalSubject('DS_OUTDATED_HOURS')).toBe('drift');
    expect(signalSubject('DS_DUPLICATE_LISTING')).toBe('integrity');
    expect(signalSubject('VP_STALE_SOCIAL_ACTIVITY')).toBe('presence');
  });

  it('returns null for an unrecognised code rather than guessing', () => {
    // A guessed subject would silently suppress a legitimate lead.
    expect(signalSubject('SOME_FUTURE_CODE')).toBeNull();
    expect(signalSubject(null)).toBeNull();
    expect(signalSubject(undefined)).toBeNull();
    expect(coOccurringLeadAllowed('A8', 'SOME_FUTURE_CODE')).toBe(true);
  });
});

describe('scope — which lanes may lead with which subjects', () => {
  it('the presence lane (A8) cannot lead with review or website signals', () => {
    expect(archetypeForbidsSubject('A8', 'review')).toBe(true);
    expect(archetypeForbidsSubject('A8', 'website')).toBe(true);
    expect(coOccurringLeadAllowed('A8', 'RA_UNADDRESSED_POSITIVE_BACKLOG')).toBe(false);
    expect(coOccurringLeadAllowed('A8', 'WC_BUILDER_SUBDOMAIN')).toBe(false);
    // Presence and integrity ARE its subject.
    expect(coOccurringLeadAllowed('A8', 'DS_MISSING_PROFILE')).toBe(true);
    expect(coOccurringLeadAllowed('A8', 'DS_DUPLICATE_LISTING')).toBe(true);
  });

  it('the website lane (A7) cannot lead with review signals', () => {
    expect(coOccurringLeadAllowed('A7', 'RA_UNADRESSED_POSITIVE_BACKLOG')).toBe(false);
    expect(coOccurringLeadAllowed('A7', 'WC_BROKEN_WEBSITE')).toBe(true);
  });

  it('the dual-signal lane (A5) may lead with either half', () => {
    expect(coOccurringLeadAllowed('A5', 'RA_UNADDRESSED_POSITIVE_BACKLOG')).toBe(true);
    expect(coOccurringLeadAllowed('A5', 'CP_NAP_NAME_DRIFT')).toBe(true);
  });

  it('the review lane (A1) may lead with review signals', () => {
    expect(coOccurringLeadAllowed('A1', 'RA_UNADDRESSED_POSITIVE_BACKLOG')).toBe(true);
  });
});

// ─── The anti-drift guard ────────────────────────────────────────────────

describe('the forbidden-subject table matches each prompt', () => {
  const forbiddenParagraph = (arch: string) =>
    (buildArchetypePrompt(arch as any, '{}', 'soft').split('Forbidden:')[1] ?? '')
      .split('\n\n')[0];

  it('review vocabulary', () => {
    for (const arch of ARCHETYPES) {
      // Quoted-token match. The prompts quote list items WITH the trailing
      // comma inside the quotes ("reviews," "responses,"), so the class
      // tolerates either delimiter.
      const promptForbids = /"reviews[",]/.test(forbiddenParagraph(arch));
      expect(archetypeForbidsSubject(arch, 'review')).toBe(promptForbids);
    }
  });

  it('website vocabulary', () => {
    for (const arch of ARCHETYPES) {
      const promptForbids = /"website[",]/.test(forbiddenParagraph(arch));
      expect(archetypeForbidsSubject(arch, 'website')).toBe(promptForbids);
    }
  });

  it('every table entry is a real subject', () => {
    for (const [arch, subjects] of Object.entries(FORBIDDEN_SUBJECTS)) {
      expect(ARCHETYPES).toContain(arch as any);
      for (const s of subjects) {
        expect(['review', 'presence', 'drift', 'website', 'integrity', 'other']).toContain(s);
      }
    }
  });
});

// ─── The instruction is always satisfiable ───────────────────────────────

describe('co-occurring instruction is scoped to the lane', () => {
  const fieldsWith = (code: string, label: string) =>
    JSON.stringify({
      primary_signal_severity: 'material',
      strongest_co_occurring: { code, label, severity: 'crisis' },
      triggered_signals: [{ code, label, severity: 'crisis' }],
    }, null, 2);

  it('A8 gets a scoped acknowledgement, not a lead, for a review signal', () => {
    const prompt = buildArchetypePrompt(
      'A8',
      fieldsWith('RA_UNADDRESSED_POSITIVE_BACKLOG', 'Unaddressed Positive Review Backlog'),
      'soft',
    );
    expect(prompt).toContain("OUTSIDE THIS OPENER'S SCOPE");
    expect(prompt).not.toContain('Lead with or prominently acknowledge');
    // The signal is named as out of scope, so the writer does not echo it.
    expect(prompt).toContain('must NOT lead with it and must NOT name it here');
  });

  it('A8 still gets the lead instruction for a presence signal', () => {
    const prompt = buildArchetypePrompt(
      'A8',
      fieldsWith('DS_DUPLICATE_LISTING', 'Duplicate Listing'),
      'soft',
    );
    expect(prompt).toContain('STRONGER CO-OCCURRING SIGNAL DETECTED');
    expect(prompt).toContain('Lead with or prominently acknowledge');
    expect(prompt).not.toContain("OUTSIDE THIS OPENER'S SCOPE");
  });

  it('A5 gets the lead instruction for the same review signal A8 must decline', () => {
    const fields = fieldsWith('RA_UNADDRESSED_POSITIVE_BACKLOG', 'Unaddressed Positive Review Backlog');
    expect(buildArchetypePrompt('A5', fields, 'soft')).toContain('Lead with or prominently acknowledge');
    expect(buildArchetypePrompt('A8', fields, 'soft')).toContain("OUTSIDE THIS OPENER'S SCOPE");
  });

  it('emits nothing when no stronger signal exists', () => {
    const fields = JSON.stringify({
      primary_signal_severity: 'crisis',
      strongest_co_occurring: null,
    }, null, 2);
    for (const arch of ARCHETYPES) {
      const prompt = buildArchetypePrompt(arch, fields, 'soft');
      expect(prompt).not.toContain('STRONGER CO-OCCURRING SIGNAL DETECTED');
      expect(prompt).not.toContain("OUTSIDE THIS OPENER'S SCOPE");
    }
  });
});
